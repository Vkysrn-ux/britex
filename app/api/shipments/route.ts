import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const postSchema = z.object({
  destinationType: z.enum(['customer','showroom','warehouse']),
  destinationRef: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    qty: z.coerce.number().int().positive(),
    orderId: z.coerce.number().int().positive().optional().nullable(),
    orderItemId: z.coerce.number().int().positive().optional().nullable(),
  })).min(1)
})

export async function GET(req: Request) {
  try {
    const db = getDb()
    const [rows] = await db.query(
      `SELECT s.id, s.destination_type, s.destination_ref, s.status, s.ship_date, s.notes, s.created_at,
              l.id as line_id, l.finished_product_id, l.quantity,
              fp.sku, fp.name
         FROM outbound_shipments s
         JOIN outbound_shipment_lines l ON l.shipment_id = s.id
         JOIN finished_products fp ON fp.id = l.finished_product_id
        ORDER BY s.created_at DESC, s.id DESC`
    )
    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('GET shipments error', err)
    return NextResponse.json({ error: 'Failed to fetch shipments' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = postSchema.parse(json)
    const db = getDb()
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      const [res] = await conn.execute(
        `INSERT INTO outbound_shipments (destination_type, destination_ref, status, ship_date, notes)
         VALUES (:dt, :dr, 'shipped', CURRENT_DATE, :notes)`,
        { dt: parsed.destinationType, dr: parsed.destinationRef ?? null, notes: parsed.notes ?? null } as any
      )
      const shipmentId = (res as any).insertId

      for (const ln of parsed.lines) {
        // Lock product
        const [pRows] = await conn.query('SELECT id, quantity_on_hand FROM finished_products WHERE id = :id FOR UPDATE', { id: ln.productId })
        const prod = Array.isArray(pRows) ? (pRows as any[])[0] : (pRows as any)
        if (!prod) { await conn.rollback(); return NextResponse.json({ error: 'Product not found' }, { status: 404 }) }
        if (Number(prod.quantity_on_hand) < ln.qty) { await conn.rollback(); return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 }) }

        await conn.execute(
          `INSERT INTO outbound_shipment_lines (shipment_id, finished_product_id, quantity, customer_order_id, customer_order_item_id)
           VALUES (:sid, :pid, :qty, :oid, :oiid)`,
          { sid: shipmentId, pid: ln.productId, qty: ln.qty, oid: ln.orderId ?? null, oiid: ln.orderItemId ?? null } as any
        )

        // If linked to order item and destination is customer, update shipped counts
        if (parsed.destinationType === 'customer' && ln.orderItemId) {
          const [oiRows] = await conn.query(
            `SELECT customer_order_id, quantity_ordered, quantity_shipped
               FROM customer_order_items WHERE id = :id FOR UPDATE`,
            { id: ln.orderItemId }
          )
          const item = Array.isArray(oiRows) ? (oiRows as any[])[0] : (oiRows as any)
          if (!item) { await conn.rollback(); return NextResponse.json({ error: 'Order item not found' }, { status: 404 }) }
          const outstanding = Number(item.quantity_ordered) - Number(item.quantity_shipped)
          if (ln.qty > outstanding) { await conn.rollback(); return NextResponse.json({ error: 'Quantity exceeds outstanding' }, { status: 400 }) }
          await conn.execute('UPDATE customer_order_items SET quantity_shipped = quantity_shipped + :q WHERE id = :id', { q: ln.qty, id: ln.orderItemId })

          // Consume reservation first to avoid double stock decrement
          const [resvRows] = await conn.query(
            `SELECT qty_reserved FROM order_item_reservations WHERE customer_order_item_id = :oiid AND finished_product_id = :pid FOR UPDATE`,
            { oiid: ln.orderItemId, pid: ln.productId }
          )
          const resv = Array.isArray(resvRows) ? (resvRows as any[])[0] : (resvRows as any)
          const reservedQty = Number(resv?.qty_reserved || 0)
          const fromReserve = Math.min(reservedQty, ln.qty)
          const extra = Math.max(0, ln.qty - fromReserve)
          if (fromReserve > 0) {
            await conn.execute(
              `UPDATE order_item_reservations SET qty_reserved = qty_reserved - :consumed WHERE customer_order_item_id = :oiid AND finished_product_id = :pid`,
              { consumed: fromReserve, oiid: ln.orderItemId, pid: ln.productId }
            )
          }
          if (extra > 0) {
            await conn.execute('UPDATE finished_products SET quantity_on_hand = quantity_on_hand - :q WHERE id = :pid', { q: extra, pid: ln.productId })
          }
        } else {
          // Non-customer shipments reduce stock directly
          await conn.execute('UPDATE finished_products SET quantity_on_hand = quantity_on_hand - :q WHERE id = :pid', { q: ln.qty, id: ln.productId })
        }

        // Inventory transaction
        const refType = parsed.destinationType === 'customer' ? 'customer_order' : 'shipment'
        const txType = parsed.destinationType === 'customer' ? 'sale' : 'adjustment'
        await conn.execute(
          `INSERT INTO inventory_transactions (transaction_type, product_id, product_type, quantity, reference_id, reference_type, notes, recorded_by)
           VALUES (:tt, :pid, 'finished_product', :qty, :refId, :refType, :notes, NULL)`,
          { tt: txType, pid: ln.productId, qty: ln.qty, refId: shipmentId, refType, notes: `${parsed.destinationType.toUpperCase()} shipment ${parsed.destinationRef || ''}` } as any
        )
      }

      await conn.commit()
      return NextResponse.json({ ok: true, id: shipmentId })
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
    console.error('POST shipments error', err)
    return NextResponse.json({ error: err?.message || 'Failed to create shipment' }, { status: 500 })
  }
}
