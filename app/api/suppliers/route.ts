import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

// GET /api/suppliers?q=search - list active suppliers for dropdowns
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const db = getDb()
    const where = q ? 'WHERE status = "active" AND supplier_name LIKE :q' : 'WHERE status = "active"'
    const [rows] = await db.query(
      `SELECT id, supplier_name FROM suppliers ${where} ORDER BY supplier_name ASC LIMIT 50`,
      q ? { q: `%${q}%` } : {}
    )
    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('GET suppliers error', err)
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
  }
}

const createSchema = z.object({
  supplier_name: z.string().min(1),
  status: z.enum(['active', 'inactive']).optional().default('active'),
})

// POST /api/suppliers - quick create supplier with name only
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = createSchema.parse(body)
    const db = getDb()
    const [res] = await db.execute(
      `INSERT INTO suppliers (supplier_name, status) VALUES (:supplier_name, :status)`,
      parsed as any
    )
    const id = (res as any).insertId
    const [rows] = await db.query(
      `SELECT id, supplier_name FROM suppliers WHERE id = :id`,
      { id }
    )
    return NextResponse.json({ data: Array.isArray(rows) ? rows[0] : rows }, { status: 201 })
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('POST supplier error', err)
    return NextResponse.json({ error: 'Failed to create supplier', detail: err?.message }, { status: 500 })
  }
}
