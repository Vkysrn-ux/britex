import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

// GET /api/hr/payroll/inputs?month=&year=
// Active employees with their manual inputs (advance / permission hours / ESI) for the month
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const month = Number(searchParams.get('month'))
    const year = Number(searchParams.get('year'))
    if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 })

    const db = getDb()
    const [rows] = await db.query(
      `SELECT e.id AS employee_id, e.employee_code,
              TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name,''))) AS name,
              d.name AS department_name, e.day_rate,
              COALESCE(i.advance, 0) AS advance,
              COALESCE(i.permission_hours, 0) AS permission_hours,
              COALESCE(i.esi, 0) AS esi,
              i.notes
         FROM hr_employees e
         LEFT JOIN hr_departments d ON d.id = e.department_id
         LEFT JOIN hr_payroll_inputs i
           ON i.employee_id = e.id AND i.month = :month AND i.year = :year
        WHERE e.status = 'active'
        ORDER BY e.employee_code`,
      { month, year }
    )
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    console.error('GET payroll inputs error', err)
    return NextResponse.json({ error: 'Failed to fetch payroll inputs' }, { status: 500 })
  }
}

const saveSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020),
  entries: z.array(z.object({
    employee_id: z.coerce.number().int().positive(),
    advance: z.coerce.number().min(0).optional().default(0),
    permission_hours: z.coerce.number().min(0).optional().default(0),
    esi: z.coerce.number().min(0).optional().default(0),
    notes: z.string().optional().nullable(),
  })).min(1),
})

// POST /api/hr/payroll/inputs — upsert manual inputs for one or more employees
export async function POST(req: Request) {
  try {
    const parsed = saveSchema.parse(await req.json())
    const db = getDb()
    for (const e of parsed.entries) {
      await db.execute(
        `INSERT INTO hr_payroll_inputs (month, year, employee_id, advance, permission_hours, esi, notes, updated_at)
         VALUES (:month, :year, :employee_id, :advance, :permission_hours, :esi, :notes, NOW())
         ON CONFLICT (month, year, employee_id)
         DO UPDATE SET advance = EXCLUDED.advance,
                       permission_hours = EXCLUDED.permission_hours,
                       esi = EXCLUDED.esi,
                       notes = EXCLUDED.notes,
                       updated_at = NOW()`,
        { month: parsed.month, year: parsed.year, employee_id: e.employee_id,
          advance: e.advance, permission_hours: e.permission_hours, esi: e.esi, notes: e.notes ?? null }
      )
    }
    return NextResponse.json({ success: true, saved: parsed.entries.length })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    console.error('POST payroll inputs error', err)
    return NextResponse.json({ error: 'Failed to save payroll inputs' }, { status: 500 })
  }
}
