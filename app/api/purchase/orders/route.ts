import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const itemSchema = z.object({
  raw_material_id: z.coerce.number().int().positive(),
  quantity_ordered: z.coerce.number().int().positive(),
  unit_cost: z.coerce.number().nonnegative().default(0),
})

const createSchema = z.object({
  po_number: z.string().min(1).optional(),
  supplier_id: z.coerce.number().int().positive(),
  order_date: z.string().optional().nullable(),
  expected_delivery_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1),
})

function genPoNumber() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `PO-${y}${m}${day}-${rand}`
}

// GET /api/purchase/orders - latest 50 POs
export async function GET() {
  try {
    const db = getDb()
    const [rows] = await db.query(
      `SELECT po.id, po.po_number, po.status, po.total_cost, po.order_date, po.actual_delivery_date, s.supplier_name
         FROM purchase_orders po
         JOIN suppliers s ON s.id = po.supplier_id
        ORDER BY po.order_date DESC
        LIMIT 50`
    )
    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('GET purchase orders error', err)
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 })
  }
}

// POST /api/purchase/orders - create purchase order
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = createSchema.parse(body)
    const db = getDb()
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      const po_number = parsed.po_number && parsed.po_number.trim() ? parsed.po_number.trim() : genPoNumber()
      const itemTotals = parsed.items.map((it) => it.quantity_ordered * (it.unit_cost ?? 0))
      const total_cost = itemTotals.reduce((a, b) => a + b, 0)

      const toDateOrNull = (v?: string | null) => (v && v.trim() ? v : null)

      const [poRes] = await conn.execute(
        `INSERT INTO purchase_orders
           (po_number, supplier_id, order_date, expected_delivery_date, status, total_cost, notes)
         VALUES
           (:po_number, :supplier_id, :order_date, :expected_delivery_date, 'pending', :total_cost, :notes)`,
        {
          po_number,
          supplier_id: parsed.supplier_id,
          order_date: toDateOrNull(parsed.order_date) ?? new Date().toISOString().slice(0, 10),
          expected_delivery_date: toDateOrNull(parsed.expected_delivery_date),
          total_cost,
          notes: parsed.notes ?? null,
        } as any
      )
      const poId = (poRes as any).insertId

      for (const it of parsed.items) {
        const line_total = it.quantity_ordered * (it.unit_cost ?? 0)
        await conn.execute(
          `INSERT INTO purchase_order_items
             (purchase_order_id, raw_material_id, quantity_ordered, quantity_received, unit_cost, line_total)
           VALUES
             (:purchase_order_id, :raw_material_id, :quantity_ordered, 0, :unit_cost, :line_total)`,
          {
            purchase_order_id: poId,
            raw_material_id: it.raw_material_id,
            quantity_ordered: it.quantity_ordered,
            unit_cost: it.unit_cost ?? 0,
            line_total,
          } as any
        )
      }

      await conn.commit()

      const [rows] = await db.query(
        `SELECT po.id, po.po_number, po.status, po.total_cost, po.order_date, po.actual_delivery_date, s.supplier_name
           FROM purchase_orders po
           JOIN suppliers s ON s.id = po.supplier_id
          WHERE po.id = :id`,
        { id: poId }
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
    console.error('POST purchase order error', err)
    return NextResponse.json({ error: 'Failed to create purchase order', detail: err?.message }, { status: 500 })
  }
}
