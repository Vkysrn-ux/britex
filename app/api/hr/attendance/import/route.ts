import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import * as XLSX from 'xlsx'
import { getDb } from '@/lib/db'

// ── helpers ──────────────────────────────────────────────────────────────────

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function lunchLateMins(lunchOut: string, lunchIn: string): number {
  const out = timeToMins(lunchOut)
  const ins = timeToMins(lunchIn)
  if (ins <= out) return 0
  const taken = ins - out
  return Math.max(0, taken - 30)
}

function morningLateMins(checkIn: string, shiftStart = '09:00', graceMins = 10): number {
  const ci   = timeToMins(checkIn)
  const due  = timeToMins(shiftStart) + graceMins
  return Math.max(0, ci - due)
}

// Deduplicate consecutive identical punch times
function dedup(times: string[]): string[] {
  return times.filter((t, i) => i === 0 || t !== times[i - 1])
}

// ── ZKTeco "Att.log report" parser ──────────────────────────────────────────

async function parseZKTeco(wb: XLSX.WorkBook): Promise<NextResponse> {
  const sheet = wb.Sheets['Att.log report']
  if (!sheet) return NextResponse.json({ error: 'Sheet "Att.log report" not found' }, { status: 400 })

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  // 1. Find date range string  e.g. "2026-06-01 ~ 2026-06-19"
  let startDate = ''
  for (const row of rows) {
    for (const cell of row) {
      const m = String(cell).match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/)
      if (m) { startDate = m[1]; break }
    }
    if (startDate) break
  }
  if (!startDate) return NextResponse.json({ error: 'Could not find date range in Att.log report sheet' }, { status: 400 })

  // 2. Find the row that contains day numbers [1,2,3,...] to map col → day number
  let dayHeaderRow: any[] = []
  for (const row of rows) {
    const nums = row.filter((c: any) => typeof c === 'number' && Number.isInteger(c) && c >= 1 && c <= 31)
    if (nums.length >= 5) { dayHeaderRow = row; break }
  }

  function colToDate(col: number): string | null {
    const dayNum = typeof dayHeaderRow[col] === 'number' ? dayHeaderRow[col] : null
    if (!dayNum) return null
    const d = new Date(startDate)
    d.setDate(d.getDate() + dayNum - 1)
    return d.toISOString().slice(0, 10)
  }

  // 3. Load employees for matching
  const db = getDb()
  const [empRows] = await db.query(
    `SELECT e.id, e.employee_code, LOWER(CONCAT(e.first_name,' ',e.last_name)) AS full_name,
            s.start_time AS shift_start, s.grace_minutes AS grace_mins
       FROM hr_employees e
       LEFT JOIN LATERAL (
         SELECT sh.start_time, sh.grace_minutes FROM hr_shift_allocations sa
         JOIN hr_shifts sh ON sh.id = sa.shift_id
         WHERE sa.employee_id = e.id AND sa.effective_from <= CURRENT_DATE
           AND (sa.effective_to IS NULL OR sa.effective_to >= CURRENT_DATE)
         ORDER BY sa.effective_from DESC LIMIT 1
       ) s ON TRUE`
  )
  const byCode = new Map<string, any>()
  const byName = new Map<string, any>()
  for (const e of empRows as any[]) {
    byCode.set(String(e.employee_code).toLowerCase().trim(), e)
    if (e.full_name) byName.set(e.full_name.trim(), e)
  }

  // 4. Walk rows — every "ID:" row starts a 2-row employee block
  let imported = 0, skipped = 0, unmatched = 0
  const unmatchedNames: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (String(row[0]).trim() !== 'ID:') continue

    const rawCode = String(row[2] ?? '').trim()
    const rawName = String(row[10] ?? '').trim()

    // Strip device prefix (e.g. "BT-05" → "05") for matching against employee_code
    const strippedCode = rawCode.replace(/^[A-Za-z]+-/i, '')

    let emp: any = byCode.get(rawCode.toLowerCase())
      ?? byCode.get(strippedCode.toLowerCase())
      ?? byCode.get(String(parseInt(strippedCode, 10)))  // "05" → "5" fallback
      ?? null
    if (!emp) {
      const normalised = rawName.replace(/~/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim()
      emp = byName.get(normalised) ?? null
    }

    const punchRow: any[] = rows[i + 1] || []
    i++ // always consume the punch row

    if (!emp) {
      unmatched++
      unmatchedNames.push(`${rawCode} / ${rawName}`)
      continue
    }

    const shiftStart = emp.shift_start ? String(emp.shift_start).slice(0, 5) : '09:00'
    const graceMins  = emp.grace_mins  ?? 10

    // 5. Parse each day column in the punch row
    for (let col = 0; col < punchRow.length; col++) {
      const cell = String(punchRow[col] ?? '').trim()
      if (!cell) continue

      const dateStr = colToDate(col)
      if (!dateStr) continue

      // Split concatenated times — each ZKTeco time is exactly HH:MM (5 chars)
      const rawTimes: string[] = []
      for (let t = 0; t + 5 <= cell.length; t += 5) {
        const slice = cell.slice(t, t + 5)
        if (/^\d{2}:\d{2}$/.test(slice)) rawTimes.push(slice)
      }
      if (rawTimes.length === 0) continue

      // Deduplicate consecutive identical times
      const times = dedup(rawTimes)
      const punch_count = times.length

      let checkIn:  string | null = null
      let checkOut: string | null = null
      let lunchOut: string | null = null
      let lunchIn:  string | null = null
      let status = 'present'
      let is_late_lunch = false
      let late_lunch_mins = 0
      let late_morning_mins = 0

      if (punch_count === 0) {
        // no usable punch — skip
        continue
      } else if (punch_count === 1) {
        // Single punch — mark present with amber indicator (punch_count stored = 1)
        checkIn = times[0] + ':00'
        status  = 'present'
        late_morning_mins = morningLateMins(times[0], shiftStart, graceMins)
        if (late_morning_mins > 0) status = 'late'
      } else if (punch_count === 2) {
        checkIn  = times[0] + ':00'
        checkOut = times[1] + ':00'
        late_morning_mins = morningLateMins(times[0], shiftStart, graceMins)
        status = late_morning_mins > 0 ? 'late' : 'present'
      } else if (punch_count === 3) {
        // Treat as: entry, lunch-out, exit (no lunch-in)
        checkIn  = times[0] + ':00'
        lunchOut = times[1] + ':00'
        checkOut = times[2] + ':00'
        late_morning_mins = morningLateMins(times[0], shiftStart, graceMins)
        status = late_morning_mins > 0 ? 'late' : 'present'
      } else {
        // 4+ punches: entry, lunch-out, lunch-in, exit
        checkIn  = times[0] + ':00'
        lunchOut = times[1] + ':00'
        lunchIn  = times[2] + ':00'
        checkOut = times[3] + ':00'
        late_morning_mins = morningLateMins(times[0], shiftStart, graceMins)
        late_lunch_mins   = lunchLateMins(times[1], times[2])
        is_late_lunch     = late_lunch_mins > 0
        status = late_morning_mins > 0 ? 'late' : 'present'
      }

      try {
        await db.execute(
          `INSERT INTO hr_attendance
             (employee_id, date, check_in, check_out, lunch_out, lunch_in,
              punch_count, status, is_late_lunch, late_lunch_mins, late_morning_mins)
           VALUES
             (:emp, :date, :ci, :co, :lo, :li,
              :pc, :status, :ill, :llm, :lmm)
           ON CONFLICT (employee_id, date) DO UPDATE
             SET check_in           = EXCLUDED.check_in,
                 check_out          = EXCLUDED.check_out,
                 lunch_out          = EXCLUDED.lunch_out,
                 lunch_in           = EXCLUDED.lunch_in,
                 punch_count        = EXCLUDED.punch_count,
                 status             = EXCLUDED.status,
                 is_late_lunch      = EXCLUDED.is_late_lunch,
                 late_lunch_mins    = EXCLUDED.late_lunch_mins,
                 late_morning_mins  = EXCLUDED.late_morning_mins`,
          {
            emp: emp.id, date: dateStr,
            ci: checkIn, co: checkOut, lo: lunchOut, li: lunchIn,
            pc: punch_count, status,
            ill: is_late_lunch, llm: late_lunch_mins, lmm: late_morning_mins
          }
        )
        imported++
      } catch {
        skipped++
      }
    }
  }

  return NextResponse.json({
    success: true,
    source: 'Att.log report (ZKTeco)',
    date_range: startDate,
    summary: { imported, skipped, unmatched, total_employees: (empRows as any[]).length },
    ...(unmatchedNames.length ? { unmatched_employees: unmatchedNames } : {}),
  })
}

