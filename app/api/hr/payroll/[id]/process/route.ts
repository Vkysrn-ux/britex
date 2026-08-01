import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

// Britex salary rules (per "Salary statement.xlsx" proposal, confirmed with owner):
//   working_days  = days in month minus Sundays
//   Earned Wages  = day_rate × (present + 0.5 × half_days)   [Sunday excluded from pay;
//                    Sunday attendance is still recorded for reference only]
//   Basic = 30% · DA = 25% · HRA = 20% · Other = 25%   (all of Earned Wages; sums to 100%)
//   Total = Earned Wages (= Basic+DA+HRA+Other)
//   Incentive = 5% of Total, only on full attendance (no leave/half-day in the month)
//   ESI = 0.75% of Total
//   PF  = 12% of (Basic + DA)
//   Permission: auto-detected from biometric in-between punches (see attendance-listener),
//               summed across the month in minutes -> hours; a manual month entry overrides it
//   permission_amount = permission_hours × day_rate / 8
//   Others = free-form manual deduction (uniform, extra advance, etc.)
//   Net = Total + Incentive − ESI − PF − Advance − Permission − Others
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
              COALESCE(i.permission_hours, 0) AS permission_hours_override,
              COALESCE(i.others_deduction, 0) AS others_override
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
              COUNT(*) FILTER (WHERE EXTRACT(DOW FROM date) = 0  AND status IN ('present','late','half_day')) AS sunday_days,
              COALESCE(SUM(permission_minutes), 0) AS permission_minutes
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
      const att = attMap.get(Number(emp.id)) || { full_days: 0, half_days: 0, sunday_days: 0, permission_minutes: 0 }
      const fullDays = Number(att.full_days), halfDays = Number(att.half_days), sundayDays = Number(att.sunday_days)
      const presentEquiv = fullDays + halfDays * 0.5

      // Earned Wages / Total — Sunday is recorded but not paid
      const earnedWages = round2(rate * presentEquiv)
      const basic = round2(earnedWages * 0.30)
      const da = round2(earnedWages * 0.25)
      const hra = round2(earnedWages * 0.20)
      const otherAllowance = round2(earnedWages * 0.25)
      const total = round2(basic + da + hra + otherAllowance)

      const fullAttendance = fullDays === workingDays && halfDays === 0
      const incentive = fullAttendance ? round2(total * 0.05) : 0

      const esi = round2(total * 0.0075)
      const pf = round2((basic + da) * 0.12)

      // Permission: auto from biometric punches, overridable per month
      const autoPermissionHours = round2(Number(att.permission_minutes) / 60)
      const permissionHours = Number(emp.permission_hours_override) > 0 ? Number(emp.permission_hours_override) : autoPermissionHours
      const permissionAmount = round2(permissionHours * rate / 8)

      const advance = Number(emp.advance)
      const others = Number(emp.others_override)

      const gross = round2(total + incentive)
      const deductions = round2(esi + pf + advance + permissionAmount + others)
      const net = round2(gross - deductions)
      const absentDays = Math.max(0, workingDays - presentEquiv)

      await db.execute(
        `INSERT INTO hr_payroll_items
           (payroll_id, employee_id, day_rate, working_days, present_days, half_days, sunday_days,
            absent_days, leave_days, basic, da, hra, other_allowance, working_salary,
            incentive, esi, pf, advance, permission_hours, permission_auto_hours, permission_amount,
            others_deduction, basic_salary, gross_salary, other_deductions, net_salary)
         VALUES
           (:payroll_id, :employee_id, :day_rate, :working_days, :present_days, :half_days, :sunday_days,
            :absent_days, :leave_days, :basic, :da, :hra, :other_allowance, :total,
            :incentive, :esi, :pf, :advance, :permission_hours, :permission_auto_hours, :permission_amount,
            :others, :total2, :gross, :deductions, :net)
         ON CONFLICT (payroll_id, employee_id) DO UPDATE SET
            day_rate=EXCLUDED.day_rate, working_days=EXCLUDED.working_days,
            present_days=EXCLUDED.present_days, half_days=EXCLUDED.half_days, sunday_days=EXCLUDED.sunday_days,
            absent_days=EXCLUDED.absent_days, leave_days=EXCLUDED.leave_days,
            basic=EXCLUDED.basic, da=EXCLUDED.da, hra=EXCLUDED.hra, other_allowance=EXCLUDED.other_allowance,
            working_salary=EXCLUDED.working_salary, incentive=EXCLUDED.incentive,
            esi=EXCLUDED.esi, pf=EXCLUDED.pf, advance=EXCLUDED.advance,
            permission_hours=EXCLUDED.permission_hours, permission_auto_hours=EXCLUDED.permission_auto_hours,
            permission_amount=EXCLUDED.permission_amount, others_deduction=EXCLUDED.others_deduction,
            basic_salary=EXCLUDED.basic_salary, gross_salary=EXCLUDED.gross_salary,
            other_deductions=EXCLUDED.other_deductions, net_salary=EXCLUDED.net_salary`,
        { payroll_id: payrollId, employee_id: emp.id, day_rate: rate, working_days: workingDays,
          present_days: fullDays, half_days: halfDays, sunday_days: sundayDays,
          absent_days: Math.round(absentDays), leave_days: Math.round(absentDays),
          basic, da, hra, other_allowance: otherAllowance, total,
          incentive, esi, pf, advance,
          permission_hours: permissionHours, permission_auto_hours: autoPermissionHours, permission_amount: permissionAmount,
          others, total2: total, gross, deductions, net }
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
