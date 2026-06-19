import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const schema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020),
  notes: z.string().optional().nullable(),
})

export async function GET() {
  try {
    const db = getDb()
    const [rows] = await db.query(
      `SELECT p.*, COUNT(pi.id) AS employee_count
       FROM hr_payroll p
       LEFT JOIN hr_payroll_items pi ON pi.payroll_id = p.id
       GROUP BY p.id ORDER BY p.year DESC, p.month DESC`
    )
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch payroll' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const parsed = schema.parse(await req.json())
    const db = getDb()
    const [result] = await db.execute(
      `INSERT INTO hr_payroll (month, year, notes) VALUES (:month, :year, :notes)
       ON CONFLICT (month, year) DO UPDATE SET notes = EXCLUDED.notes RETURNING id`,
      { month: parsed.month, year: parsed.year, notes: parsed.notes ?? null }
    )
    return NextResponse.json({ success: true, id: (result as any).insertId }, { status: 201 })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    return NextResponse.json({ error: err?.message || 'Failed to create payroll' }, { status: 500 })
  }
}
