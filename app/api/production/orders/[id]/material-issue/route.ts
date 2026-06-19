import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const idParam = z.coerce.number().int().positive()
const bodySchema = z.object({
  sku: z.string().min(1),
  qty: z.coerce.number().positive(),
  note: z.string().optional().nullable(),
  userId: z.coerce.number().int().optional().nullable(),
})

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idRaw } = await context.params
    const id = idParam.parse(idRaw)
    const json = await req.json()
    const parsed = bodySchema.parse(json)
    const db = getDb()

    // Get order number to feed the stored procedure
    const [orderRows] = await db.query(
      'SELECT id, order_number FROM production_orders WHERE id = :id LIMIT 1',
      { id }
    )
    const order = Array.isArray(orderRows) ? (orderRows as any[])[0] : (orderRows as any)
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Try stored procedure first; if missing, fall back to inline transaction
    try {
      await db.query(
        'CALL sp_issue_material_from_inventory(:order_number, :sku, :qty, :user_id, :note)',
        {
          order_number: order.order_number,
          sku: parsed.sku,
          qty: parsed.qty,
          user_id: parsed.userId ?? null,
          note: parsed.note ?? null,
        } as any
      )
    } catch (e: any) {
      const msg = String(e?.sqlMessage || e?.message || '')
      const code = e?.code || e?.errno
      // ER_SP_DOES_NOT_EXIST = 1305
      if (code === 1305 || msg.toLowerCase().includes('does not exist')) {
        const conn = await db.getConnection()
        try {
          await conn.beginTransaction()
          // Lock material row and validate
          const [rmRows] = await conn.query(
            'SELECT id, unit, quantity_on_hand FROM raw_materials WHERE sku = :sku LIMIT 1 FOR UPDATE',
            { sku: parsed.sku }
          )
          const rm = Array.isArray(rmRows) ? (rmRows as any[])[0] : (rmRows as any)
          if (!rm) {
            await conn.rollback()
            return NextResponse.json({ error: 'Raw material SKU not found' }, { status: 404 })
          }
          if (Number(rm.quantity_on_hand) < Number(parsed.qty)) {
            await conn.rollback()
            return NextResponse.json({ error: 'Insufficient inventory' }, { status: 400 })
          }

          // Ensure allocation row exists
          await conn.query(
            `INSERT INTO production_material_allocations (production_order_id, raw_material_id, unit, required_qty, notes)
             VALUES (:po_id, :rm_id, :unit, 0.0, 'Auto-created by issue')
             ON CONFLICT (production_order_id, raw_material_id) DO UPDATE SET unit = EXCLUDED.unit`,
            { po_id: id, rm_id: rm.id, unit: rm.unit }
          )
          // Fetch allocation id
          const [allocRows] = await conn.query(
            'SELECT id FROM production_material_allocations WHERE production_order_id = :po_id AND raw_material_id = :rm_id LIMIT 1',
            { po_id: id, rm_id: rm.id }
          )
          const alloc = Array.isArray(allocRows) ? (allocRows as any[])[0] : (allocRows as any)

          // Insert movement
          await conn.query(
            `INSERT INTO production_material_movements (allocation_id, production_order_id, raw_material_id, movement, quantity, note, created_by)
             VALUES (:alloc_id, :po_id, :rm_id, 'issue', :qty, :note, :user_id)`,
            { alloc_id: alloc.id, po_id: id, rm_id: rm.id, qty: parsed.qty, note: parsed.note ?? null, user_id: parsed.userId ?? null }
          )

          // Decrement inventory
          await conn.query(
            'UPDATE raw_materials SET quantity_on_hand = quantity_on_hand - :qty WHERE id = :rm_id',
            { qty: parsed.qty, rm_id: rm.id }
          )

          // Inventory transaction
          await conn.query(
            `INSERT INTO inventory_transactions (transaction_type, product_id, product_type, quantity, reference_id, reference_type, notes, recorded_by)
             VALUES ('production', :rm_id, 'raw_material', :qty, :po_id, 'production_order', :notes, :user_id)`,
            {
              rm_id: rm.id,
              qty: parsed.qty,
              po_id: id,
              notes: `Issue to order ${order.order_number}${parsed.note ? ' - ' + parsed.note : ''}`,
              user_id: parsed.userId ?? null,
            }
          )

          // Update allocation rollups
          await conn.query(
            `UPDATE production_material_allocations AS a
             SET allocated_qty = COALESCE(m.allocated,0),
                 consumed_qty = COALESCE(m.consumed,0),
                 waste_qty = COALESCE(m.wasted,0)
             FROM (
               SELECT production_order_id, raw_material_id,
                      SUM(CASE WHEN movement='issue' THEN quantity WHEN movement='return' THEN -quantity ELSE 0 END) AS allocated,
                      SUM(CASE WHEN movement='consume' THEN quantity ELSE 0 END) AS consumed,
                      SUM(CASE WHEN movement='waste' THEN quantity ELSE 0 END) AS wasted
                 FROM production_material_movements
                WHERE production_order_id = :po_id AND raw_material_id = :rm_id
                GROUP BY production_order_id, raw_material_id
             ) m
             WHERE a.production_order_id = m.production_order_id
               AND a.raw_material_id = m.raw_material_id`,
            { po_id: id, rm_id: rm.id }
          )

          await conn.commit()
        } catch (txErr) {
          try { await (conn as any).rollback() } catch {}
          throw txErr
        } finally {
          conn.release()
        }
      } else {
        throw e
      }
    }

    // Return the updated line from the live status view
    const [rows] = await db.query(
      `SELECT raw_material_id, raw_material_sku, raw_material_name, unit,
              required_qty, allocated_qty, consumed_qty, waste_qty, on_floor_qty, fulfillment_percent
         FROM v_production_material_status
        WHERE production_order_id = :id AND raw_material_sku = :sku
        LIMIT 1`,
      { id, sku: parsed.sku }
    )
    const line = Array.isArray(rows) ? (rows as any[])[0] : (rows as any)
    return NextResponse.json({ ok: true, line })
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('POST material-issue error', err)
    const msg = err?.sqlMessage || err?.message || 'Failed to issue material'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
