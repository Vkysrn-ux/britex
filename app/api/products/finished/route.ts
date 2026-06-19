import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = getDb()
    const [rows] = await db.query(
      'SELECT id, sku, name, size, product_type, quantity_on_hand FROM finished_products WHERE status = "active" ORDER BY name ASC'
    )
    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('GET finished products error', err)
    return NextResponse.json({ error: 'Failed to fetch finished products' }, { status: 500 })
  }
}

