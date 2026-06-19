import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const bodySchema = z.object({
  scNumber: z.string().min(1),
  qtyKg: z.coerce.number().positive().optional().nullable(),
  factor: z.coerce.number().positive().optional().default(Number(process.env.LAMINATION_KG_TO_M_FACTOR || 2.6)),
  userId: z.coerce.number().int().optional().nullable(),
  note: z.string().optional().nullable(),
})

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.parse(await req.json())
    const db = getDb()

    // Read base qty from latest issue if not provided
    let baseQtyKg = parsed.qtyKg ?? null
    if (baseQtyKg == null) {
      const [rows] = await db.query(
        `SELECT soi.qty
           FROM subcontract_order_issues soi
           JOIN subcontract_orders so ON so.id = soi.subcontract_order_id
          WHERE so.sc_number = :sc
          ORDER BY soi.created_at DESC
          LIMIT 1`,
        { sc: parsed.scNumber }
      )
      const r = Array.isArray(rows) ? (rows as any[])[0] : (rows as any)
      baseQtyKg = Number(r?.qty || 0)
      if (!baseQtyKg || isNaN(baseQtyKg)) return NextResponse.json({ error: 'Unable to resolve base qty for conversion' }, { status: 400 })
    }

    const factor = Number(parsed.factor || process.env.LAMINATION_KG_TO_M_FACTOR || 2.6)
    const meters = Number((baseQtyKg * factor).toFixed(3))

    // Update SC to output in meters then receive
    await db.execute(
      `UPDATE subcontract_orders
          SET output_uom = 'm', expected_output_qty = :m
        WHERE sc_number = :sc`,
      { m: meters, sc: parsed.scNumber }
    )

    try {
      await db.query(
        'CALL sp_receive_from_subcontract(:sc, :outQty, :waste, :lossPct, :lot, :user, :note)'.replace(/\n/g,' '),
        { sc: parsed.scNumber, outQty: meters, waste: 0, lossPct: 0, lot: null, user: parsed.userId ?? null, note: parsed.note ?? 'Direct convert washing kg->m' } as any
      )
    } catch (e: any) {
      const code = e?.code || e?.errno
      const msg = String(e?.sqlMessage || e?.message || '')
      if (code !== 1305 && !msg.toLowerCase().includes('does not exist')) throw e
      // SP missing: inline fallback to increment inventory and log receipt
      const conn = await db.getConnection()
      try {
        await conn.beginTransaction()
        const [soRows] = await conn.query(
          'SELECT id, output_product_id, output_product_type, output_uom FROM subcontract_orders WHERE sc_number = :sc LIMIT 1 FOR UPDATE',
          { sc: parsed.scNumber }
        )
        const so = Array.isArray(soRows) ? (soRows as any[])[0] : (soRows as any)
        if (!so) throw new Error('Subcontract order not found')

        const pid = Number(so.output_product_id)
        const ptype = String(so.output_product_type)
        const uom = 'm'

        if (meters > 0) {
          if (ptype === 'raw_material') {
            await conn.query('UPDATE raw_materials SET quantity_on_hand = quantity_on_hand + :q WHERE id = :id', { q: meters, id: pid })
          } else {
            await conn.query('UPDATE finished_products SET quantity_on_hand = quantity_on_hand + :q WHERE id = :id', { q: meters, id: pid })
          }

          const [txRes] = await conn.query(
            `INSERT INTO inventory_transactions (transaction_type, product_id, product_type, quantity, reference_id, reference_type, notes, recorded_by)
             VALUES ('subcontract_receipt', :pid, :ptype, :qty, :ref, 'subcontract_order', :notes, :user)`,
            { pid, ptype, qty: meters, ref: so.id, notes: parsed.note ?? 'Direct convert washing kg->m', user: parsed.userId ?? null }
          )
          const txnId = (txRes as any)?.insertId ?? null

          await conn.query(
            `INSERT INTO subcontract_order_receipts (subcontract_order_id, product_id, product_type, uom, qty, waste_qty, measured_loss_percent, lot_no, spec_snapshot_json, inventory_txn_id, note, created_by)
             VALUES (:scid, :pid, :ptype, :uom, :qty, 0, 0, NULL, json_build_object('uom', :uom), :txid, :note, :user)`,
            { scid: so.id, pid, ptype, uom, qty: meters, txid: txnId, note: parsed.note ?? null, user: parsed.userId ?? null }
          )
        }

        await conn.query("UPDATE subcontract_orders SET status='received' WHERE id = :id", { id: so.id })
        await conn.commit()
      } catch (txErr) {
        try { await (conn as any).rollback() } catch {}
        throw txErr
      } finally {
        conn.release()
      }
    }

    return NextResponse.json({ ok: true, meters })
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('POST subcontract convert error', err)
    return NextResponse.json({ error: err?.message || 'Failed to convert to inventory' }, { status: 500 })
  }
}
