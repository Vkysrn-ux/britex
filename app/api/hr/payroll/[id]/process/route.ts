import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

type Ctx = { params: { id: string } }

export async function POST(_req: Request, { params }: Ctx) {
  try {
    const db = getDb()
    const payrollId = Number(params.id)

    const [payrollRows] = await db.query(
      'SELECT * FROM hr_payroll WHERE id = :id', { id: payrollId }
    )
    const payroll = (payrollRows as any[])[0]
    if (!payroll) return NextResponse.json({ error: 'Payroll not found' }, { status: 404 })
    if (payroll.status !== 'draft') return NextResponse.json({ error: 'Payroll already processed' }, { status: 400 })

    const [employees] = await db.query(
      `SELECT id, basic_salary FROM hr_employees WHERE status = 'active'`
    )

    let totalGross = 0, totalDed = 0, totalNet = 0

    for (const emp of employees as any[]) {
      const workingDays = 26
      const allowances = Math.round(emp.basic_salary * 0.2 * 100) / 100
      const gross = emp.basic_salary + allowances
      const tax = Math.round(gross * 0.1 * 100) / 100
      const net = gross - tax

      const [attRows] = await db.query(
        `SELECT COUNT(*) AS present_days FROM hr_attendance
          WHERE employee_id = :emp_id
            AND EXTRACT(MONTH FROM date) = :month
            AND EXTRACT(YEAR FROM date) = :year
            AND status IN ('present','late','half_day')`,
        { emp_id: emp.id, month: payroll.month, year: payroll.year }
      )
      const presentDays = Number((attRows as any[])[0]?.present_days ?? 0)
      const leaveDays = workingDays - presentDays > 0 ? workingDays - presentDays : 0

      await db.execute(
        `INSERT INTO hr_payroll_items
           (payroll_id, employee_id, basic_salary, allowances, gross_salary, tax_deduction, net_salary,
            working_days, present_days, absent_days, leave_days)
         VALUES
           (:payroll_id, :employee_id, :basic_salary, :allowances, :gross, :tax, :net,
            :working_days, :present_days, :absent_days, :leave_days)
         ON CONFLICT (payroll_id, employee_id) DO UPDATE
           SET basic_salary=EXCLUDED.basic_salary, allowances=EXCLUDED.allowances,
               gross_salary=EXCLUDED.gross_salary, tax_deduction=EXCLUDED.tax_deduction,
               net_salary=EXCLUDED.net_salary, present_days=EXCLUDED.present_days,
               absent_days=EXCLUDED.absent_days, leave_days=EXCLUDED.leave_days`,
        { payroll_id: payrollId, employee_id: emp.id, basic_salary: emp.basic_salary,
          allowances, gross, tax, net, working_days: workingDays,
          present_days: presentDays, absent_days: Math.max(0, workingDays - presentDays - leaveDays),
          leave_days: leaveDays }
      )

      totalGross += gross; totalDed += tax; totalNet += net
    }

    await db.execute(
      `UPDATE hr_payroll SET status='processed', total_gross=:g, total_deductions=:d,
         total_net=:n, processed_at=NOW() WHERE id=:id`,
      { g: Math.round(totalGross * 100) / 100, d: Math.round(totalDed * 100) / 100,
        n: Math.round(totalNet * 100) / 100, id: payrollId }
    )

    return NextResponse.json({ success: true, employees_count: (employees as any[]).length })
  } catch (err: any) {
    console.error('payroll/process error', err)
    return NextResponse.json({ error: err?.message || 'Failed to process payroll' }, { status: 500 })
  }
}
