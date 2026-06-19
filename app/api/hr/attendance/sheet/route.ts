import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const month  = Number(searchParams.get('month') || new Date().getMonth() + 1)
    const year   = Number(searchParams.get('year')  || new Date().getFullYear())
    const dept   = searchParams.get('department_id')
    const search = searchParams.get('search') || ''

    const db = getDb()

    const totalDays = new Date(year, month, 0).getDate()

    const todayUtc = new Date(); todayUtc.setHours(0, 0, 0, 0)

    const days = Array.from({ length: totalDays }, (_, i) => {
      const d = new Date(year, month - 1, i + 1)
      const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]
      return { day: i + 1, dow, is_sunday: d.getDay() === 0, is_future: d > todayUtc }
    })

    // Fetch employees
    let empSql = `SELECT e.id, e.employee_code, e.first_name, e.last_name,
                         d.name AS department_name
                    FROM hr_employees e
                    LEFT JOIN hr_departments d ON d.id = e.department_id
                   WHERE e.status = 'active'`
    const empParams: Record<string, any> = {}
    if (dept) { empSql += ' AND e.department_id = :dept'; empParams.dept = Number(dept) }
    if (search) {
      empSql += ` AND (e.first_name ILIKE :search OR e.last_name ILIKE :search OR e.employee_code ILIKE :search)`
      empParams.search = `%${search}%`
    }
    empSql += ' ORDER BY e.first_name, e.last_name'
    const [empRows] = await db.query(empSql, empParams)

    // Fetch all attendance for this month including punch columns
    const [attRows] = await db.query(
      `SELECT employee_id,
              EXTRACT(DAY FROM date) AS day,
              status, check_in, check_out,
              lunch_out, lunch_in,
              punch_count, is_late_lunch, late_lunch_mins, late_morning_mins
         FROM hr_attendance
        WHERE EXTRACT(MONTH FROM date) = :att_month
          AND EXTRACT(YEAR  FROM date) = :att_year`,
      { att_month: month, att_year: year }
    )

    // Build map: employee_id → day → record
    const attMap = new Map<number, Map<number, any>>()
    for (const row of attRows as any[]) {
      const dayNum = Number(row.day)
      if (!attMap.has(row.employee_id)) attMap.set(row.employee_id, new Map())
      attMap.get(row.employee_id)!.set(dayNum, row)
    }

    const employees = (empRows as any[]).map(emp => {
      const empAtt = attMap.get(emp.id) || new Map()
      let present = 0, absent = 0, half_day = 0, on_leave = 0, sundays = 0
      let late_morning = 0, late_lunch = 0

      const attendance: Record<number, any> = {}
      for (const { day, is_sunday, is_future } of days) {
        if (is_sunday) { sundays++; continue }
        const rec = empAtt.get(day)
        if (rec) {
          attendance[day] = {
            status:            rec.status,
            check_in:          rec.check_in,
            check_out:         rec.check_out,
            lunch_out:         rec.lunch_out,
            lunch_in:          rec.lunch_in,
            punch_count:       Number(rec.punch_count) || 0,
            is_late_lunch:     Boolean(rec.is_late_lunch),
            late_lunch_mins:   Number(rec.late_lunch_mins) || 0,
            late_morning_mins: Number(rec.late_morning_mins) || 0,
          }
          if (rec.status === 'present')   present++
          else if (rec.status === 'absent')   absent++
          else if (rec.status === 'half_day') { half_day++; present += 0.5 }
          else if (rec.status === 'late')     { late_morning++; present++ }
          else if (rec.status === 'on_leave') on_leave++
          if (rec.is_late_lunch) late_lunch++
        } else {
          attendance[day] = is_future ? 'future' : null
          if (!is_future) absent++ // only past/today with no record = absent
        }
      }

      return {
        id: emp.id,
        employee_code: emp.employee_code,
        name: `${emp.first_name} ${emp.last_name}`.trim(),
        department_name: emp.department_name || '—',
        attendance,
        summary: { present, absent, half_day, on_leave, sundays, late_morning, late_lunch, total_days: totalDays },
      }
    })

    return NextResponse.json({ data: { employees, days, month, year, total_days: totalDays } })
  } catch (err: any) {
    console.error('attendance/sheet error', err)
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
}
