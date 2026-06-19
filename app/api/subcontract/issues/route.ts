import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

// GET /api/subcontract/issues?q=&supplierId=&limit=
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const supplierId = searchParams.get('supplierId')?.trim()
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)))

    const db = getDb()
    const where: string[] = []
    const params: any = { limit }
    if (q) {
      where.push('(so.sc_number LIKE :q OR soi.lot_no LIKE :q OR COALESCE(rm.sku, fp.sku) LIKE :q)')
      params.q = `%${q}%`
    }
    if (supplierId) {
      where.push('s.id = :supplierId')
      params.supplierId = Number(supplierId)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const [rows] = await db.query(
      `SELECT
         soi.id,
         so.sc_number,
         s.supplier_name,
         pd.name AS process_name,
         CASE WHEN soi.product_type='raw_material' THEN rm.sku ELSE fp.sku END AS product_sku,
         CASE WHEN soi.product_type='raw_material' THEN rm.name ELSE fp.name END AS product_name,
         soi.qty, soi.uom, soi.lot_no,
         so.planned_loss_percent,
         so.status,
         soi.created_at
       FROM subcontract_order_issues soi
       JOIN subcontract_orders so ON so.id = soi.subcontract_order_id
       JOIN suppliers s ON s.id = so.supplier_id
       JOIN process_definitions pd ON pd.id = so.process_id
       LEFT JOIN raw_materials rm ON rm.id = soi.product_id AND soi.product_type='raw_material'
       LEFT JOIN finished_products fp ON fp.id = soi.product_id AND soi.product_type='finished_product'
       ${whereSql}
       ORDER BY soi.created_at DESC
       LIMIT :limit`,
      params
    )

    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('GET subcontract issues error', err)
    return NextResponse.json({ error: 'Failed to fetch DC issues' }, { status: 500 })
  }
}
