import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const patchSchema = z.object({
  status: z.enum(['pending', 'received', 'partial', 'cancelled']),
})

// In Next.js App Router, `params` may be a Promise in route handlers.
// Await it before accessing properties to avoid the "params is a Promise" error.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const { id: idStr } = (ctx.params instanceof Promise) ? await ctx.params : (ctx.params as { id: string })
    const id = Number(idStr)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const body = await req.json()
    const parsed = patchSchema.parse(body)
    const db = getDb()
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      // Load current PO
      const [poRows] = await conn.query(
        'SELECT id, po_number, status FROM purchase_orders WHERE id = :id FOR UPDATE',
        { id }
      ) as any
      const po = Array.isArray(poRows) && poRows[0]
      if (!po) {
        throw new Error('Purchase order not found')
      }

      // If marking as received, receive remaining quantities for all items
      if (parsed.status === 'received' && po.status !== 'received') {
        // For each item, compute delta and post to inventory
        const [items] = await conn.query(
          'SELECT id, raw_material_id, quantity_ordered, quantity_received FROM purchase_order_items WHERE purchase_order_id = :id',
          { id }
        ) as any

        for (const it of items || []) {
          const delta = Math.max(0, Number(it.quantity_ordered) - Number(it.quantity_received || 0))
          if (delta > 0) {
            // Update item received qty
            await conn.execute(
              'UPDATE purchase_order_items SET quantity_received = quantity_received + :delta WHERE id = :id',
              { delta, id: it.id }
            )
            // Update inventory quantity_on_hand
            await conn.execute(
              'UPDATE raw_materials SET quantity_on_hand = quantity_on_hand + :delta WHERE id = :rmid',
              { delta, rmid: it.raw_material_id }
            )
            // Insert inventory transaction
            await conn.execute(
              `INSERT INTO inventory_transactions (transaction_type, product_id, product_type, quantity, reference_id, reference_type, notes, recorded_by)
               VALUES ('purchase', :product_id, 'raw_material', :qty, :po_id, 'purchase_order', :notes, NULL)`,
              {
                product_id: it.raw_material_id,
                qty: delta,
                po_id: id,
                notes: `PO receive ${po.po_number}`,
              } as any
            )
          }
        }

        // Update PO header status and actual delivery date
        await conn.execute(
          'UPDATE purchase_orders SET status = :status, actual_delivery_date = CURRENT_DATE WHERE id = :id',
          { status: 'received', id }
        )
      } else {
        // Other status changes: only update status
        await conn.execute(
          'UPDATE purchase_orders SET status = :status WHERE id = :id',
          { status: parsed.status, id }
        )
      }

      await conn.commit()

      const [rows] = await db.query(
        `SELECT po.id, po.po_number, po.status, po.total_cost, po.order_date, po.actual_delivery_date, s.supplier_name
           FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = :id`,
        { id }
      )
      return NextResponse.json({ data: Array.isArray(rows) ? rows[0] : rows })
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
    console.error('PATCH purchase order status error', err)
    return NextResponse.json({ error: 'Failed to update status', detail: err?.message }, { status: 500 })
  }
}
