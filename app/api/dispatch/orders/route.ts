import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

// GET open order items with outstanding qty and on-hand stock
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const db = getDb()
    const whereQ = q ? 'AND (co.order_number LIKE :q OR fp.sku LIKE :q OR fp.name LIKE :q)' : ''
    const [rows] = await db.query(
      `SELECT co.id AS order_id, co.order_number, co.status, co.order_date,
              coi.id AS item_id, coi.finished_product_id, fp.sku, fp.name,
              coi.quantity_ordered, coi.quantity_shipped,
              (coi.quantity_ordered - coi.quantity_shipped) AS outstanding,
              fp.quantity_on_hand AS on_hand
         FROM customer_orders co
         JOIN customer_order_items coi ON coi.customer_order_id = co.id
         JOIN finished_products fp ON fp.id = coi.finished_product_id
        WHERE co.status IN ('pending','processing','packaged')
          AND (coi.quantity_ordered - coi.quantity_shipped) > 0
          ${whereQ}
        ORDER BY co.order_date ASC, co.id ASC`,
      q ? { q: `%${q}%` } : {}
    )
    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('GET dispatch orders error', err)
    return NextResponse.json({ error: 'Failed to fetch dispatchables' }, { status: 500 })
  }
}

