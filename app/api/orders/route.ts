import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const itemSchema = z.object({
  finished_product_id: z.coerce.number().int().positive(),
  quantity_ordered: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().nonnegative().default(0),
})

const createSchema = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email().optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1),
})

function genOrderNumber() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `CO-${y}${m}${day}-${rand}`
}

// GET /api/orders - simple latest orders list
export async function GET() {
  try {
    const db = getDb()
    const [rows] = await db.query(
      `SELECT co.id, co.order_number, co.customer_name, co.status, co.total_amount, co.order_date
         FROM customer_orders co
        ORDER BY co.order_date DESC
        LIMIT 50`
    )
    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('GET orders error', err)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

// POST /api/orders - create customer order + items
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = createSchema.parse(body)
    const db = getDb()
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      const order_number = genOrderNumber()
      const itemTotals = parsed.items.map((it) => it.quantity_ordered * (it.unit_price ?? 0))
      const total_amount = itemTotals.reduce((a, b) => a + b, 0)

      const [orderResult] = await conn.execute(
        `INSERT INTO customer_orders
           (order_number, customer_name, customer_email, customer_phone, status, total_amount, notes)
         VALUES
           (:order_number, :customer_name, :customer_email, :customer_phone, 'pending', :total_amount, :notes)`,
        {
          order_number,
          customer_name: parsed.customer_name,
          customer_email: parsed.customer_email ?? null,
          customer_phone: parsed.customer_phone ?? null,
          total_amount,
          notes: parsed.notes ?? null,
        } as any
      )
      const orderId = (orderResult as any).insertId

      for (const it of parsed.items) {
        const line_total = it.quantity_ordered * (it.unit_price ?? 0)
        await conn.execute(
          `INSERT INTO customer_order_items
             (customer_order_id, finished_product_id, quantity_ordered, quantity_shipped, unit_price, line_total)
           VALUES
             (:customer_order_id, :finished_product_id, :quantity_ordered, 0, :unit_price, :line_total)`,
          {
            customer_order_id: orderId,
            finished_product_id: it.finished_product_id,
            quantity_ordered: it.quantity_ordered,
            unit_price: it.unit_price ?? 0,
            line_total,
          } as any
        )
      }

      await conn.commit()

      const [rows] = await db.query(
        `SELECT co.id, co.order_number, co.customer_name, co.status, co.total_amount, co.order_date
           FROM customer_orders co WHERE co.id = :id`,
        { id: orderId }
      )
      return NextResponse.json({ data: Array.isArray(rows) ? rows[0] : rows }, { status: 201 })
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('POST order error', err)
    return NextResponse.json({ error: 'Failed to create order', detail: err?.message }, { status: 500 })
  }
}

