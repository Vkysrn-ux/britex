import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const idParam = z.coerce.number().int().positive()

const updateSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  category: z.enum(['foam', 'fabric', 'springs', 'padding', 'glue', 'other']).optional(),
  quantity_on_hand: z.coerce.number().int().nonnegative().optional(),
  reorder_level: z.coerce.number().int().nonnegative().optional(),
  unit_cost: z.coerce.number().nonnegative().optional().nullable(),
  supplier_id: z.coerce.number().int().optional().nullable(),
  status: z.enum(['active', 'discontinued']).optional(),
})

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idRaw } = await context.params
    const id = idParam.parse(idRaw)
    const db = getDb()
    const [rows] = await db.query(
      'SELECT id, sku, name, category, quantity_on_hand, reorder_level, unit_cost, supplier_id, status, created_at, updated_at FROM raw_materials WHERE id = :id',
      { id }
    )
    const item = Array.isArray(rows) ? rows[0] : rows
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: item })
  } catch (err) {
    console.error('GET raw-material by id error', err)
    return NextResponse.json({ error: 'Failed to fetch raw material' }, { status: 500 })
  }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idRaw } = await context.params
    const id = idParam.parse(idRaw)
    const json = await req.json()
    const data = updateSchema.parse(json)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const db = getDb()
    const assignments = Object.keys(data).map((k) => `${k} = :${k}`).join(', ')
    const [result] = await db.execute(
      `UPDATE raw_materials SET ${assignments} WHERE id = :id`,
      { ...(data as any), id }
    )

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [rows] = await db.query(
      'SELECT id, sku, name, category, quantity_on_hand, reorder_level, unit_cost, supplier_id, status, created_at, updated_at FROM raw_materials WHERE id = :id',
      { id }
    )

    return NextResponse.json({ data: Array.isArray(rows) ? rows[0] : rows })
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('PUT raw-material error', err)
    return NextResponse.json({ error: 'Failed to update raw material' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idRaw } = await context.params
    const id = idParam.parse(idRaw)
    const db = getDb()
    const [result] = await db.execute('DELETE FROM raw_materials WHERE id = :id', { id })
    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE raw-material error', err)
    return NextResponse.json({ error: 'Failed to delete raw material' }, { status: 500 })
  }
}
