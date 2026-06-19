import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = getDb()
    const [rows] = await db.query('SELECT * FROM hr_leave_types ORDER BY name')
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch leave types' }, { status: 500 })
  }
}
