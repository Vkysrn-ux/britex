import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const idParam = z.coerce.number().int().positive()

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idRaw } = await context.params
    const id = idParam.parse(idRaw)
    const db = getDb()

    // Order details
    const [orderRows] = await db.query(
      `SELECT 
         po.id, po.order_number, po.finished_product_id, po.quantity_ordered, po.quantity_produced, po.status, po.priority,
         po.start_date, po.expected_completion_date, po.actual_completion_date, po.assigned_to, po.notes,
         po.created_at, po.updated_at,
         fp.sku AS product_sku, fp.name AS product_name, fp.size AS product_size,
         CONCAT(u.first_name, ' ', u.last_name) AS assigned_to_name
       FROM production_orders po
       JOIN finished_products fp ON fp.id = po.finished_product_id
       LEFT JOIN users u ON u.id = po.assigned_to
       WHERE po.id = :id`,
      { id }
    )
    const order = Array.isArray(orderRows) ? (orderRows as any[])[0] : (orderRows as any)
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Materials status list
    const [matRows] = await db.query(
      `SELECT raw_material_id, raw_material_sku, raw_material_name, unit,
              required_qty, allocated_qty, consumed_qty, waste_qty, on_floor_qty, fulfillment_percent
         FROM v_production_material_status
        WHERE production_order_id = :id
        ORDER BY raw_material_name ASC`,
      { id }
    )

    // Materials aggregate percent
    const [aggRows] = await db.query(
      `SELECT 
         SUM(required_qty) AS required_total,
         SUM(allocated_qty) AS allocated_total,
         SUM(consumed_qty) AS consumed_total,
         SUM(waste_qty) AS waste_total,
         CASE WHEN SUM(required_qty) > 0 THEN ROUND(SUM(consumed_qty)/SUM(required_qty)*100,2) ELSE 0 END AS materials_percent
       FROM v_production_material_status
       WHERE production_order_id = :id`,
      { id }
    )
    const aggregates = Array.isArray(aggRows) ? (aggRows as any[])[0] : (aggRows as any)

    // Order progress percent
    const [progRows] = await db.query(
      `SELECT quantity_produced, percent_complete 
         FROM v_production_order_progress 
        WHERE production_order_id = :id`,
      { id }
    )
    const vp = Array.isArray(progRows) && (progRows as any[])[0] ? (progRows as any[])[0] : null
    const altPercent = order.quantity_ordered > 0 ? Math.round((order.quantity_produced / order.quantity_ordered) * 10000) / 100 : 0
    const percent_complete = vp ? Math.max(Number(vp.percent_complete ?? 0), altPercent) : altPercent

    return NextResponse.json({
      data: {
        order,
        materials: matRows,
        aggregates,
        progress: { percent_complete },
      },
    })
  } catch (err) {
    console.error('GET production order summary error', err)
    return NextResponse.json({ error: 'Failed to load order summary' }, { status: 500 })
  }
}
