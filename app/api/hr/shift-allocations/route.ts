import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const dept   = searchParams.get('department_id')
    const search = searchParams.get('search') || ''

    const db = getDb()
    let sql = `
      SELECT e.id AS employee_id, e.employee_code,
             CONCAT(e.first_name,' ',COALESCE(e.last_name,'')) AS name,
             d.name AS department_name,
             s.id   AS shift_id,
             s.name AS shift_name,
             s.start_time, s.end_time, s.break_minutes, s.grace_minutes,
             a.effective_from, a.id AS allocation_id
        FROM hr_employees e
        LEFT JOIN hr_departments d ON d.id = e.department_id
        LEFT JOIN LATERAL (
          SELECT * FROM hr_shift_allocations
          WHERE employee_id = e.id AND effective_from <= CURRENT_DATE
            AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
          ORDER BY effective_from DESC LIMIT 1
        ) a ON TRUE
        LEFT JOIN hr_shifts s ON s.id = a.shift_id
       WHERE e.status = 'active'`
    const params: Record<string, any> = {}

    if (dept)   { sql += ' AND e.department_id = :dept'; params.dept = Number(dept) }
    if (search) { sql += ` AND (e.first_name ILIKE :s OR e.last_name ILIKE :s OR e.employee_code ILIKE :s)`; params.s = `%${search}%` }
    sql += ' ORDER BY e.first_name, e.last_name'

    const [rows] = await db.query(sql, params)
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const db = getDb()

    // Bulk: { employee_ids: [], shift_id, effective_from }
    // Single: { employee_id, shift_id, effective_from }
    const shift_id       = Number(body.shift_id)
    const effective_from = body.effective_from || new Date().toISOString().slice(0, 10)
    const ids: number[]  = body.employee_ids
      ? body.employee_ids.map(Number)
      : body.employee_id ? [Number(body.employee_id)] : []

    if (!ids.length || !shift_id)
      return NextResponse.json({ error: 'shift_id and at least one employee required' }, { status: 400 })

    let count = 0
    for (const eid of ids) {
      await db.execute(
        `INSERT INTO hr_shift_allocations (employee_id, shift_id, effective_from)
         VALUES (:eid, :shift_id, :eff)
         ON CONFLICT (employee_id, effective_from) DO UPDATE
           SET shift_id = EXCLUDED.shift_id`,
        { eid, shift_id, eff: effective_from }
      )
      count++
    }
    return NextResponse.json({ success: true, assigned: count })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
