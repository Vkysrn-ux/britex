import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

// GET /api/quality/inspections?status=pending_review
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = (searchParams.get('status') || 'pending_review').trim()
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 50)))
    const offset = (page - 1) * pageSize

    const db = getDb()
    const [rows] = await db.query(
      `SELECT qi.id, qi.inspection_date, qi.inspection_type, qi.product_id, qi.batch_number,
              qi.quantity_inspected, qi.quantity_passed, qi.quantity_failed,
              qi.status, qi.notes,
              fp.sku AS product_sku, fp.name AS product_name
         FROM quality_inspections qi
         LEFT JOIN finished_products fp ON fp.id = qi.product_id
        WHERE qi.inspection_type = 'finished_product' AND qi.status = :status
        ORDER BY qi.inspection_date DESC, qi.id DESC
        LIMIT :limit OFFSET :offset`,
      { status, limit: pageSize, offset }
    )
    return NextResponse.json({ data: rows, page, pageSize })
  } catch (err) {
    console.error('GET quality inspections error', err)
    return NextResponse.json({ error: 'Failed to fetch inspections' }, { status: 500 })
  }
}

