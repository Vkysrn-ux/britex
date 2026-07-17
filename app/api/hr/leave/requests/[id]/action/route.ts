import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const schema = z.object({
  action: z.enum(['approve', 'reject']),
  rejection_note: z.string().optional().nullable(),
})

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { action, rejection_note } = schema.parse(await req.json())
    const db = getDb()
    const requestId = Number((await params).id)
    const status = action === 'approve' ? 'approved' : 'rejected'

    await db.execute(
      `UPDATE hr_leave_requests
          SET status = :status,
              approved_at = NOW(),
              rejection_note = :note
        WHERE id = :id AND status = 'pending'`,
      { status, note: rejection_note ?? null, id: requestId }
    )

    if (action === 'approve') {
      const [rows] = await db.query(
        `SELECT employee_id, start_date, end_date,
                (end_date - start_date) AS span_days
           FROM hr_leave_requests WHERE id = :id`,
        { id: requestId }
      )
      const req_row = (rows as any[])[0]
      if (req_row) {
        if (Number(req_row.span_days) < 0 || Number(req_row.span_days) > 366) {
          return NextResponse.json({ error: 'Leave dates look wrong (over a year or reversed) — edit the request first' }, { status: 400 })
        }
        // Only Sunday is a non-working day (factory works Saturdays)
        await db.execute(
          `INSERT INTO hr_attendance (employee_id, date, status)
           SELECT :emp_id, d::date, 'on_leave'
           FROM generate_series(:start::date, :end::date, interval '1 day') d
           WHERE EXTRACT(DOW FROM d) <> 0
           ON CONFLICT (employee_id, date) DO UPDATE SET status = 'on_leave'`,
          { emp_id: req_row.employee_id, start: req_row.start_date, end: req_row.end_date }
        )
      }
    }

    return NextResponse.json({ success: true, status })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    console.error('leave action error', err)
    return NextResponse.json({ error: err?.message || 'Failed to process action' }, { status: 500 })
  }
}
