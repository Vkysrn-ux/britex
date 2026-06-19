import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const bodySchema = z.object({
  supplierId: z.coerce.number().int().positive(),
  inputSku: z.string().min(1),
  qtyKg: z.coerce.number().positive(),
  dcNo: z.string().min(1),
  gsm: z.coerce.number().positive().optional().nullable(),
  widthCm: z.coerce.number().positive().optional().nullable(),
  outputSku: z.string().min(1).optional().nullable(),
  expectedOutputQty: z.coerce.number().nonnegative().optional().nullable(),
  userId: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  scNumber: z.string().min(1).optional().nullable(),
})

function genScNumber() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `SC-${y}${m}${day}-${rand}`
}

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = bodySchema.parse(json)
    const db = getDb()

    // Resolve or create the knitting process definition
    let processId: number | null = null
    {
      const [pRows] = await db.query(`SELECT id FROM process_definitions WHERE name = 'knitting' LIMIT 1`)
      const p = Array.isArray(pRows) ? (pRows as any[])[0] : (pRows as any)
      if (p && p.id) {
        processId = Number(p.id)
      } else {
        const [ins] = await db.execute(
          `INSERT INTO process_definitions (name, default_loss_percent, notes) VALUES ('knitting', 0, 'Auto-created')`
        )
        processId = Number((ins as any).insertId)
      }
    }

    // Ensure input SKU exists and is a raw material (we validate by existence only; DB procs will enforce types)
    const [inRows] = await db.query('SELECT id, unit FROM raw_materials WHERE sku = :sku LIMIT 1', { sku: parsed.inputSku })
    const inProd = Array.isArray(inRows) ? (inRows as any[])[0] : (inRows as any)
    if (!inProd) {
      return NextResponse.json({ error: 'Input raw material SKU not found' }, { status: 404 })
    }

    // Determine output SKU: use provided or fallback to a placeholder greige fabric
    let outputSku = parsed.outputSku?.trim() || 'FAB-GREIGE'
    // Ensure output product exists in finished_products; if not, create a minimal placeholder
    let outProd: any
    {
      const [outRows] = await db.query('SELECT id FROM finished_products WHERE sku = :sku LIMIT 1', { sku: outputSku })
      outProd = Array.isArray(outRows) ? (outRows as any[])[0] : (outRows as any)
      if (!outProd) {
        const [ins] = await db.execute(
          `INSERT INTO finished_products (sku, name, product_type, size, quantity_on_hand, reorder_level, unit_cost, unit_price, status)
           VALUES (:sku, :name, 'mattress', 'roll', 0, 0, 0, 0, 'active')`,
          { sku: outputSku, name: 'Greige Knit Fabric' }
        )
        const id = (ins as any).insertId
        const [fetch] = await db.query('SELECT id FROM finished_products WHERE id = :id', { id })
        outProd = Array.isArray(fetch) ? (fetch as any[])[0] : (fetch as any)
      }
    }

    // Ensure supplier exists (quick check)
    {
      const [sRows] = await db.query('SELECT id FROM suppliers WHERE id = :id LIMIT 1', { id: parsed.supplierId })
      const s = Array.isArray(sRows) ? (sRows as any[])[0] : (sRows as any)
      if (!s) {
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
      }
    }

    // Build SC number
    const scNumber = (parsed.scNumber && parsed.scNumber.trim()) || genScNumber()

    // Create subcontract order (header) via SP or inline fallback
    try {
      await db.query(
        'CALL sp_create_subcontract_order(:sc_number, :supplier_id, :process_name, :input_sku, :input_type, :input_uom, :planned_input_qty, :output_sku, :output_type, :output_uom, :expected_output_qty, :planned_loss_percent, :user_id, :notes)'.replace(/\n/g, ' '),
        {
          sc_number: scNumber,
          supplier_id: parsed.supplierId,
          process_name: 'knitting',
          input_sku: parsed.inputSku,
          input_type: 'raw_material',
          input_uom: 'kg',
          planned_input_qty: parsed.qtyKg,
          output_sku: outputSku,
          output_type: 'finished_product',
          output_uom: 'm',
          expected_output_qty: parsed.expectedOutputQty ?? 0,
          planned_loss_percent: 0,
          user_id: parsed.userId ?? null,
          notes: parsed.notes ?? null,
        } as any
      )
    } catch (e: any) {
      const code = e?.code || e?.errno
      const msg = String(e?.sqlMessage || e?.message || '')
      if (code === 1305 || msg.toLowerCase().includes('does not exist')) {
        // Inline fallback insert
        await db.execute(
          `INSERT INTO subcontract_orders (
             sc_number, supplier_id, process_id,
             input_product_id, input_product_type, input_uom, planned_input_qty,
             output_product_id, output_product_type, output_uom, expected_output_qty,
             planned_loss_percent, status, order_date, notes, created_by
           ) VALUES (
             :sc, :supplier, :process,
             :in_id, 'raw_material', 'kg', :in_qty,
             :out_id, 'finished_product', 'm', :exp_out,
             0, 'draft', CURRENT_DATE, :notes, :user
           )
           ON CONFLICT (sc_number) DO NOTHING`,
          {
            sc: scNumber,
            supplier: parsed.supplierId,
            process: processId,
            in_id: inProd.id,
            in_qty: parsed.qtyKg,
            out_id: outProd.id,
            exp_out: parsed.expectedOutputQty ?? 0,
            notes: parsed.notes ?? null,
            user: parsed.userId ?? null,
          } as any
        )
      } else {
        throw e
      }
    }

    // Issue quantity on a DC (Delivery Challan) via SP or inline fallback
    try {
      await db.query(
        'CALL sp_issue_to_subcontract(:sc_number, :issue_qty, :lot_no, :gsm, :width_cm, :user_id, :note)'.replace(/\n/g, ' '),
        {
          sc_number: scNumber,
          issue_qty: parsed.qtyKg,
          lot_no: parsed.dcNo,
          gsm: parsed.gsm ?? null,
          width_cm: parsed.widthCm ?? null,
          user_id: parsed.userId ?? null,
          note: parsed.notes ?? null,
        } as any
      )
    } catch (e: any) {
      const code = e?.code || e?.errno
      const msg = String(e?.sqlMessage || e?.message || '')
      if (code === 1305 || msg.toLowerCase().includes('does not exist')) {
        const conn = await db.getConnection()
        try {
          await conn.beginTransaction()
          // Lock and verify stock
          const [stockRows] = await conn.query(
            'SELECT id, quantity_on_hand FROM raw_materials WHERE id = :id LIMIT 1 FOR UPDATE',
            { id: inProd.id }
          )
          const stock = Array.isArray(stockRows) ? (stockRows as any[])[0] : (stockRows as any)
          if (!stock) { throw new Error('Raw material not found during issue') }
          if (Number(stock.quantity_on_hand) < Number(parsed.qtyKg)) {
            await conn.rollback()
            return NextResponse.json({ error: 'Insufficient inventory to issue' }, { status: 400 })
          }

          // Get subcontract order id
          const [ordRows] = await conn.query(
            'SELECT id, input_uom FROM subcontract_orders WHERE sc_number = :sc LIMIT 1 FOR UPDATE',
            { sc: scNumber }
          )
          const sc = Array.isArray(ordRows) ? (ordRows as any[])[0] : (ordRows as any)
          if (!sc) { throw new Error('Subcontract order not found after create') }

          // Decrement inventory
          await conn.query(
            'UPDATE raw_materials SET quantity_on_hand = quantity_on_hand - :qty WHERE id = :id',
            { qty: parsed.qtyKg, id: inProd.id }
          )

          // Inventory transaction using a safe type when enum might not be extended yet
          await conn.query(
            `INSERT INTO inventory_transactions (transaction_type, product_id, product_type, quantity, reference_id, reference_type, notes, recorded_by)
             VALUES ('adjustment', :pid, 'raw_material', :qty, :ref_id, 'subcontract_order', :notes, :user_id)`,
            {
              pid: inProd.id,
              qty: parsed.qtyKg,
              ref_id: sc.id,
              notes: `subcontract_issue (fallback) to ${scNumber}${parsed.dcNo ? ' DC ' + parsed.dcNo : ''}${parsed.notes ? ' - ' + parsed.notes : ''}`,
              user_id: parsed.userId ?? null,
            }
          )

          // Log DC issue
          await conn.query(
            `INSERT INTO subcontract_order_issues (subcontract_order_id, product_id, product_type, uom, qty, lot_no, spec_snapshot_json, note, created_by)
             VALUES (:sc_id, :pid, 'raw_material', 'kg', :qty, :lot, json_build_object('gsm', :gsm, 'width_cm', :width), :note, :user_id)`,
            {
              sc_id: sc.id,
              pid: inProd.id,
              qty: parsed.qtyKg,
              lot: parsed.dcNo,
              gsm: parsed.gsm ?? null,
              width: parsed.widthCm ?? null,
              note: parsed.notes ?? null,
              user_id: parsed.userId ?? null,
            }
          )

          // Update order status
          await conn.query(
            `UPDATE subcontract_orders SET status = CASE WHEN status = 'draft' THEN 'issued' ELSE status END WHERE id = :id`,
            { id: sc.id }
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

    // Respond with created header basics
    return NextResponse.json({ ok: true, scNumber }, { status: 201 })
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('POST knitting issue error', err)
    const msg = err?.sqlMessage || err?.message || 'Failed to issue to knitting'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
