import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const createSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['foam', 'fabric', 'springs', 'padding', 'glue', 'thread', 'yarn', 'zip', 'cover', 'other']),
  unit: z.string().min(1).optional().default('piece'),
  quantity_on_hand: z.coerce.number().int().nonnegative().default(0),
  reorder_level: z.coerce.number().int().nonnegative(),
  unit_cost: z.coerce.number().nonnegative().optional(),
  supplier_id: z.coerce.number().int().optional().nullable(),
  status: z.enum(['active', 'discontinued']).optional().default('active'),
})

// GET /api/inventory/raw-materials?search=&page=1&pageSize=20
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('search')?.trim() || ''
    const categoriesParam = (searchParams.get('categories') || '').trim()
    // Default: when no search and no categories param, restrict to yarn + zip for cleaner UX in typeaheads
    const defaultCats = !q && !categoriesParam ? ['yarn','zip'] : []
    const cats = categoriesParam
      ? categoriesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : defaultCats
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 20)))
    const offset = (page - 1) * pageSize

    const db = getDb()

    const whereParts: string[] = []
    const params: any = { limit: pageSize, offset }
    if (q) {
      whereParts.push('(sku LIKE :q OR name LIKE :q)')
      params.q = `%${q}%`
    }
    if (cats.length) {
      // Construct IN list safely
      const placeholders = cats.map((_, i) => `:cat${i}`)
      whereParts.push(`category IN (${placeholders.join(',')})`)
      cats.forEach((c, i) => (params[`cat${i}`] = c))
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''

    const [rows] = await db.query(
      `SELECT id, sku, name, category, unit, quantity_on_hand, reorder_level, unit_cost, supplier_id, status, created_at, updated_at
       FROM raw_materials ${where}
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      params
    )

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM raw_materials ${where}`,
      params
    )
    const total = Array.isArray(countRows) ? (countRows as any)[0]?.total ?? 0 : 0

    return NextResponse.json({ data: rows, page, pageSize, total })
  } catch (err: any) {
    console.error('GET raw-materials error', err)
    return NextResponse.json({ error: 'Failed to fetch raw materials' }, { status: 500 })
  }
}

// POST /api/inventory/raw-materials
export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = createSchema.parse(json)

    const db = getDb()
    // Normalize unit by category: yarn -> kg, zip -> piece (qty)
    const unitNormalized = parsed.category === 'yarn' ? 'kg' : parsed.category === 'zip' ? 'piece' : (parsed as any).unit
    const [result] = await db.execute(
      `INSERT INTO raw_materials (sku, name, category, unit, quantity_on_hand, reorder_level, unit_cost, supplier_id, status)
       VALUES (:sku, :name, :category, :unit, :quantity_on_hand, :reorder_level, :unit_cost, :supplier_id, :status)`,
      { ...(parsed as any), unit: unitNormalized }
    )

    const insertId = (result as any).insertId

    const [rows] = await db.query(
      'SELECT id, sku, name, category, quantity_on_hand, reorder_level, unit_cost, supplier_id, status, created_at, updated_at FROM raw_materials WHERE id = :id',
      { id: insertId }
    )

    return NextResponse.json({ data: Array.isArray(rows) ? rows[0] : rows }, { status: 201 })
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('POST raw-materials error', err)
    // Likely duplicate SKU or DB error
    return NextResponse.json({ error: 'Failed to create raw material', detail: err?.message }, { status: 500 })
  }
}

