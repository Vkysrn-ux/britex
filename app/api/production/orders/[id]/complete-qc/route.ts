import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const idParam = z.coerce.number().int().positive()
const bodySchema = z.object({
  producedQty: z.coerce.number().int().nonnegative(),
  batchNumber: z.string().optional().nullable(),
  passedQty: z.coerce.number().int().nonnegative(),
  failedQty: z.coerce.number().int().nonnegative(),
  note: z.string().optional().nullable(),
  inspectorId: z.coerce.number().int().optional().nullable(),
})

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idRaw } = await context.params
    const id = idParam.parse(idRaw)
    const json = await req.json()
    const parsed = bodySchema.parse(json)

    if (parsed.passedQty + parsed.failedQty !== parsed.producedQty) {
      return NextResponse.json({ error: 'Passed + Failed must equal Produced' }, { status: 400 })
    }

    const db = getDb()
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      // Fetch order basic info
      const [orderRows] = await conn.query(
        'SELECT id, order_number, finished_product_id, quantity_ordered FROM production_orders WHERE id = :id LIMIT 1',
        { id }
      )
      const order = Array.isArray(orderRows) ? (orderRows as any[])[0] : (orderRows as any)
      if (!order) {
        await conn.rollback()
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      // Update order as completed
      await conn.query(
        `UPDATE production_orders
            SET quantity_produced = GREATEST(COALESCE(quantity_produced,0), :producedQty),
                status = 'completed',
                actual_completion_date = CURRENT_DATE
          WHERE id = :id`,
        { id, producedQty: parsed.producedQty }
      )

      // Optional production log snapshot
      await conn.query(
        `INSERT INTO production_logs (production_order_id, production_date, quantity_produced, batch_number, notes, logged_by)
         VALUES (:id, CURRENT_DATE, :qty, :batch, :note, :user)`,
        { id, qty: parsed.producedQty, batch: parsed.batchNumber ?? order.order_number, note: parsed.note ?? null, user: parsed.inspectorId ?? null }
      )

      // Create QC record (pending review)
      await conn.query(
        `INSERT INTO quality_inspections (
            inspection_date, inspection_type, product_id, batch_number,
            quantity_inspected, quantity_passed, quantity_failed,
            defect_types, inspector_id, status, notes
         ) VALUES (
            CURRENT_DATE, 'finished_product', :product_id, :batch,
            :inspected, :passed, :failed,
            NULL, :inspector, 'pending_review', :notes
         )`,
        {
          product_id: order.finished_product_id,
          batch: parsed.batchNumber ?? order.order_number,
          inspected: parsed.producedQty,
          passed: parsed.passedQty,
          failed: parsed.failedQty,
          inspector: parsed.inspectorId ?? null,
          notes: (parsed.note ? parsed.note + ' — ' : '') + `From order ${order.order_number}`,
        }
      )

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
    console.error('POST complete-qc error', err)
    return NextResponse.json({ error: err?.message || 'Failed to complete order' }, { status: 500 })
  }
}

