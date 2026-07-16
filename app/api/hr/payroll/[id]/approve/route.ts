import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/hr/payroll/[id]/approve — lock the payroll month (processed -> paid)
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const db = getDb()
    const id = Number((await params).id)
    const [rows] = await db.query('SELECT status FROM hr_payroll WHERE id = :id', { id })
    const run = (rows as any[])[0]
    if (!run) return NextResponse.json({ error: 'Payroll not found' }, { status: 404 })
    if (run.status === 'paid') return NextResponse.json({ error: 'Already approved' }, { status: 400 })
    if (run.status !== 'processed') return NextResponse.json({ error: 'Generate the salary first' }, { status: 400 })

    await db.execute(`UPDATE hr_payroll SET status='paid', paid_at=NOW() WHERE id=:id`, { id })
    await db.execute(`UPDATE hr_payroll_items SET status='paid' WHERE payroll_id=:id`, { id })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('payroll/approve error', err)
    return NextResponse.json({ error: err?.message || 'Failed to approve payroll' }, { status: 500 })
  }
}
