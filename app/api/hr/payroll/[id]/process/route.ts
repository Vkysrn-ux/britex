import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

// Britex salary rules:
//   working_days      = days in month minus Sundays
//   working_salary    = day_rate × (present + 0.5 × half_days)   [non-Sunday days]
//   sunday_salary     = day_rate × sundays worked (normal rate)
//   incentive         = 5% of working_salary, only when present == working_days (no leave, no half day)
//   permission_amount = permission_hours × day_rate / 8
//   net               = working + sunday + incentive − esi − advance − permission_amount
// Advance / permission / ESI come from hr_payroll_inputs (entered by office).
// Re-processing is allowed while status is draft or processed; blocked once paid.
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const db = getDb()
    const payrollId = Number((await params).id)

    const [payrollRows] = await db.query('SELECT * FROM hr_payroll WHERE id = :id', { id: payrollId })
    const payroll = (payrollRows as any[])[0]
    if (!payroll) return NextResponse.json({ error: 'Payroll not found' }, { status: 404 })
    if (payroll.status === 'paid') return NextResponse.json({ error: 'Payroll is locked (paid)' }, { status: 400 })

    const month = Number(payroll.month), year = Number(payroll.year)

    // Working days = days in month minus Sundays
    const daysInMonth = new Date(year, month, 0).getDate()
    let workingDays = 0
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, month - 1, d).getDay() !== 0) workingDays++
    }

    const [employees] = await db.query(
      `SELECT e.id, e.employee_code, COALESCE(e.day_rate, 0) AS day_rate,
              COALESCE(i.advance, 0) AS advance,
              COALESCE(i.permission_hours, 0) AS permission_hours,
              CASE WHEN COALESCE(i.esi, 0) > 0 THEN i.esi ELSE COALESCE(e.esi_amount, 0) END AS esi
         FROM hr_employees e
         LEFT JOIN hr_payroll_inputs i
           ON i.employee_id = e.id AND i.month = :month AND i.year = :year
        WHERE e.status = 'active'
        ORDER BY e.employee_code`,
      { month, year }
    )

    // Attendance aggregates for the whole month in one query
    const [attRows] = await db.query(
      `SELECT employee_id,
              COUNT(*) FILTER (WHERE EXTRACT(DOW FROM date) <> 0 AND status IN ('present','late'))  AS full_days,
              COUNT(*) FILTER (WHERE EXTRACT(DOW FROM date) <> 0 AND status = 'half_day')            AS half_days,
              COUNT(*) FILTER (WHERE EXTRACT(DOW FROM date) = 0  AND status IN ('present','late','half_day')) AS sunday_days
         FROM hr_attendance
        WHERE EXTRACT(MONTH FROM date) = :month AND EXTRACT(YEAR FROM date) = :year
        GROUP BY employee_id`,
      { month, year }
    )
    const attMap = new Map<number, any>()
    for (const r of attRows as any[]) attMap.set(Number(r.employee_id), r)

    const round2 = (n: number) => Math.round(n * 100) / 100
    let totalGross = 0, totalDed = 0, totalNet = 0, count = 0

    for (const emp of employees as any[]) {
      const rate = Number(emp.day_rate)
      const att = attMap.get(Number(emp.id)) || { full_days: 0, half_days: 0, sunday_days: 0 }
      const fullDays = Number(att.full_days), halfDays = Number(att.half_days), sundayDays = Number(att.sunday_days)
      const presentEquiv = fullDays + halfDays * 0.5

      const workingSalary = round2(rate * presentEquiv)
      const sundaySalary = round2(rate * sundayDays)
      const fullAttendance = fullDays === workingDays && halfDays === 0
      const incentive = fullAttendance ? round2(workingSalary * 0.05) : 0

      const advance = Number(emp.advance)
      const permissionHours = Number(emp.permission_hours)
      const permissionAmount = round2(permissionHours * rate / 8)
      const esi = Number(emp.esi)

      const gross = round2(workingSalary + sundaySalary + incentive)
      const deductions = round2(esi + advance + permissionAmount)
      const net = round2(gross - deductions)
      const absentDays = Math.max(0, workingDays - presentEquiv)

      await db.execute(
        `INSERT INTO hr_payroll_items
           (payroll_id, employee_id, day_rate, working_days, present_days, half_days, sunday_days,
            absent_days, leave_days, working_salary, sunday_salary, incentive,
            esi, advance, permission_hours, permission_amount,
            basic_salary, gross_salary, other_deductions, net_salary)
         VALUES
           (:payroll_id, :employee_id, :day_rate, :working_days, :present_days, :half_days, :sunday_days,
            :absent_days, :leave_days, :working_salary, :sunday_salary, :incentive,
            :esi, :advance, :permission_hours, :permission_amount,
            :working_salary2, :gross, :deductions, :net)
         ON CONFLICT (payroll_id, employee_id) DO UPDATE SET
            day_rate=EXCLUDED.day_rate, working_days=EXCLUDED.working_days,
            present_days=EXCLUDED.present_days, half_days=EXCLUDED.half_days, sunday_days=EXCLUDED.sunday_days,
            absent_days=EXCLUDED.absent_days, leave_days=EXCLUDED.leave_days,
            working_salary=EXCLUDED.working_salary, sunday_salary=EXCLUDED.sunday_salary,
            incentive=EXCLUDED.incentive, esi=EXCLUDED.esi, advance=EXCLUDED.advance,
            permission_hours=EXCLUDED.permission_hours, permission_amount=EXCLUDED.permission_amount,
            basic_salary=EXCLUDED.basic_salary, gross_salary=EXCLUDED.gross_salary,
            other_deductions=EXCLUDED.other_deductions, net_salary=EXCLUDED.net_salary`,
        { payroll_id: payrollId, employee_id: emp.id, day_rate: rate, working_days: workingDays,
          present_days: fullDays, half_days: halfDays, sunday_days: sundayDays,
          absent_days: Math.round(absentDays), leave_days: Math.round(absentDays),
          working_salary: workingSalary, sunday_salary: sundaySalary, incentive,
          esi, advance, permission_hours: permissionHours, permission_amount: permissionAmount,
          working_salary2: workingSalary, gross, deductions, net }
      )

      totalGross += gross; totalDed += deductions; totalNet += net; count++
    }

    await db.execute(
      `UPDATE hr_payroll SET status='processed', total_gross=:g, total_deductions=:d,
         total_net=:n, processed_at=NOW() WHERE id=:id`,
      { g: round2(totalGross), d: round2(totalDed), n: round2(totalNet), id: payrollId }
    )

    return NextResponse.json({ success: true, employees_count: count, working_days: workingDays })
  } catch (err: any) {
    console.error('payroll/process error', err)
    return NextResponse.json({ error: err?.message || 'Failed to process payroll' }, { status: 500 })
  }
}
