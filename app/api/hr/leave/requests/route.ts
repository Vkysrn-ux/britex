import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const schema = z.object({
  employee_id: z.coerce.number().int(),
  leave_type_id: z.coerce.number().int(),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  days: z.coerce.number().int().min(1),
  reason: z.string().optional().nullable(),
})

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const employee_id = searchParams.get('employee_id')

    const db = getDb()
    let sql = `SELECT r.*, lt.name AS leave_type_name, lt.paid,
                      CONCAT(e.first_name,' ',e.last_name) AS employee_name,
                      e.employee_code, d.name AS department_name
               FROM hr_leave_requests r
               JOIN hr_employees e ON e.id = r.employee_id
               JOIN hr_leave_types lt ON lt.id = r.leave_type_id
               LEFT JOIN hr_departments d ON d.id = e.department_id
               WHERE 1=1`
    const params: Record<string, any> = {}

    if (status) { sql += ' AND r.status = :status'; params.status = status }
    if (employee_id) { sql += ' AND r.employee_id = :emp'; params.emp = Number(employee_id) }
    sql += ' ORDER BY r.created_at DESC'

    const [rows] = await db.query(sql, params)
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    console.error('GET leave/requests error', err)
    return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const parsed = schema.parse(await req.json())
    const db = getDb()
    const [result] = await db.execute(
      `INSERT INTO hr_leave_requests (employee_id, leave_type_id, start_date, end_date, days, reason)
       VALUES (:employee_id, :leave_type_id, :start_date, :end_date, :days, :reason)`,
      { ...parsed, reason: parsed.reason ?? null }
    )
    return NextResponse.json({ success: true, id: (result as any).insertId }, { status: 201 })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    console.error('POST leave/requests error', err)
    return NextResponse.json({ error: err?.message || 'Failed to submit leave request' }, { status: 500 })
  }
}
