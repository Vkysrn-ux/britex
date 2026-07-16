import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

// GET /api/hr/payroll/history?employee_id= — salary months for one employee, newest first
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const employeeId = Number(searchParams.get('employee_id'))
    if (!employeeId) return NextResponse.json({ error: 'employee_id required' }, { status: 400 })

    const db = getDb()
    const [rows] = await db.query(
      `SELECT p.month, p.year, p.status AS payroll_status,
              pi.day_rate, pi.working_days, pi.present_days, pi.half_days, pi.sunday_days,
              pi.working_salary, pi.sunday_salary, pi.incentive,
              pi.esi, pi.advance, pi.permission_hours, pi.permission_amount, pi.net_salary
         FROM hr_payroll_items pi
         JOIN hr_payroll p ON p.id = pi.payroll_id
        WHERE pi.employee_id = :id
        ORDER BY p.year DESC, p.month DESC
        LIMIT 24`,
      { id: employeeId }
    )
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    console.error('payroll/history error', err)
    return NextResponse.json({ error: 'Failed to fetch payroll history' }, { status: 500 })
  }
}
