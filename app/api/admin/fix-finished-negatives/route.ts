import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

export async function POST(req: Request) {
  const url = new URL(req.url)
  const sku = url.searchParams.get('sku') || null
  try {
    const db = getDb()
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      const whereParts: string[] = [
        `it.product_type='finished_product'`,
        `it.transaction_type='subcontract_issue'`,
      ]
      const params: Record<string, any> = {}
      if (sku) {
        whereParts.push('fp.sku = :sku')
        params.sku = sku
      }
      const where = whereParts.join(' AND ')

      const [rows] = await conn.query(
        `SELECT it.product_id, SUM(it.quantity) AS adj
           FROM inventory_transactions it
           JOIN finished_products fp ON fp.id = it.product_id
          WHERE ${where}
          GROUP BY it.product_id
         HAVING SUM(it.quantity) > 0`,
        params
      )

      for (const r of rows as any[]) {
        const pid = Number(r.product_id)
        const adj = Number(r.adj || 0)
        if (!pid || !adj) continue
        await conn.query(
          `UPDATE finished_products SET quantity_on_hand = quantity_on_hand + :adj WHERE id = :pid`,
          { adj, pid }
        )
        await conn.query(
          `INSERT INTO inventory_transactions (transaction_type, product_id, product_type, quantity, reference_type, notes)
           VALUES ('adjustment', :pid, 'finished_product', :adj, 'migration', 'Fix negatives: revert prior subcontract finished issues')`,
          { pid, adj }
        )
      }

      await conn.commit()
      return NextResponse.json({ ok: true, fixed: (rows as any[]).length })
    } catch (e) {
      try { await (conn as any).rollback() } catch {}
      throw e
    } finally {
      conn.release()
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fix' }, { status: 500 })
  }
}

export async function GET(req: Request) { return POST(req) }
