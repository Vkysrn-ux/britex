import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const bodySchema = z.object({
  scNumber: z.string().min(1),
  qty: z.coerce.number().nonnegative(),
  wasteQty: z.coerce.number().nonnegative().optional().nullable(),
  lotNo: z.string().optional().nullable(),
  measuredLossPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  userId: z.coerce.number().int().optional().nullable(),
  note: z.string().optional().nullable(),
})

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.parse(await req.json())
    const db = getDb()

    // Compute measured loss percent if not provided and waste given
    let measured = parsed.measuredLossPercent ?? null
    if (measured == null && typeof parsed.wasteQty === 'number') {
      const denom = (parsed.qty || 0) + (parsed.wasteQty || 0)
      measured = denom > 0 ? Number(((parsed.wasteQty! / denom) * 100).toFixed(2)) : 0
    }

    try {
      await db.query(
        'CALL sp_receive_from_subcontract(:sc, :outQty, :waste, :lossPct, :lot, :user, :note)'.replace(/\n/g,' '),
        { sc: parsed.scNumber, outQty: parsed.qty, waste: parsed.wasteQty ?? 0, lossPct: measured ?? 0, lot: parsed.lotNo ?? null, user: parsed.userId ?? null, note: parsed.note ?? null } as any
      )
    } catch (e: any) {
      const code = e?.code || e?.errno
      const msg = String(e?.sqlMessage || e?.message || '')
      if (code !== 1305 && !msg.toLowerCase().includes('does not exist')) throw e
      // Stored procedure is missing. Perform a safe inline fallback that mirrors
      // the SP behaviour: increment inventory, log transactions and receipt rows.
      const conn = await db.getConnection()
      try {
        await conn.beginTransaction()

        // Lock the subcontract order and target product row for consistency
        const [soRows] = await conn.query(
          'SELECT id, output_product_id, output_product_type, output_uom FROM subcontract_orders WHERE sc_number = :sc LIMIT 1 FOR UPDATE',
          { sc: parsed.scNumber }
        )
        const so = Array.isArray(soRows) ? (soRows as any[])[0] : (soRows as any)
        if (!so) throw new Error('Subcontract order not found')

        const prodId = Number(so.output_product_id)
        const prodType = String(so.output_product_type)
        const uom = String(so.output_uom || 'm')

        // Increment inventory for the output product
        if (parsed.qty > 0) {
          if (prodType === 'raw_material') {
            await conn.query(
              'UPDATE raw_materials SET quantity_on_hand = quantity_on_hand + :q WHERE id = :id',
              { q: parsed.qty, id: prodId }
            )
          } else {
            await conn.query(
              'UPDATE finished_products SET quantity_on_hand = quantity_on_hand + :q WHERE id = :id',
              { q: parsed.qty, id: prodId }
            )
          }

          const [txRes] = await conn.query(
            `INSERT INTO inventory_transactions (transaction_type, product_id, product_type, quantity, reference_id, reference_type, notes, recorded_by)
             VALUES ('subcontract_receipt', :pid, :ptype, :qty, :ref, 'subcontract_order', :notes, :user)`,
            {
              pid: prodId,
              ptype: prodType,
              qty: parsed.qty,
              ref: so.id,
              notes: `Receipt from SC ${parsed.scNumber}${parsed.lotNo ? ' - ' + parsed.lotNo : ''}${parsed.note ? ' - ' + parsed.note : ''}`,
              user: parsed.userId ?? null,
            }
          )
          const txnId = (txRes as any)?.insertId ?? null

          // Record the receipt row for traceability
          await conn.query(
            `INSERT INTO subcontract_order_receipts (subcontract_order_id, product_id, product_type, uom, qty, waste_qty, measured_loss_percent, lot_no, spec_snapshot_json, inventory_txn_id, note, created_by)
             VALUES (:scid, :pid, :ptype, :uom, :qty, :waste, :mlp, :lot, json_build_object('uom', :uom), :txid, :note, :user)`,
            {
              scid: so.id,
              pid: prodId,
              ptype: prodType,
              uom,
              qty: parsed.qty,
              waste: parsed.wasteQty ?? 0,
              mlp: measured ?? 0,
              lot: parsed.lotNo ?? null,
              txid: txnId,
              note: parsed.note ?? null,
              user: parsed.userId ?? null,
            }
          )
        }

        if (parsed.wasteQty && parsed.wasteQty > 0) {
          await conn.query(
            `INSERT INTO inventory_transactions (transaction_type, product_id, product_type, quantity, reference_id, reference_type, notes, recorded_by)
             VALUES ('process_loss', :pid, :ptype, :qty, :ref, 'subcontract_order', :notes, :user)`,
            {
              pid: prodId,
              ptype: prodType,
              qty: parsed.wasteQty,
              ref: so.id,
              notes: `Process loss for ${parsed.scNumber}`,
              user: parsed.userId ?? null,
            }
          )
        }

        await conn.query(
          `UPDATE subcontract_orders SET status = CASE WHEN status IN ('draft','issued') THEN 'received' ELSE status END WHERE id = :id`,
          { id: so.id }
        )

        await conn.commit()
      } catch (txErr) {
        try { await (conn as any).rollback() } catch {}
        throw txErr
      } finally {
        conn.release()
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('POST subcontract receive error', err)
    return NextResponse.json({ error: err?.message || 'Failed to receive subcontract order' }, { status: 500 })
  }
}
