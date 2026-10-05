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

    if (action === 'approve') {
      const [rows] = await db.query(
        `SELECT employee_id, start_date, end_date, (end_date - start_date) AS span_days
           FROM hr_od_requests WHERE id = :id AND status = 'pending'`,
        { id: requestId }
      )
      const od = (rows as any[])[0]
      if (!od) return NextResponse.json({ error: 'OD request not found or already processed' }, { status: 400 })
      if (Number(od.span_days) < 0 || Number(od.span_days) > 366) {
        return NextResponse.json({ error: 'OD dates look wrong (over a year or reversed) — edit the request first' }, { status: 400 })
      }
      // Mark every non-Sunday as on_duty; existing punches on those days are kept
      await db.execute(
        `INSERT INTO hr_attendance (employee_id, date, status)
         SELECT :emp_id, d::date, 'on_duty'
         FROM generate_series(CAST(:start AS date), CAST(:end AS date), interval '1 day') d
         WHERE EXTRACT(DOW FROM d) <> 0
         ON CONFLICT (employee_id, date) DO UPDATE SET status = 'on_duty'`,
        { emp_id: od.employee_id, start: od.start_date, end: od.end_date }
      )
    }

    await db.execute(
      `UPDATE hr_od_requests
          SET status = :status, approved_at = NOW(), rejection_note = :note
        WHERE id = :id AND status = 'pending'`,
      { status, note: rejection_note ?? null, id: requestId }
    )

    return NextResponse.json({ success: true, status })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    console.error('od action error', err)
    return NextResponse.json({ error: err?.message || 'Failed to process action' }, { status: 500 })
  }
}
