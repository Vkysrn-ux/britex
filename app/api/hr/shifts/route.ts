import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = getDb()
    const [rows] = await db.query(
      `SELECT s.*,
              ROUND(CAST(EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600 - s.break_minutes/60.0 AS numeric), 2) AS net_hours,
              COUNT(a.id) AS employee_count
         FROM hr_shifts s
         LEFT JOIN hr_shift_allocations a ON a.shift_id = s.id AND a.effective_to IS NULL
        GROUP BY s.id
        ORDER BY s.is_active DESC, s.name`
    )
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { name, start_time, end_time, break_minutes = 0, grace_minutes = 10 } = await req.json()
    if (!name || !start_time || !end_time)
      return NextResponse.json({ error: 'name, start_time, end_time required' }, { status: 400 })

    const db = getDb()
    const [r] = await db.execute(
      `INSERT INTO hr_shifts (name, start_time, end_time, break_minutes, grace_minutes)
       VALUES (:name, :start_time, :end_time, :break_minutes, :grace_minutes)`,
      { name, start_time, end_time, break_minutes: Number(break_minutes), grace_minutes: Number(grace_minutes) }
    )
    return NextResponse.json({ success: true, id: r.insertId }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
