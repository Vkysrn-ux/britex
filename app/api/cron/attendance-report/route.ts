import { NextResponse } from 'next/server'
export const runtime = 'nodejs'

const CRON_SECRET = process.env.CRON_SECRET ?? ''
const APP_URL     = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

// Called by cron at 05:00 UTC = 10:30 IST daily
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? ''

  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const res = await fetch(`${APP_URL}/api/hr/attendance/whatsapp-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: CRON_SECRET }),
    })
    const data = await res.json()
    return NextResponse.json({ ok: res.ok, ...data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
