import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const markSchema = z.object({
  employee_id: z.coerce.number().int(),
  date: z.string().min(1),
  check_in: z.string().optional().nullable(),
  check_out: z.string().optional().nullable(),
  status: z.enum(['present', 'absent', 'half_day', 'late', 'on_leave']).optional(),
  notes: z.string().optional().nullable(),
})

// Same rules as the biometric listener: 09:00 + 10 min grace, under 4 hrs = half day
const SHIFT_START_MINS = 9 * 60, GRACE = 10
const toMins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
function computeStatus(check_in?: string | null, check_out?: string | null) {
  if (!check_in) return { status: 'absent' as const, late: 0 }
  const late = Math.max(0, toMins(check_in) - (SHIFT_START_MINS + GRACE))
  if (check_in && check_out && toMins(check_out) - toMins(check_in) < 240) {
    return { status: 'half_day' as const, late }
  }
  return { status: late > 0 ? 'late' as const : 'present' as const, late }
}

const bulkSchema = z.object({
  date: z.string().min(1),
  records: z.array(z.object({
    employee_id: z.coerce.number().int(),
    status: z.enum(['present', 'absent', 'half_day', 'late', 'on_leave']),
    check_in: z.string().optional().nullable(),
    check_out: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }))
})

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const employee_id = searchParams.get('employee_id')

    const db = getDb()
    let sql = `SELECT a.*, e.employee_code, e.first_name, e.last_name,
                      d.name AS department_name
               FROM hr_attendance a
               JOIN hr_employees e ON e.id = a.employee_id
               LEFT JOIN hr_departments d ON d.id = e.department_id
               WHERE 1=1`
    const params: Record<string, any> = {}

    if (date) { sql += ' AND a.date = :date'; params.date = date }
    if (month && year) {
      sql += ' AND EXTRACT(MONTH FROM a.date) = :month AND EXTRACT(YEAR FROM a.date) = :year'
      params.month = Number(month); params.year = Number(year)
    }
    if (employee_id) { sql += ' AND a.employee_id = :emp'; params.emp = Number(employee_id) }
    sql += ' ORDER BY a.date DESC, e.first_name'

    const [rows] = await db.query(sql, params)
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    console.error('GET hr/attendance error', err)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const db = getDb()

    if (body.records) {
      const parsed = bulkSchema.parse(body)
      let inserted = 0
      for (const rec of parsed.records) {
        await db.execute(
          `INSERT INTO hr_attendance (employee_id, date, check_in, check_out, status, notes)
           VALUES (:employee_id, :date, :check_in, :check_out, :status, :notes)
           ON CONFLICT (employee_id, date) DO UPDATE
             SET status = EXCLUDED.status,
                 check_in = EXCLUDED.check_in,
                 check_out = EXCLUDED.check_out,
                 notes = EXCLUDED.notes`,
          { employee_id: rec.employee_id, date: parsed.date,
            check_in: rec.check_in ?? null, check_out: rec.check_out ?? null,
            status: rec.status, notes: rec.notes ?? null }
        )
        inserted++
      }
      return NextResponse.json({ success: true, count: inserted })
    }

    const parsed = markSchema.parse(body)
    // Status not given -> compute from the times (late / half-day / present / absent)
    const auto = computeStatus(parsed.check_in, parsed.check_out)
    const status = parsed.status ?? auto.status
    const punchCount = (parsed.check_in ? 1 : 0) + (parsed.check_out ? 1 : 0)
    await db.execute(
      `INSERT INTO hr_attendance (employee_id, date, check_in, check_out, status, notes, punch_count, late_morning_mins)
       VALUES (:employee_id, :date, :check_in, :check_out, :status, :notes, :punch_count, :late)
       ON CONFLICT (employee_id, date) DO UPDATE
         SET status = EXCLUDED.status,
             check_in = EXCLUDED.check_in,
             check_out = EXCLUDED.check_out,
             notes = EXCLUDED.notes,
             punch_count = EXCLUDED.punch_count,
             late_morning_mins = EXCLUDED.late_morning_mins`,
      { employee_id: parsed.employee_id, date: parsed.date,
        check_in: parsed.check_in ?? null, check_out: parsed.check_out ?? null,
        status, notes: parsed.notes ?? null, punch_count: punchCount, late: auto.late }
    )
    return NextResponse.json({ success: true, status })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    console.error('POST hr/attendance error', err)
    return NextResponse.json({ error: err?.message || 'Failed to mark attendance' }, { status: 500 })
  }
}
