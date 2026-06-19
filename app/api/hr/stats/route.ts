import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = getDb()

    const [[empRows], [deptRows], [leaveRows], [attRows], [payrollRows]] = await Promise.all([
      db.query(`SELECT
        COUNT(*) FILTER (WHERE status='active') AS active,
        COUNT(*) FILTER (WHERE status='inactive') AS inactive,
        COUNT(*) FILTER (WHERE status='terminated') AS terminated,
        COUNT(*) AS total
        FROM hr_employees`),
      db.query(`SELECT COUNT(*) AS total FROM hr_departments`),
      db.query(`SELECT
        COUNT(*) FILTER (WHERE status='pending') AS pending,
        COUNT(*) FILTER (WHERE status='approved') AS approved,
        COUNT(*) FILTER (WHERE status='rejected') AS rejected
        FROM hr_leave_requests`),
      db.query(`SELECT
        COUNT(*) FILTER (WHERE status='present') AS present,
        COUNT(*) FILTER (WHERE status='absent') AS absent,
        COUNT(*) FILTER (WHERE status='on_leave') AS on_leave
        FROM hr_attendance WHERE date = CURRENT_DATE`),
      db.query(`SELECT COALESCE(SUM(total_net),0) AS total_paid
        FROM hr_payroll WHERE status='paid'
          AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())`),
    ])

    const emp = (empRows as any[])[0] || {}
    const dept = (deptRows as any[])[0] || {}
    const leave = (leaveRows as any[])[0] || {}
    const att = (attRows as any[])[0] || {}
    const payroll = (payrollRows as any[])[0] || {}

    const [deptBreakdownRows] = await db.query(
      `SELECT d.name, COUNT(e.id) AS count
         FROM hr_departments d
         LEFT JOIN hr_employees e ON e.department_id = d.id AND e.status = 'active'
         GROUP BY d.id, d.name ORDER BY count DESC`
    )

    return NextResponse.json({
      data: {
        employees: { active: +emp.active||0, inactive: +emp.inactive||0, terminated: +emp.terminated||0, total: +emp.total||0 },
        departments: +dept.total || 0,
        leave: { pending: +leave.pending||0, approved: +leave.approved||0, rejected: +leave.rejected||0 },
        today_attendance: { present: +att.present||0, absent: +att.absent||0, on_leave: +att.on_leave||0 },
        ytd_payroll: +payroll.total_paid || 0,
        department_breakdown: deptBreakdownRows,
      }
    })
  } catch (err: any) {
    console.error('hr/stats error', err)
    return NextResponse.json({ error: 'Failed to fetch HR stats' }, { status: 500 })
  }
}
