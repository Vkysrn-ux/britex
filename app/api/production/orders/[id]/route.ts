import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const idParam = z.coerce.number().int().positive()

const updateSchema = z.object({
  quantity_ordered: z.coerce.number().int().positive().optional(),
  quantity_produced: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  start_date: z.string().optional().nullable(),
  expected_completion_date: z.string().optional().nullable(),
  actual_completion_date: z.string().optional().nullable(),
  assigned_to: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idRaw } = await context.params
    const id = idParam.parse(idRaw)
    const db = getDb()
    const [rows] = await db.query(
      `SELECT 
         po.id, po.order_number, po.finished_product_id, po.quantity_ordered, po.quantity_produced, po.status, po.priority,
         po.start_date, po.expected_completion_date, po.actual_completion_date, po.assigned_to, po.notes,
         po.created_at, po.updated_at,
         fp.sku AS product_sku, fp.name AS product_name, fp.size AS product_size,
         CONCAT(u.first_name, ' ', u.last_name) AS assigned_to_name
       FROM production_orders po
       JOIN finished_products fp ON fp.id = po.finished_product_id
       LEFT JOIN users u ON u.id = po.assigned_to
       WHERE po.id = :id`,
      { id }
    )
    const item = Array.isArray(rows) ? rows[0] : rows
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: item })
  } catch (err) {
    console.error('GET production order by id error', err)
    return NextResponse.json({ error: 'Failed to fetch production order' }, { status: 500 })
  }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idRaw } = await context.params
    const id = idParam.parse(idRaw)
    const json = await req.json()
    const parsed = updateSchema.parse(json)
    const toDateOrNull = (v?: string | null) => (v && v.trim() ? v : null)
    const data: any = { ...parsed }
    if ('start_date' in data) data.start_date = toDateOrNull(data.start_date)
    if ('expected_completion_date' in data) data.expected_completion_date = toDateOrNull(data.expected_completion_date)
    if ('actual_completion_date' in data) data.actual_completion_date = toDateOrNull(data.actual_completion_date)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const db = getDb()
    const assignments = Object.keys(data).map((k) => `${k} = :${k}`).join(', ')
    const [result] = await db.execute(
      `UPDATE production_orders SET ${assignments} WHERE id = :id`,
      { ...(data as any), id }
    )

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [rows] = await db.query(
      `SELECT 
         po.id, po.order_number, po.finished_product_id, po.quantity_ordered, po.quantity_produced, po.status, po.priority,
         po.start_date, po.expected_completion_date, po.actual_completion_date, po.assigned_to, po.notes,
         po.created_at, po.updated_at,
         fp.sku AS product_sku, fp.name AS product_name, fp.size AS product_size,
         CONCAT(u.first_name, ' ', u.last_name) AS assigned_to_name
       FROM production_orders po
       JOIN finished_products fp ON fp.id = po.finished_product_id
       LEFT JOIN users u ON u.id = po.assigned_to
       WHERE po.id = :id`,
      { id }
    )

    return NextResponse.json({ data: Array.isArray(rows) ? rows[0] : rows })
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('PUT production order error', err)
    return NextResponse.json({ error: 'Failed to update production order' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idRaw } = await context.params
    const id = idParam.parse(idRaw)
    const db = getDb()
    const [result] = await db.execute('DELETE FROM production_orders WHERE id = :id', { id })
    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE production order error', err)
    return NextResponse.json({ error: 'Failed to delete production order' }, { status: 500 })
  }
}

