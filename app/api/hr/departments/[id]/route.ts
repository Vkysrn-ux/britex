import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, code, description, head_id } = body

    if (!name || !code)
      return NextResponse.json({ error: 'name and code are required' }, { status: 400 })

    const db = getDb()
    await db.execute(
      `UPDATE hr_departments
          SET name = :name, code = :code, description = :desc, head_id = :head
        WHERE id = :id`,
      { name, code: String(code).toUpperCase(), desc: description || null, head: head_id || null, id: Number(id) }
    )
    const [rows] = await db.query(`SELECT * FROM hr_departments WHERE id = :id`, { id: Number(id) })
    return NextResponse.json({ data: (rows as any[])[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getDb()
    // Only allow delete if no active employees
    const [check] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hr_employees WHERE department_id = :id AND status = 'active'`,
      { id: Number(id) }
    )
    if (Number((check as any[])[0]?.cnt) > 0)
      return NextResponse.json({ error: 'Cannot delete: department has active employees. Reassign them first.' }, { status: 409 })

    await db.execute(`DELETE FROM hr_departments WHERE id = :id`, { id: Number(id) })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