// ── Generic column-based parser ───────────────────────────────────────────────

const COL_ALIASES: Record<string, string[]> = {
  employee_code: ['employee code','emp code','emp id','employee id','empcode','empid','id','code','staff id','card no','badge no','user id','enrollment no','enrollment number'],
  employee_name: ['employee name','emp name','name','full name','staff name'],
  date:          ['date','attendance date','att date','punch date','work date'],
  check_in:      ['in time','check in','checkin','punch in','time in','first in','arrival'],
  check_out:     ['out time','check out','checkout','punch out','time out','last out','departure'],
  status:        ['status','attendance status','remark'],
}

function resolveColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  const norm = headers.map(h => String(h ?? '').toLowerCase().trim())
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    for (const alias of aliases) {
      const idx = norm.indexOf(alias)
      if (idx !== -1) { map[field] = idx; break }
    }
  }
  return map
}

function parseDate(raw: any): string | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
    const parsed = new Date(s)
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0,10)
  }
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw)
    if (d) return `${d.y}-${String(d.M).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  return null
}

function parseTime(raw: any): string | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    const t = raw.trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
    if (t) return `${t[1].padStart(2,'0')}:${t[2]}:${t[3] ?? '00'}`
  }
  if (typeof raw === 'number') {
    const s = Math.round(raw * 86400)
    return `${String(Math.floor(s/3600)%24).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  }
  return null
}

