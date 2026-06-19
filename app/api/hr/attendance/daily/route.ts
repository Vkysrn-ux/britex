import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const date   = searchParams.get('date') || new Date().toISOString().slice(0, 10)
    const dept   = searchParams.get('department_id')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    const db = getDb()

    let sql = `
      SELECT
        e.id, e.employee_code,
        CONCAT(e.first_name, ' ', COALESCE(e.last_name,'')) AS name,
        d.name AS department_name,
        a.check_in, a.check_out, a.status, a.notes,
        CASE
          WHEN a.check_in IS NOT NULL AND a.check_out IS NOT NULL
          THEN ROUND(CAST(EXTRACT(EPOCH FROM (a.check_out - a.check_in)) / 3600.0 AS numeric), 2)
          ELSE 0
        END AS work_hours,
        s.id   AS shift_id,
        s.name AS shift_name,
        s.start_time  AS shift_start,
        s.end_time    AS shift_end,
        s.break_minutes,
        s.grace_minutes,
        ROUND(
          CAST(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0 - COALESCE(s.break_minutes,0)/60.0 AS numeric),
          2
        ) AS shift_hours
      FROM hr_employees e
      LEFT JOIN hr_departments d ON d.id = e.department_id
      LEFT JOIN hr_attendance  a ON a.employee_id = e.id AND a.date = :date
      LEFT JOIN LATERAL (
        SELECT sa.shift_id FROM hr_shift_allocations sa
        WHERE sa.employee_id = e.id
          AND sa.effective_from <= :date2
          AND (sa.effective_to IS NULL OR sa.effective_to >= :date3)
        ORDER BY sa.effective_from DESC LIMIT 1
      ) alloc ON TRUE
      LEFT JOIN hr_shifts s ON s.id = alloc.shift_id
      WHERE e.status = 'active'
    `
    const params: Record<string, any> = { date, date2: date, date3: date }

    if (dept)   { sql += ' AND e.department_id = :dept'; params.dept = Number(dept) }
    if (search) {
      sql += ` AND (e.first_name ILIKE :s OR e.last_name ILIKE :s OR e.employee_code ILIKE :s)`
      params.s = `%${search}%`
    }
    if (status === 'absent') {
      sql += ' AND a.id IS NULL'
    } else if (status) {
      sql += ' AND a.status = :status'
      params.status = status
    }

    sql += ' ORDER BY a.check_in ASC NULLS LAST, e.first_name'

    const [rows] = await db.query(sql, params)
    const list = rows as any[]

    const total    = list.length
    const present  = list.filter(r => r.status === 'present').length
    const late     = list.filter(r => r.status === 'late').length
    const half_day = list.filter(r => r.status === 'half_day').length
    const on_leave = list.filter(r => r.status === 'on_leave').length
    const absent   = list.filter(r => !r.status).length

    return NextResponse.json({
      date,
      summary: { total, present, late, half_day, on_leave, absent },
      employees: list,
    })
  } catch (err: any) {
    console.error('attendance/daily error', err)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
