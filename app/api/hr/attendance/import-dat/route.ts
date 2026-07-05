import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getDb } from '@/lib/db'

function toMins(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function morningLateMins(punchTime: string, shiftStart = '09:00', grace = 10) {
  return Math.max(0, toMins(punchTime.slice(0, 5)) - toMins(shiftStart) - grace)
}
function lunchLateMins(out: string | null, inn: string | null) {
  if (!out || !inn) return 0
  return Math.max(0, toMins(inn.slice(0, 5)) - toMins(out.slice(0, 5)) - 30)
}

interface PunchLine {
  pin: string
  date: string
  time: string
}

function parseDat(text: string): PunchLine[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const punches: PunchLine[] = []
  for (const line of lines) {
    // Format: PIN\tYYYY-MM-DD HH:MM:SS\tStatus\t...
    const parts = line.split('\t')
    if (parts.length < 2) continue
    const pin = parts[0].trim()
    const dt  = parts[1].trim()
    const spIdx = dt.indexOf(' ')
    if (spIdx < 0) continue
    const date = dt.slice(0, spIdx)
    const time = dt.slice(spIdx + 1, spIdx + 9)
    if (!pin || !date || !time) continue
    punches.push({ pin, date, time })
  }
  return punches
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const text = await file.text()
    const punches = parseDat(text)
    if (punches.length === 0) return NextResponse.json({ error: 'No valid punch records found in file' }, { status: 400 })

    const db = getDb()

    // Load all employees (code → id map)
    const [empRows] = await db.query('SELECT id, employee_code FROM hr_employees')
    const byCode = new Map<string, number>()
    for (const e of empRows as any[]) byCode.set(e.employee_code.toLowerCase(), e.id)

    // Group punches by pin+date, sorted by time
    const grouped = new Map<string, string[]>()
    for (const p of punches) {
      const key = `${p.pin}__${p.date}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(p.time)
    }
    for (const times of grouped.values()) times.sort()

    let saved = 0, skipped = 0, errors: string[] = []
    const DEVICE_PREFIX = 'BT'

    for (const [key, times] of grouped.entries()) {
      const [pin, date] = key.split('__')

      // Device PIN = BT code number directly (Excel BT-05 = device PIN 5)
      const empCode = `${DEVICE_PREFIX}-${pin.padStart(2, '0')}`
      const empId =
        byCode.get(empCode.toLowerCase()) ??
        byCode.get(pin.padStart(2, '0').toLowerCase()) ??
        byCode.get(pin.toLowerCase()) ??
        null

      if (!empId) {
        errors.push(`PIN ${pin}: no employee match`)
        skipped++
        continue
      }

      // Deduplicate near-identical times (within 5s)
      const deduped = times.filter((t, i) => {
        if (i === 0) return true
        return toMins(t.slice(0,5)) - toMins(times[i-1].slice(0,5)) > 0 ||
               Math.abs(parseInt(t.slice(6,8)) - parseInt(times[i-1].slice(6,8))) > 5
      })

      const checkIn   = deduped[0] ?? null
      let lunchOut: string | null = null
      let lunchIn: string | null  = null
      let checkOut: string | null = null

      if (deduped.length === 2) {
        const h = parseInt(deduped[1].slice(0, 2))
        if (h < 14) { lunchOut = deduped[1] }
        else        { checkOut = deduped[1] }
      } else if (deduped.length === 3) {
        lunchOut = deduped[1]
        const h2 = parseInt(deduped[2].slice(0, 2))
        if (h2 < 14) { lunchIn = deduped[2] }
        else         { checkOut = deduped[2] }
      } else if (deduped.length >= 4) {
        lunchOut = deduped[1]
        lunchIn  = deduped[2]
        checkOut = deduped[deduped.length - 1]
      }

      const lateMins = morningLateMins(checkIn!)
      const llm      = lunchLateMins(lunchOut, lunchIn)
      const status   = lateMins > 0 ? 'late' : 'present'

      try {
        await db.execute(
          `INSERT INTO hr_attendance
             (employee_id, date, check_in, check_out, lunch_out, lunch_in,
              punch_count, status, late_morning_mins, is_late_lunch, late_lunch_mins)
           VALUES
             (:empId, :date, :checkIn, :checkOut, :lunchOut, :lunchIn,
              :punchCount, :status, :lateMins, :isLateLunch, :llm)
           ON CONFLICT (employee_id, date)
           DO UPDATE SET
             check_in          = EXCLUDED.check_in,
             check_out         = EXCLUDED.check_out,
             lunch_out         = EXCLUDED.lunch_out,
             lunch_in          = EXCLUDED.lunch_in,
             punch_count       = EXCLUDED.punch_count,
             status            = EXCLUDED.status,
             late_morning_mins = EXCLUDED.late_morning_mins,
             is_late_lunch     = EXCLUDED.is_late_lunch,
             late_lunch_mins   = EXCLUDED.late_lunch_mins`,
          {
            empId, date, checkIn, checkOut, lunchOut, lunchIn,
            punchCount: deduped.length,
            status,
            lateMins,
            isLateLunch: llm > 0,
            llm,
          }
        )
        saved++
      } catch (e: any) {
        errors.push(`PIN ${pin} ${date}: ${e.message}`)
        skipped++
      }
    }

    return NextResponse.json({
      summary: {
        total_punch_lines: punches.length,
        employee_days_processed: grouped.size,
        saved,
        skipped,
      },
      errors: errors.slice(0, 20),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
