import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

function round4(n: number) { return Math.round((n + Number.EPSILON) * 10000) / 10000 }

export async function GET() {
  try {
    const db = getDb()
    const [rows] = await db.query(
      `SELECT 
         po.id AS order_id,
         po.quantity_ordered, po.quantity_produced,
         fp.id AS finished_product_id, fp.name AS product_name, fp.sku AS product_sku,
         spec.width_cm, spec.length_cm, spec.height_cm,
         bom.raw_material_id, bom.quantity_required, bom.uom, bom.calc_method, bom.factor, bom.waste_percent,
         rm.sku AS rm_sku, rm.name AS rm_name, rm.unit AS rm_unit, rm.quantity_on_hand, rm.reorder_level
       FROM production_orders po
       JOIN finished_products fp ON fp.id = po.finished_product_id
       LEFT JOIN product_size_specs spec ON spec.finished_product_id = fp.id
       JOIN bill_of_materials bom ON bom.finished_product_id = fp.id
       JOIN raw_materials rm ON rm.id = bom.raw_material_id
       WHERE po.status IN ('pending', 'in_progress')`
    )

    const materialMap: Record<string, any> = {}

    for (const r of (rows as any[])) {
      const remainingUnits = Math.max(0, (r.quantity_ordered ?? 0) - (r.quantity_produced ?? 0))
      if (remainingUnits === 0) continue

      let perUnit = 0
      if (r.calc_method === 'fixed') {
        perUnit = Number(r.quantity_required ?? 0)
      } else if (r.calc_method === 'per_area') {
        const width_m = Number(r.width_cm ?? 0) / 100
        const length_m = Number(r.length_cm ?? 0) / 100
        const area_sqm = width_m * length_m
        perUnit = area_sqm * Number(r.factor ?? 0)
      } else if (r.calc_method === 'per_length') {
        const width_m = Number(r.width_cm ?? 0) / 100
        const length_m = Number(r.length_cm ?? 0) / 100
        const perimeter_m = 2 * (width_m + length_m)
        perUnit = perimeter_m * Number(r.factor ?? 0)
      }

      const wasteMultiplier = 1 + (Number(r.waste_percent ?? 0) / 100)
      const required = round4(perUnit * remainingUnits * wasteMultiplier)

      const key = String(r.raw_material_id)
      if (!materialMap[key]) {
        materialMap[key] = {
          raw_material_id: r.raw_material_id,
          sku: r.rm_sku,
          name: r.rm_name,
          unit: r.rm_unit,
          on_hand: Number(r.quantity_on_hand ?? 0),
          required_total: 0,
          reorder_level: Number(r.reorder_level ?? 0),
        }
      }
      materialMap[key].required_total = round4(materialMap[key].required_total + required)
    }

    const data = Object.values(materialMap).map((m: any) => ({
      ...m,
      shortage: Math.max(0, round4(m.required_total - m.on_hand)),
    }))

    return NextResponse.json({ data })
  } catch (err) {
    console.error('GET production materials error', err)
    return NextResponse.json({ error: 'Failed to calculate materials' }, { status: 500 })
  }
}
