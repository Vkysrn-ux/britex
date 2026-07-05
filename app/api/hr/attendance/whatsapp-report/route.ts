import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

const EVO_URL      = (process.env.EVOLUTION_API_URL ?? 'https://evo.fauraarts.in').replace(/\/$/, '')
const EVO_KEY      = process.env.EVOLUTION_API_KEY ?? ''
const WA_INSTANCE  = process.env.WA_INSTANCE ?? ''
const WA_PHONES    = (process.env.WA_PHONES ?? '').split(',').map(p => p.trim()).filter(Boolean)
const WA_GROUP_ID  = process.env.WA_GROUP_ID ?? ''
const CRON_SECRET  = process.env.CRON_SECRET ?? ''

async function sendText(to: string, text: string) {
  const isGroup = to.includes('@g.us')
  const endpoint = isGroup
    ? `${EVO_URL}/message/sendText/${WA_INSTANCE}`
    : `${EVO_URL}/message/sendText/${WA_INSTANCE}`

  const number = isGroup ? to : `${to}@s.whatsapp.net`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body: JSON.stringify({ number, text }),
  })
  return res.ok
}

function buildMessage(date: string, present: any[], absent: any[]) {
  const d = new Date(date + 'T00:00:00')
  const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  let msg = `📋 *BRITEX Attendance Report*\n`
  msg += `📅 ${dateStr}\n\n`
  msg += `✅ Present  : *${present.length}*\n`
  msg += `❌ Absent   : *${absent.length}*\n`

  if (absent.length > 0) {
    msg += `\n*Absent Employees:*\n`
    absent.forEach(e => {
      msg += `• ${e.employee_code} — ${e.name.trim()}\n`
    })
  }

  msg += `\n_Auto-report from ERP · ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST_`
  return msg
}

export async function POST(req: Request) {
  // Allow internal cron calls with secret, or direct API calls
  const authHeader = req.headers.get('authorization') ?? ''
  const body = await req.json().catch(() => ({}))
  const secret = body.secret ?? authHeader.replace('Bearer ', '')

  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!WA_INSTANCE || !EVO_KEY) {
    return NextResponse.json({ error: 'WA_INSTANCE or EVOLUTION_API_KEY not configured' }, { status: 500 })
  }

  const date = body.date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  try {
    const db = getDb()
    const [rows] = await db.query(`
      SELECT
        e.employee_code,
        CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS name,
        a.check_in,
        a.status
      FROM hr_employees e
      LEFT JOIN hr_attendance a ON a.employee_id = e.id AND a.date = :date
      WHERE e.status = 'active'
      ORDER BY e.employee_code
    `, { date })

    const employees = rows as any[]
    const present = employees.filter(e => e.check_in !== null)
    const absent  = employees.filter(e => e.check_in === null)

    const message = buildMessage(date, present, absent)

    const targets = [...WA_PHONES, ...(WA_GROUP_ID ? [WA_GROUP_ID] : [])]
    if (targets.length === 0) {
      return NextResponse.json({ error: 'No recipients configured (WA_PHONES / WA_GROUP_ID)' }, { status: 500 })
    }

    const results: Record<string, boolean> = {}
    for (const t of targets) {
      results[t] = await sendText(t, message)
    }

    return NextResponse.json({
      date,
      present: present.length,
      absent: absent.length,
      sent_to: targets.length,
      results,
      message,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Allow GET for quick test
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') ?? ''
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return POST(new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ secret, date: searchParams.get('date') ?? undefined }),
  }))
}
