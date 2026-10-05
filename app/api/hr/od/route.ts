import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const schema = z.object({
  employee_id: z.coerce.number().int(),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  out_time: z.string().optional().nullable(),
  in_time: z.string().optional().nullable(),
  place: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
})

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const employee_id = searchParams.get('employee_id')

    const db = getDb()
    let sql = `SELECT r.*,
                      CONCAT(e.first_name,' ',e.last_name) AS employee_name,
                      e.employee_code, d.name AS department_name
               FROM hr_od_requests r
               JOIN hr_employees e ON e.id = r.employee_id
               LEFT JOIN hr_departments d ON d.id = e.department_id
               WHERE 1=1`
    const params: Record<string, any> = {}

    if (status) { sql += ' AND r.status = :status'; params.status = status }
    if (employee_id) { sql += ' AND r.employee_id = :emp'; params.emp = Number(employee_id) }
    sql += ' ORDER BY r.start_date DESC, r.created_at DESC'

    const [rows] = await db.query(sql, params)
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    console.error('GET od error', err)
    return NextResponse.json({ error: 'Failed to fetch OD requests' }, { status: 500 })
  }
}

function saneDate(s: string) {
  const y = Number(s.slice(0, 4))
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && y >= 2020 && y <= 2100
}

// Calendar days in range excluding Sundays (factory works Saturdays)
function workingDays(start: string, end: string) {
  const s = new Date(start + 'T00:00:00Z'), e = new Date(end + 'T00:00:00Z')
  let n = 0
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0) n++
  }
  return n
}

export async function POST(req: Request) {
  try {
    const parsed = schema.parse(await req.json())
    if (!saneDate(parsed.start_date) || !saneDate(parsed.end_date)) {
      return NextResponse.json({ error: 'Invalid date (check the year)' }, { status: 400 })
    }
    if (parsed.end_date < parsed.start_date) {
      return NextResponse.json({ error: 'End date is before start date' }, { status: 400 })
    }
    const days = workingDays(parsed.start_date, parsed.end_date)
    if (days < 1) return NextResponse.json({ error: 'OD range has only Sundays' }, { status: 400 })
    if (days > 366) {
      return NextResponse.json({ error: 'OD longer than a year — check the dates' }, { status: 400 })
    }
    const db = getDb()
    const [result] = await db.execute(
      `INSERT INTO hr_od_requests (employee_id, start_date, end_date, days, out_time, in_time, place, purpose)
       VALUES (:employee_id, :start_date, :end_date, :days, :out_time, :in_time, :place, :purpose)`,
      { ...parsed, days,
        out_time: parsed.out_time || null, in_time: parsed.in_time || null,
        place: parsed.place || null, purpose: parsed.purpose || null }
    )
    return NextResponse.json({ success: true, id: (result as any).insertId }, { status: 201 })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    console.error('POST od error', err)
    return NextResponse.json({ error: err?.message || 'Failed to submit OD request' }, { status: 500 })
  }
}
