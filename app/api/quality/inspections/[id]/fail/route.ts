import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const idParam = z.coerce.number().int().positive()
const bodySchema = z.object({ reason: z.string().optional().nullable() }).optional()

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idRaw } = await context.params
    const id = idParam.parse(idRaw)
    const json = await req.json().catch(() => ({}))
    const parsed = bodySchema.parse(json) || {}
    const reason = (parsed as any).reason || null

    const db = getDb()
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      // Lock inspection
      const [rows] = await conn.query(
        `SELECT id, inspection_type, product_id, quantity_failed, status, batch_number
           FROM quality_inspections WHERE id = :id FOR UPDATE`,
        { id }
      )
      const ins = Array.isArray(rows) ? (rows as any[])[0] : (rows as any)
      if (!ins) {
        await conn.rollback()
        return NextResponse.json({ error: 'Inspection not found' }, { status: 404 })
      }
      if (ins.status !== 'pending_review') {
        await conn.rollback()
        return NextResponse.json({ error: 'Inspection already reviewed' }, { status: 400 })
      }

      const failedQty = Number(ins.quantity_failed || 0)

      // Mark as failed
      await conn.query(`UPDATE quality_inspections SET status = 'failed', notes = CONCAT(IFNULL(notes,''), CASE WHEN :r IS NULL OR :r = '' THEN '' ELSE CONCAT(' | Reason: ', :r) END) WHERE id = :id`, { id, r: reason })

      // Optional: log a damage transaction for traceability (no stock decrement because it wasn't added yet)
      if (failedQty > 0) {
        await conn.query(
          `INSERT INTO inventory_transactions (transaction_type, product_id, product_type, quantity, reference_id, reference_type, notes, recorded_by)
           VALUES ('damage', :pid, 'finished_product', :qty, :ref, 'quality_inspection', :notes, NULL)`,
          { pid: ins.product_id, qty: failedQty, ref: id, notes: `QC failed ${ins.batch_number ? '('+ins.batch_number+') ' : ''}${reason ? '- ' + reason : ''}` }
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
    console.error('POST inspection fail error', err)
    return NextResponse.json({ error: err?.message || 'Failed to mark failed' }, { status: 500 })
  }
}

