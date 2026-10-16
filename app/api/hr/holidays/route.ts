import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1),
})

export async function GET(req: Request) {
  try {
    const year = Number(new URL(req.url).searchParams.get('year') || new Date().getFullYear())
    const [rows] = await getDb().query(
      `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date, name FROM hr_holidays
        WHERE EXTRACT(YEAR FROM date) = :year ORDER BY date`,
      { year }
    )
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    console.error('GET holidays error', err)
    return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { date, name } = schema.parse(await req.json())
    await getDb().query(
      `INSERT INTO hr_holidays (date, name) VALUES (CAST(:date AS date), :name)
       ON CONFLICT (date) DO UPDATE SET name = EXCLUDED.name`,
      { date, name }
    )
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Enter a date and a holiday name' }, { status: 400 })
    console.error('POST holidays error', err)
    return NextResponse.json({ error: err?.message || 'Failed to save holiday' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const date = new URL(req.url).searchParams.get('date') || ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'date required' }, { status: 400 })
    await getDb().query('DELETE FROM hr_holidays WHERE date = CAST(:date AS date)', { date })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE holidays error', err)
    return NextResponse.json({ error: err?.message || 'Failed to delete holiday' }, { status: 500 })
  }
}
