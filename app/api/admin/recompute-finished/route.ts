import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

// GET /api/admin/recompute-finished?sku=FAB-GREIGE
// Recomputes quantity_on_hand for a finished product SKU as:
//   subcontract receipts (meters or units) - outbound shipments
// Safe to run when earlier receives didn’t post inventory due to missing SP.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const sku = url.searchParams.get('sku')?.trim()
    if (!sku) return NextResponse.json({ error: 'sku is required' }, { status: 400 })

    const db = getDb()
    // Find the product id for the SKU
    const [rows] = await db.query('SELECT id FROM finished_products WHERE sku = :sku LIMIT 1', { sku })
    const fp = Array.isArray(rows) ? (rows as any[])[0] : (rows as any)
    if (!fp) return NextResponse.json({ error: 'Finished SKU not found' }, { status: 404 })

    // Sum receipts for this finished product from subcontract flow
    const [[rec]]: any = await db.query(
      `SELECT COALESCE(SUM(sor.qty),0) AS qty
         FROM subcontract_order_receipts sor
         JOIN subcontract_orders so ON so.id = sor.subcontract_order_id
        WHERE so.output_product_type='finished_product' AND so.output_product_id = :pid`,
      { pid: fp.id }
    )

    // For orders marked received before the SP/inline fix, receipts may be missing.
    // Infer meters from expected_output_qty or, for lamination, from issue qty in meters.
    const [[inf]]: any = await db.query(
      `SELECT COALESCE(SUM(
                COALESCE(so.expected_output_qty,
                         (SELECT COALESCE(SUM(soi.qty),0)
                            FROM subcontract_order_issues soi
                           WHERE soi.subcontract_order_id = so.id AND soi.uom='m'),
                         0)
              ),0) AS qty
         FROM subcontract_orders so
        WHERE so.output_product_type='finished_product'
          AND so.output_product_id = :pid
          AND so.status = 'received'
          AND NOT EXISTS (
                SELECT 1 FROM subcontract_order_receipts sor
                 WHERE sor.subcontract_order_id = so.id
          )`,
      { pid: fp.id }
    )

    // Sum shipments for this product
    const [[ship]]: any = await db.query(
      `SELECT COALESCE(SUM(osl.quantity),0) AS qty
         FROM outbound_shipment_lines osl
        WHERE osl.finished_product_id = :pid`,
      { pid: fp.id }
    )

    const onHand = Number(rec?.qty || 0) + Number(inf?.qty || 0) - Number(ship?.qty || 0)

    await db.execute('UPDATE finished_products SET quantity_on_hand = :q WHERE id = :id', { q: onHand, id: fp.id })

    return NextResponse.json({ ok: true, sku, onHand, detail: { receipts: Number(rec?.qty||0), inferred: Number(inf?.qty||0), shipments: Number(ship?.qty||0) } })
  } catch (err: any) {
    console.error('recompute-finished error', err)
    return NextResponse.json({ error: err?.message || 'Failed to recompute finished stock' }, { status: 500 })
  }
}
