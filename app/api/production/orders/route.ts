import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const createSchema = z.object({
  order_number: z.string().min(1),
  finished_product_id: z.coerce.number().int().positive(),
  quantity_ordered: z.coerce.number().int().positive(),
  quantity_produced: z.coerce.number().int().nonnegative().optional().default(0),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional().default('pending'),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  start_date: z.string().optional().nullable(),
  expected_completion_date: z.string().optional().nullable(),
  assigned_to: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
})

// GET /api/production/orders?search=&status=&page=&pageSize=
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status')?.trim() || ''
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 20)))
    const offset = (page - 1) * pageSize

    const db = getDb()

    const whereClauses: string[] = []
    const params: any = { limit: pageSize, offset }
    if (q) {
      whereClauses.push('(po.order_number LIKE :q OR fp.name LIKE :q)')
      params.q = `%${q}%`
    }
    if (status) {
      whereClauses.push('po.status = :status')
      params.status = status
    }
    const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

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
       ${where}
       ORDER BY po.created_at DESC
       LIMIT :limit OFFSET :offset`,
      params
    )

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total
         FROM production_orders po
         JOIN finished_products fp ON fp.id = po.finished_product_id
         ${where}`,
      params
    )
    const total = Array.isArray(countRows) ? (countRows as any)[0]?.total ?? 0 : 0

    return NextResponse.json({ data: rows, page, pageSize, total })
  } catch (err) {
    console.error('GET production orders error', err)
    return NextResponse.json({ error: 'Failed to fetch production orders' }, { status: 500 })
  }
}

// POST /api/production/orders
export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = createSchema.parse(json)
    const db = getDb()
    // Normalize optional fields: mysql2 does not accept undefined in bindings
    const toDateOrNull = (v?: string | null) => (v && v.trim() ? v : null)
    const params = {
      order_number: parsed.order_number,
      finished_product_id: parsed.finished_product_id,
      quantity_ordered: parsed.quantity_ordered,
      quantity_produced: parsed.quantity_produced ?? 0,
      status: parsed.status ?? 'pending',
      priority: parsed.priority ?? 'medium',
      start_date: toDateOrNull(parsed.start_date),
      expected_completion_date: toDateOrNull(parsed.expected_completion_date),
      assigned_to: parsed.assigned_to ?? null,
      notes: parsed.notes ?? null,
    }
    const [result] = await db.execute(
      `INSERT INTO production_orders 
         (order_number, finished_product_id, quantity_ordered, quantity_produced, status, priority, start_date, expected_completion_date, assigned_to, notes)
       VALUES
         (:order_number, :finished_product_id, :quantity_ordered, :quantity_produced, :status, :priority, :start_date, :expected_completion_date, :assigned_to, :notes)`,
      params as any
    )
    const insertId = (result as any).insertId

    // Prefill material allocations from BOM so the detail view has required quantities
    try {
      await db.query('CALL sp_allocate_from_bom(:order_number)', { order_number: params.order_number })
    } catch (e) {
      // Non-fatal if procedure not present
      console.warn('sp_allocate_from_bom failed or missing', e)
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
      { id: insertId }
    )
    return NextResponse.json({ data: Array.isArray(rows) ? rows[0] : rows }, { status: 201 })
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('POST production order error', err)
    return NextResponse.json({ error: 'Failed to create production order', detail: err?.message }, { status: 500 })
  }
}
