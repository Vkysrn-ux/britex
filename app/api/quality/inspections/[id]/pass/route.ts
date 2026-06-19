import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const idParam = z.coerce.number().int().positive()

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idRaw } = await context.params
    const id = idParam.parse(idRaw)
    const db = getDb()
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      // Lock inspection row
      const [rows] = await conn.query(
        `SELECT id, inspection_type, product_id, quantity_passed, status, batch_number
           FROM quality_inspections WHERE id = :id FOR UPDATE`,
        { id }
      )
      const ins = Array.isArray(rows) ? (rows as any[])[0] : (rows as any)
      if (!ins) {
        await conn.rollback()
        return NextResponse.json({ error: 'Inspection not found' }, { status: 404 })
      }
      if (ins.inspection_type !== 'finished_product') {
        await conn.rollback()
        return NextResponse.json({ error: 'Only finished product inspections can be dispatched' }, { status: 400 })
      }
      if (ins.status !== 'pending_review') {
        await conn.rollback()
        return NextResponse.json({ error: 'Inspection already reviewed' }, { status: 400 })
      }

      const passedQty = Number(ins.quantity_passed || 0)

      // Mark as passed
      await conn.query(
        `UPDATE quality_inspections SET status = 'passed' WHERE id = :id`,
        { id }
      )

      // Move finished product into inventory (ready for dispatch)
      if (passedQty > 0) {
        await conn.query(
          `UPDATE finished_products SET quantity_on_hand = quantity_on_hand + :qty WHERE id = :pid`,
          { qty: passedQty, pid: ins.product_id }
        )
        await conn.query(
          `INSERT INTO inventory_transactions (transaction_type, product_id, product_type, quantity, reference_id, reference_type, notes, recorded_by)
           VALUES ('production', :pid, 'finished_product', :qty, :ref, 'quality_inspection', :notes, NULL)`,
          { pid: ins.product_id, qty: passedQty, ref: id, notes: `QC passed ${ins.batch_number ? '('+ins.batch_number+') ' : ''}- ready for dispatch` }
        )
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
    console.error('POST inspection pass error', err)
    return NextResponse.json({ error: err?.message || 'Failed to pass inspection' }, { status: 500 })
  }
}

