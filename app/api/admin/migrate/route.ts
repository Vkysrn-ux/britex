import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'
import { scheduleMigrationsOnce } from '@/lib/migrate'

export async function POST() {
  try {
    const db = getDb()
    const p = scheduleMigrationsOnce(db)
    if (p && typeof (p as any).then === 'function') {
      await p
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Migration failed' }, { status: 500 })
  }
}

export async function GET() { return POST() }

