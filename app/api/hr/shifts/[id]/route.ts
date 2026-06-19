import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const [rows] = await db.query(`SELECT * FROM hr_shifts WHERE id = :id`, { id: Number(id) })
  if (!(rows as any[]).length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: (rows as any[])[0] })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const db = getDb()
    const fields = ['name', 'start_time', 'end_time', 'break_minutes', 'grace_minutes', 'is_active']
    const updates = fields.filter(f => body[f] !== undefined)
    if (!updates.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const sets = updates.map(f => `${f} = :${f}`).join(', ')
    const params: Record<string, any> = { id: Number(id) }
    updates.forEach(f => { params[f] = body[f] })

    await db.execute(`UPDATE hr_shifts SET ${sets} WHERE id = :id`, params)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getDb()
    await db.execute(`UPDATE hr_shifts SET is_active = FALSE WHERE id = :id`, { id: Number(id) })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
