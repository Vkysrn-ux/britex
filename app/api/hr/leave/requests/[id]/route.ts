import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  leave_type_id: z.coerce.number().int().optional(),
  start_date: z.string().min(1).optional(),
  end_date: z.string().min(1).optional(),
  reason: z.string().optional().nullable(),
})

function saneDate(s: string) {
  const y = Number(s.slice(0, 4))
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && y >= 2020 && y <= 2100
}

// Days = calendar days in range excluding Sundays (factory works Saturdays)
function workingDays(start: string, end: string) {
  const s = new Date(start + 'T00:00:00Z'), e = new Date(end + 'T00:00:00Z')
  let n = 0
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0) n++
  }
  return n
}

// PUT /api/hr/leave/requests/[id] — edit a PENDING request (dates/type/reason)
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const id = Number((await params).id)
    const parsed = updateSchema.parse(await req.json())
    const db = getDb()

    const [rows] = await db.query('SELECT * FROM hr_leave_requests WHERE id = :id', { id })
    const row = (rows as any[])[0]
    if (!row) return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    if (row.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending requests can be edited — delete and re-create instead' }, { status: 400 })
    }

    const start = parsed.start_date ?? String(row.start_date).slice(0, 10)
    const end = parsed.end_date ?? String(row.end_date).slice(0, 10)
    if (!saneDate(start) || !saneDate(end)) return NextResponse.json({ error: 'Invalid date (check the year)' }, { status: 400 })
    if (end < start) return NextResponse.json({ error: 'End date is before start date' }, { status: 400 })
    const days = workingDays(start, end)
    if (days > 366) return NextResponse.json({ error: 'Leave longer than a year — check the dates' }, { status: 400 })

    await db.execute(
      `UPDATE hr_leave_requests
          SET leave_type_id = :type, start_date = :start, end_date = :end, days = :days, reason = :reason
        WHERE id = :id`,
      { type: parsed.leave_type_id ?? row.leave_type_id, start, end, days,
        reason: parsed.reason !== undefined ? parsed.reason : row.reason, id }
    )
    return NextResponse.json({ success: true, days })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    console.error('PUT leave request error', err)
    return NextResponse.json({ error: err?.message || 'Failed to update leave request' }, { status: 500 })
  }
}

// DELETE /api/hr/leave/requests/[id] — remove a request; if it was approved,
// also clear the on_leave marks it wrote into attendance (punch data is kept)
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const id = Number((await params).id)
    const db = getDb()
    const [rows] = await db.query('SELECT * FROM hr_leave_requests WHERE id = :id', { id })
    const row = (rows as any[])[0]
    if (!row) return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })

    if (row.status === 'approved') {
      await db.execute(
        `DELETE FROM hr_attendance
          WHERE employee_id = :emp AND date BETWEEN :start AND :end
            AND status = 'on_leave' AND check_in IS NULL`,
        { emp: row.employee_id, start: row.start_date, end: row.end_date }
      )
    }
    await db.execute('DELETE FROM hr_leave_requests WHERE id = :id', { id })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE leave request error', err)
    return NextResponse.json({ error: err?.message || 'Failed to delete leave request' }, { status: 500 })
  }
}
