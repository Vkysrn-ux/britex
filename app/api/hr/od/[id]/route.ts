import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  start_date: z.string().min(1).optional(),
  end_date: z.string().min(1).optional(),
  out_time: z.string().optional().nullable(),
  in_time: z.string().optional().nullable(),
  place: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
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

// PUT /api/hr/od/[id] — edit a PENDING OD request
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const id = Number((await params).id)
    const parsed = updateSchema.parse(await req.json())
    const db = getDb()

    const [rows] = await db.query('SELECT * FROM hr_od_requests WHERE id = :id', { id })
    const row = (rows as any[])[0]
    if (!row) return NextResponse.json({ error: 'OD request not found' }, { status: 404 })
    if (row.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending requests can be edited — delete and re-create instead' }, { status: 400 })
    }

    const start = parsed.start_date ?? String(row.start_date).slice(0, 10)
    const end = parsed.end_date ?? String(row.end_date).slice(0, 10)
    if (!saneDate(start) || !saneDate(end)) return NextResponse.json({ error: 'Invalid date (check the year)' }, { status: 400 })
    if (end < start) return NextResponse.json({ error: 'End date is before start date' }, { status: 400 })
    const days = workingDays(start, end)
    if (days < 1) return NextResponse.json({ error: 'OD range has only Sundays' }, { status: 400 })
    if (days > 366) return NextResponse.json({ error: 'OD longer than a year — check the dates' }, { status: 400 })

    const pick = (k: keyof typeof parsed) => parsed[k] !== undefined ? (parsed[k] || null) : row[k]
    await db.execute(
      `UPDATE hr_od_requests
          SET start_date = :start, end_date = :end, days = :days,
              out_time = :out_time, in_time = :in_time, place = :place, purpose = :purpose
        WHERE id = :id`,
      { start, end, days, out_time: pick('out_time'), in_time: pick('in_time'),
        place: pick('place'), purpose: pick('purpose'), id }
    )
    return NextResponse.json({ success: true, days })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    console.error('PUT od error', err)
    return NextResponse.json({ error: err?.message || 'Failed to update OD request' }, { status: 500 })
  }
}

// DELETE /api/hr/od/[id] — remove a request; if it was approved, undo its
// on_duty marks: days with no punch are removed, days with punches fall back
// to present/late (the next punch from the device recomputes them exactly)
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const id = Number((await params).id)
    const db = getDb()
    const [rows] = await db.query('SELECT * FROM hr_od_requests WHERE id = :id', { id })
    const row = (rows as any[])[0]
    if (!row) return NextResponse.json({ error: 'OD request not found' }, { status: 404 })

    if (row.status === 'approved') {
      const range = { emp: row.employee_id, start: row.start_date, end: row.end_date }
      await db.execute(
        `DELETE FROM hr_attendance
          WHERE employee_id = :emp AND date BETWEEN :start AND :end
            AND status = 'on_duty' AND check_in IS NULL`,
        range
      )
      await db.execute(
        `UPDATE hr_attendance
            SET status = CASE WHEN late_morning_mins > 0 THEN 'late' ELSE 'present' END
          WHERE employee_id = :emp AND date BETWEEN :start AND :end
            AND status = 'on_duty'`,
        range
      )
    }
    await db.execute('DELETE FROM hr_od_requests WHERE id = :id', { id })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE od error', err)
    return NextResponse.json({ error: err?.message || 'Failed to delete OD request' }, { status: 500 })
  }
}
