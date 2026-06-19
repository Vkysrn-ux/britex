import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const bodySchema = z.object({
  prevScNumber: z.string().min(1),
  nextProcess: z.enum(['washing','dyeing','lamination']),
  qty: z.coerce.number().positive(),
  baseQty: z.coerce.number().positive().optional().nullable(),
  baseDcNo: z.string().min(1),
  dcSuffix: z.coerce.number().int().positive().optional().default(1),
  plannedLossPercent: z.coerce.number().min(0).max(100).optional(),
  dateSent: z.string().optional().nullable(), // ISO date optional
  outputSku: z.string().optional().nullable(),
  userId: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.parse(await req.json())
    const db = getDb()

    const dcNo = `${parsed.baseDcNo}-${String(parsed.dcSuffix)}`
    // planned loss default: 2% for washing, otherwise 0
    let plannedLoss = typeof parsed.plannedLossPercent === 'number'
      ? parsed.plannedLossPercent
      : (parsed.nextProcess === 'washing' ? 2.0 : 0.0)

    // For washing, clamp to configured min/max (defaults 1–3%)
    if (parsed.nextProcess === 'washing') {
      const min = Number(process.env.WASHING_LOSS_MIN || 1)
      const max = Number(process.env.WASHING_LOSS_MAX || 3)
      if (plannedLoss < min) plannedLoss = min
      if (plannedLoss > max) plannedLoss = max
    }

    // Quantity to issue to next process (decrements previous stage)
    // Washing: apply 1–3% loss on base kg before issue
    // Lamination: convert base kg → meters using the business factor (default 2.6)
    // Others: use provided qty verbatim
    let issueQty = (parsed.nextProcess === 'washing' && typeof parsed.baseQty === 'number' && parsed.baseQty > 0)
      ? Number((parsed.baseQty * (1 - plannedLoss / 100)).toFixed(3))
      : parsed.qty

    if (parsed.nextProcess === 'lamination') {
      const baseKg = (typeof parsed.baseQty === 'number' && parsed.baseQty > 0)
        ? parsed.baseQty
        : issueQty
      issueQty = kgToMeters(baseKg)
    }

    // For lamination, expected output is in meters. Default: 1000 kg => 2600 m
    const lamFactor = Number(process.env.LAMINATION_KG_TO_M_FACTOR || 2.6)
    const kgToMeters = (kg:number) => Number((kg * lamFactor).toFixed(3))

    // Map UI step to DB process enum (DB currently has 'washing_dyeing')
    const dbProcessName = parsed.nextProcess === 'lamination' ? 'lamination' : 'washing_dyeing'

    // No enum alteration needed; we map washing/dyeing to existing 'washing_dyeing'

    // Read previous SC to derive input product for next process
    const [prevRows] = await db.query(
      `SELECT so.id, so.output_product_id, so.output_product_type, so.output_uom,
              fp.sku AS fp_sku, rm.sku AS rm_sku
         FROM subcontract_orders so
         LEFT JOIN finished_products fp ON (so.output_product_type='finished_product' AND fp.id = so.output_product_id)
         LEFT JOIN raw_materials rm ON (so.output_product_type='raw_material' AND rm.id = so.output_product_id)
        WHERE so.sc_number = :sc LIMIT 1`,
      { sc: parsed.prevScNumber }
    )
    const prev = Array.isArray(prevRows) ? (prevRows as any[])[0] : (prevRows as any)
    if (!prev) return NextResponse.json({ error: 'Previous subcontract order not found' }, { status: 404 })

    // Resolve process id
    let processId: number | null = null
    {
      const [pRows] = await db.query('SELECT id FROM process_definitions WHERE name = :n LIMIT 1', { n: dbProcessName })
      const p = Array.isArray(pRows) ? (pRows as any[])[0] : (pRows as any)
      if (p && p.id) processId = Number(p.id)
      else {
        const [ins] = await db.execute(
          `INSERT INTO process_definitions (name, default_loss_percent, notes) VALUES (:n, :lp, 'Auto-created')`,
          { n: dbProcessName, lp: plannedLoss }
        )
        processId = Number((ins as any).insertId)
      }
    }

    // Determine input SKU/type for next process from previous output
    const inputType: 'raw_material' | 'finished_product' = prev.output_product_type
    const inputSku = inputType === 'finished_product' ? prev.fp_sku : prev.rm_sku
    if (!inputSku) return NextResponse.json({ error: 'Unable to resolve input SKU from previous order' }, { status: 400 })

    // Determine output SKU for next process (allow override, fallback to same SKU)
    const outputSku = (parsed.outputSku && parsed.outputSku.trim()) || inputSku
    const outputType: 'raw_material' | 'finished_product' = 'finished_product'

    // Create header via SP or fallback
    const scPrefix = parsed.nextProcess === 'washing' ? 'SW' : parsed.nextProcess === 'dyeing' ? 'SD' : 'SL'
    const scNumber = `${scPrefix}-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${Math.floor(1000+Math.random()*9000)}`
    // UOM rules
    // - washing tracked in kg
    // - lamination tracked in meters (input and output)
    // - otherwise, inherit previous output uom
    const inUom = parsed.nextProcess === 'washing'
      ? 'kg'
      : (parsed.nextProcess === 'lamination' ? 'm' : (prev.output_uom || (inputType==='raw_material'?'kg':'m')))
    const outUom = parsed.nextProcess === 'washing' ? 'kg' : 'm'

    try {
      await db.query(
        'CALL sp_create_subcontract_order(:sc, :supplier_id, :process_name, :input_sku, :input_type, :input_uom, :planned_input_qty, :output_sku, :output_type, :output_uom, :expected_output_qty, :planned_loss_percent, :user_id, :notes)'.replace(/\n/g,' '),
        {
          sc: scNumber,
          supplier_id:  (await (async()=>{ const [s] = await db.query('SELECT supplier_id FROM subcontract_orders WHERE sc_number=:sc',{sc:parsed.prevScNumber}); const row = Array.isArray(s)?(s as any[])[0]:(s as any); return row?.supplier_id || null })()),
          process_name: dbProcessName,
          input_sku: inputSku,
          input_type: inputType,
          input_uom: inUom,
          planned_input_qty: issueQty,
          output_sku: outputSku,
          output_type: outputType,
          output_uom: outUom,
          expected_output_qty: parsed.nextProcess==='lamination' ? issueQty : issueQty,
          planned_loss_percent: plannedLoss,
          user_id: parsed.userId ?? null,
          notes: parsed.notes ?? null,
        } as any
      )
      if (parsed.dateSent) {
        await db.execute('UPDATE subcontract_orders SET order_date = :d WHERE sc_number = :sc', { d: parsed.dateSent, sc: scNumber })
      }
    } catch (e: any) {
      const code = e?.code || e?.errno
      const msg = String(e?.sqlMessage || e?.message || '')
      if (code !== 1305 && !msg.toLowerCase().includes('does not exist')) throw e
      // Fallback create header
      const [supplierRows] = await db.query('SELECT supplier_id FROM subcontract_orders WHERE sc_number = :sc LIMIT 1', { sc: parsed.prevScNumber })
      const sup = Array.isArray(supplierRows) ? (supplierRows as any[])[0] : (supplierRows as any)
      // Resolve product ids
      let inId: number | null = null
      if (inputType === 'raw_material') {
        const [r] = await db.query('SELECT id FROM raw_materials WHERE sku = :sku LIMIT 1', { sku: inputSku })
        inId = Number((Array.isArray(r)?(r as any[])[0]:(r as any))?.id)
      } else {
        const [f] = await db.query('SELECT id FROM finished_products WHERE sku = :sku LIMIT 1', { sku: inputSku })
        inId = Number((Array.isArray(f)?(f as any[])[0]:(f as any))?.id)
      }
      const [of] = await db.query('SELECT id FROM finished_products WHERE sku = :sku LIMIT 1', { sku: outputSku })
      const outId = Number((Array.isArray(of)?(of as any[])[0]:(of as any))?.id)
      await db.execute(
        `INSERT INTO subcontract_orders (
           sc_number, supplier_id, process_id,
           input_product_id, input_product_type, input_uom, planned_input_qty,
           output_product_id, output_product_type, output_uom, expected_output_qty,
           planned_loss_percent, status, order_date, notes, created_by
         ) VALUES (
           :scn, :sup, :pid,
           :inId, :inType, :inUom, :inQty,
           :outId, 'finished_product', :outUom, :outQty,
           :loss, 'draft', COALESCE(:dt, CURRENT_DATE), :notes, :user
         )`,
        {
          scn: scNumber,
          sup: sup?.supplier_id ?? null,
          pid: processId,
          inId,
          inType: inputType,
          inUom: inUom,
          inQty: issueQty,
          outId,
          outUom: outUom,
          outQty: issueQty,
          loss: plannedLoss,
          dt: parsed.dateSent ?? null,
          notes: parsed.notes ?? null,
          user: parsed.userId ?? null,
        } as any
      )
    }

    // Issue to next process using same DC with suffix
    try {
      await db.query(
        'CALL sp_issue_to_subcontract(:sc, :qty, :lot, :gsm, :width, :user, :note)'.replace(/\n/g,' '),
        { sc: scNumber, qty: issueQty, lot: dcNo, gsm: null, width: null, user: parsed.userId ?? null, note: parsed.notes ?? null } as any
      )
    } catch (e: any) {
      const code = e?.code || e?.errno
      const msg = String(e?.sqlMessage || e?.message || '')
      if (code !== 1305 && !msg.toLowerCase().includes('does not exist')) throw e
      // Fallback inline
      const conn = await db.getConnection()
      try {
        await conn.beginTransaction()
        const [soRows] = await conn.query('SELECT id, input_product_id, input_product_type FROM subcontract_orders WHERE sc_number=:sc LIMIT 1 FOR UPDATE', { sc: scNumber })
        const so = Array.isArray(soRows) ? (soRows as any[])[0] : (soRows as any)
        if (!so) throw new Error('Subcontract order not found for issue')

        // Only decrement on-hand for raw materials.
        // For finished products (WIP between subcontract stages), do not touch inventory on fallback to avoid negatives.
        if (so.input_product_type === 'raw_material') {
          await conn.query('UPDATE raw_materials SET quantity_on_hand = quantity_on_hand - :q WHERE id = :id', { q: issueQty, id: so.input_product_id })
          await conn.query(
            `INSERT INTO inventory_transactions (transaction_type, product_id, product_type, quantity, reference_id, reference_type, notes, recorded_by)
             VALUES ('adjustment', :pid, :ptype, :qty, :ref, 'subcontract_order', :notes, :user)`,
            { pid: so.input_product_id, ptype: so.input_product_type, qty: issueQty, ref: so.id, notes: `subcontract_issue (forward) ${dcNo}`, user: parsed.userId ?? null }
          )
        }
        const issueUom = inUom
        await conn.query(
          `INSERT INTO subcontract_order_issues (subcontract_order_id, product_id, product_type, uom, qty, lot_no, spec_snapshot_json, note, created_by)
           VALUES (:sc_id, :pid, :ptype, :uom, :qty, :lot, NULL, :note, :user)`,
          { sc_id: so.id, pid: so.input_product_id, ptype: so.input_product_type, uom: issueUom, qty: issueQty, lot: dcNo, note: parsed.notes ?? null, user: parsed.userId ?? null }
        )
        await conn.query(`UPDATE subcontract_orders SET status = CASE WHEN status='draft' THEN 'issued' ELSE status END WHERE id = :id`, { id: so.id })
        await conn.commit()
      } catch (txErr) {
        try { await (conn as any).rollback() } catch {}
        throw txErr
      } finally {
        conn.release()
      }
    }

    // Mark previous process as completed/received so UI hides forward on it
    try {
      await db.execute("UPDATE subcontract_orders SET status = 'received' WHERE sc_number = :sc AND status <> 'closed'", { sc: parsed.prevScNumber })
    } catch {}

    return NextResponse.json({ ok: true, scNumber, dcNo, plannedLossPercent: plannedLoss, qty: issueQty })
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('POST subcontract forward error', err)
    const msg = err?.sqlMessage || err?.message || 'Failed to forward to next process'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
