import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

const EVO_URL      = (process.env.EVOLUTION_API_URL ?? 'https://evo.fauraarts.in').replace(/\/$/, '')
const EVO_KEY      = process.env.EVOLUTION_API_KEY ?? ''
const WA_INSTANCE  = process.env.WA_INSTANCE ?? ''
// Real numbers only — skips placeholders like 91XXXXXXXXXX
const WA_PHONES    = (process.env.WA_PHONES ?? '').split(',').map(p => p.trim()).filter(p => /^\d{10,15}$/.test(p))
const WA_GROUP_ID  = process.env.WA_GROUP_ID ?? ''
const CRON_SECRET  = process.env.CRON_SECRET ?? ''

async function sendText(to: string, text: string): Promise<boolean | string> {
  const number = to.includes('@g.us') ? to : `${to}@s.whatsapp.net`
  try {
    const res = await fetch(`${EVO_URL}/message/sendText/${WA_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number, text }),
    })
    return res.ok || `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`
  } catch (err: any) {
    return err?.cause?.code || err?.message || 'send failed'
  }
}

type Groups = { present: any[]; absent: any[]; onLeave: any[]; onDuty: any[] }

const line = (e: any) => `• ${e.employee_code} — ${String(e.name).trim()}\n`

// Working day: counts + names of who is absent (leave / OD listed apart so
// they aren't mistaken for absentees). Holiday or Sunday: only who came in.
function buildMessage(date: string, g: Groups, holiday: string | null) {
  const d = new Date(date + 'T00:00:00')
  const dateStr = d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

  let msg = `📋 *BRITEX Attendance Report*\n`
  msg += `📅 ${dateStr}\n`

  if (holiday) {
    msg += `🎉 Holiday — ${holiday}\n\n`
    msg += `✅ Present : *${g.present.length}*\n`
    if (g.present.length > 0) {
      msg += `\n*Present Employees:*\n`
      g.present.forEach(e => { msg += line(e) })
    } else {
      msg += `\nNo one has punched in.\n`
    }
  } else {
    msg += `\n✅ Present : *${g.present.length}*\n`
    msg += `❌ Absent  : *${g.absent.length}*\n`
    if (g.onLeave.length) msg += `🏖️ On Leave : *${g.onLeave.length}*\n`
    if (g.onDuty.length)  msg += `🚚 On Duty  : *${g.onDuty.length}*\n`

    if (g.absent.length > 0) {
      msg += `\n*Absent Employees:*\n`
      g.absent.forEach(e => { msg += line(e) })
    }
    if (g.onLeave.length > 0) {
      msg += `\n*On Leave:*\n`
      g.onLeave.forEach(e => { msg += line(e) })
    }
    if (g.onDuty.length > 0) {
      msg += `\n*On Duty (OD):*\n`
      g.onDuty.forEach(e => { msg += line(e) })
    }
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

  const dryRun = Boolean(body.dry)
  if (!dryRun && (!WA_INSTANCE || !EVO_KEY)) {
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
      LEFT JOIN hr_attendance a ON a.employee_id = e.id AND a.date = CAST(:date AS date)
      WHERE e.status = 'active'
        AND (e.date_of_joining IS NULL OR e.date_of_joining <= CAST(:date AS date))
      ORDER BY CAST(NULLIF(regexp_replace(e.employee_code, '\\D', '', 'g'), '') AS int) NULLS LAST, e.employee_code
    `, { date })

    const [hol] = await db.query('SELECT name FROM hr_holidays WHERE date = CAST(:date AS date)', { date })
    const isSunday = new Date(date + 'T00:00:00Z').getUTCDay() === 0
    const holiday: string | null = (hol as any[])[0]?.name ?? (isSunday ? 'Sunday' : null)

    const employees = rows as any[]
    const g: Groups = {
      onLeave: employees.filter(e => e.status === 'on_leave'),
      onDuty:  employees.filter(e => e.status === 'on_duty'),
      present: employees.filter(e => e.check_in !== null && e.status !== 'on_leave' && e.status !== 'on_duty'),
      absent:  employees.filter(e => e.check_in === null && e.status !== 'on_leave' && e.status !== 'on_duty'),
    }

    const message = buildMessage(date, g, holiday)
    const summary = { date, holiday, present: g.present.length, absent: g.absent.length,
                      on_leave: g.onLeave.length, on_duty: g.onDuty.length }
    if (dryRun) return NextResponse.json({ dry_run: true, ...summary, message })

    const targets = [...WA_PHONES, ...(WA_GROUP_ID ? [WA_GROUP_ID] : [])]
    if (targets.length === 0) {
      return NextResponse.json({ error: 'No recipients configured (WA_PHONES / WA_GROUP_ID)' }, { status: 500 })
    }

    const results: Record<string, boolean | string> = {}
    for (const t of targets) {
      results[t] = await sendText(t, message)
    }

    return NextResponse.json({
      ...summary,
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
    body: JSON.stringify({ secret, date: searchParams.get('date') ?? undefined, dry: searchParams.get('dry') === '1' }),
  }))
}