async function parseGeneric(sheet: XLSX.WorkSheet): Promise<NextResponse> {
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (rows.length < 2) return NextResponse.json({ error: 'Sheet is empty' }, { status: 400 })

  let headerIdx = 0
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const text = rows[i].map((c: any) => String(c).toLowerCase()).join(' ')
    if (['date','name','code','id','time','punch','emp'].some(k => text.includes(k))) { headerIdx = i; break }
  }

  const headers = rows[headerIdx].map((h: any) => String(h ?? ''))
  const colMap = resolveColumns(headers)

  if (!colMap.date) {
    return NextResponse.json({
      error: `Could not find a "Date" column. Headers found: ${headers.join(', ')}`,
    }, { status: 400 })
  }

  const db = getDb()
  const [empRows] = await db.query(`SELECT id, employee_code, LOWER(CONCAT(first_name,' ',last_name)) AS full_name FROM hr_employees`)
  const byCode = new Map<string, number>()
  const byName = new Map<string, number>()
  for (const e of empRows as any[]) {
    byCode.set(String(e.employee_code).toLowerCase().trim(), e.id)
    if (e.full_name) byName.set(e.full_name.trim(), e.id)
  }

  let imported = 0, skipped = 0, unmatched = 0
  for (const row of rows.slice(headerIdx + 1)) {
    if (row.every((c: any) => !c && c !== 0)) continue
    const date = parseDate(row[colMap.date])
    if (!date) { skipped++; continue }

    let empId: number | null = null
    if (colMap.employee_code !== undefined) empId = byCode.get(String(row[colMap.employee_code] ?? '').toLowerCase().trim()) ?? null
    if (!empId && colMap.employee_name !== undefined) empId = byName.get(String(row[colMap.employee_name] ?? '').toLowerCase().trim()) ?? null
    if (!empId) { unmatched++; continue }

    const ci = colMap.check_in  !== undefined ? parseTime(row[colMap.check_in])  : null
    const co = colMap.check_out !== undefined ? parseTime(row[colMap.check_out]) : null
    const pc = (ci ? 1 : 0) + (co ? 1 : 0)

    try {
      await db.execute(
        `INSERT INTO hr_attendance (employee_id, date, check_in, check_out, punch_count, status)
         VALUES (:emp, :date, :ci, :co, :pc, 'present')
         ON CONFLICT (employee_id, date) DO UPDATE
           SET check_in=EXCLUDED.check_in, check_out=EXCLUDED.check_out,
               punch_count=EXCLUDED.punch_count, status='present'`,
        { emp: empId, date, ci, co, pc }
      )
      imported++
    } catch { skipped++ }
  }

  return NextResponse.json({ success: true, source: 'generic', summary: { imported, skipped, unmatched } })
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext || ''))
      return NextResponse.json({ error: 'Only .xlsx, .xls, or .csv files are supported' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'buffer' })

    if (wb.SheetNames.includes('Att.log report')) {
      return parseZKTeco(wb)
    }

    const firstSheet = wb.Sheets[wb.SheetNames[0]]
    return parseGeneric(firstSheet)
  } catch (err: any) {
    console.error('attendance/import error', err)
    return NextResponse.json({ error: err?.message || 'Import failed' }, { status: 500 })
  }
}
