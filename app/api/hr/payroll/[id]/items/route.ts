import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const db = getDb()
    const [rows] = await db.query(
      `SELECT pi.*, TRIM(CONCAT(e.first_name,' ',COALESCE(e.last_name,''))) AS employee_name,
              e.employee_code, d.name AS department_name
         FROM hr_payroll_items pi
         JOIN hr_employees e ON e.id = pi.employee_id
         LEFT JOIN hr_departments d ON d.id = e.department_id
        WHERE pi.payroll_id = :id
        ORDER BY e.employee_code`,
      { id: Number((await params).id) }
    )
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch payroll items' }, { status: 500 })
  }
}
