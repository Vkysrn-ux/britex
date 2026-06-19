import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const schema = z.object({ itemId: z.coerce.number().int().positive(), qty: z.coerce.number().int().positive() })

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const { itemId, qty } = schema.parse(json)
    const db = getDb()
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      // Load item, order, product with locks
      const [rows] = await conn.query(
        `SELECT coi.id AS item_id, coi.customer_order_id, coi.finished_product_id,
                coi.quantity_ordered, coi.quantity_shipped,
                (coi.quantity_ordered - coi.quantity_shipped) AS outstanding,
                co.id AS order_id, co.order_number, co.status,
                fp.id AS product_id, fp.quantity_on_hand
           FROM customer_order_items coi
           JOIN customer_orders co ON co.id = coi.customer_order_id
           JOIN finished_products fp ON fp.id = coi.finished_product_id
          WHERE coi.id = :id FOR UPDATE`,
        { id: itemId }
      )
      const row = Array.isArray(rows) ? (rows as any[])[0] : (rows as any)
      if (!row) {
        await conn.rollback()
        return NextResponse.json({ error: 'Item not found' }, { status: 404 })
      }
      const outstanding = Number(row.outstanding || 0)
      const onHand = Number(row.quantity_on_hand || 0)
      if (qty > outstanding) {
        await conn.rollback()
        return NextResponse.json({ error: 'Quantity exceeds outstanding' }, { status: 400 })
      }
      if (qty > onHand) {
        await conn.rollback()
        return NextResponse.json({ error: 'Insufficient finished goods stock' }, { status: 400 })
      }

      // Reserve only: reduce finished stock now and mark reservation, do NOT change quantity_shipped
      await conn.query(
        `UPDATE finished_products SET quantity_on_hand = quantity_on_hand - :qty WHERE id = :pid`,
        { qty, pid: row.product_id }
      )
      await conn.query(
        `INSERT INTO order_item_reservations (customer_order_item_id, finished_product_id, qty_reserved)
         VALUES (:oiid, :pid, :qty)
         ON CONFLICT (customer_order_item_id, finished_product_id) DO UPDATE SET qty_reserved = order_item_reservations.qty_reserved + EXCLUDED.qty_reserved`,
        { oiid: row.item_id, pid: row.product_id, qty }
      )
      // If order is pending, mark processing
      if (row.status === 'pending') {
        await conn.query(`UPDATE customer_orders SET status = 'processing' WHERE id = :oid`, { oid: row.order_id })
      }

      await conn.commit()
      return NextResponse.json({ ok: true })
    } catch (err) {
      try { await (conn as any).rollback() } catch {}
      throw err
    } finally {
      conn.release()
    }
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('POST dispatch allocate error', err)
    return NextResponse.json({ error: err?.message || 'Failed to allocate' }, { status: 500 })
  }
}
