import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import * as XLSX from 'xlsx'
import path from 'path'
import { getDb } from '@/lib/db'

const EXCEL_FILE = 'EMPLOYEES UPDATION NEW 2026-2027.xlsx'

// Excel serial → YYYY-MM-DD
function serialToDate(n: number): string {
  const epoch = new Date(Date.UTC(1899, 11, 30))
  const d = new Date(epoch.getTime() + Math.floor(n) * 86400000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function parseDate(raw: any): string | null {
  if (!raw) return null
  if (typeof raw === 'number' && raw > 0) return serialToDate(raw)
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    const p = new Date(s)
    if (!isNaN(p.getTime())) return p.toISOString().slice(0, 10)
  }
  return null
}

// "BT  - 05" → "BT-05"
function normCode(raw: string): string {
  const m = raw.replace(/\s+/g, '').match(/^([A-Za-z]+)-?(\d+)$/)
  if (m) return `${m[1].toUpperCase()}-${m[2].padStart(2, '0')}`
  return raw.trim()
}

function normGender(raw: string): string | null {
  const s = raw.toLowerCase().trim()
  if (s === 'male' || s === 'm') return 'male'
  if (s === 'female' || s === 'f') return 'female'
  return null
}

export async function POST() {
  try {
  const db = getDb()

  // ── 1. Save June 2026 attendance keyed by employee name ───────────────────
  const [juneRows] = await db.query(`
    SELECT a.*, LOWER(CONCAT(e.first_name,' ',COALESCE(e.last_name,''))) AS emp_name
      FROM hr_attendance a
      JOIN hr_employees e ON e.id = a.employee_id
     WHERE EXTRACT(YEAR  FROM a.date) = 2026
       AND EXTRACT(MONTH FROM a.date) = 6
  `)
  const juneAttendance = juneRows as any[]

  // ── 2. Wipe in FK-safe order: attendance → shift allocations → employees ──
  await db.execute(`DELETE FROM hr_attendance`,       {})
  await db.execute(`DELETE FROM hr_shift_allocations`, {})
  await db.execute(`DELETE FROM hr_employees`,        {})

  // ── 3. Read public Excel ─────────────────────────────────────────────────
  const filePath = path.join(process.cwd(), 'public', EXCEL_FILE)
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  // col indices from header row (row index 2):
  // 0=S.No  1=Emp ID  2=Name  3=AADHAR NAME  4=Male/Female  5=Blood Group
  // 6=DOB   7=Age     8=DOJ   9=Edu Qual      10=Department  11=Designation
  // 12=Experience  13=Contact  14=Emergency Contact  15=Address  16=Aadhaar

  // Get or create department
  const [deptRows] = await db.query(`SELECT id, LOWER(name) AS lname FROM hr_departments`)
  const deptMap = new Map<string, number>()
  for (const d of deptRows as any[]) deptMap.set(d.lname.trim(), d.id)

  async function getOrCreateDept(name: string): Promise<number | null> {
    if (!name) return null
    const key = name.toLowerCase().trim()
    if (deptMap.has(key)) return deptMap.get(key)!
    const code = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'DEPT'
    const [r] = await db.execute(
      `INSERT INTO hr_departments (name, code) VALUES (:name, :code)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      { name: name.trim(), code }
    )
    const newId = (r as any).insertId
    deptMap.set(key, newId)
    return newId
  }

  let created = 0, skipped = 0
  const details: any[] = []
  // name (lowercased) → new employee id  (for re-linking attendance)
  const nameToId = new Map<string, number>()

  for (const row of rows.slice(3)) {
    if (!row[0] || !row[1]) continue

    const empCode  = normCode(String(row[1]).trim())
    const fullName = String(row[2] ?? '').trim()
    if (!fullName && !empCode) continue

    // Split name: first word = firstName, rest = lastName
    const parts     = fullName.split(/\s+/)
    const firstName = parts[0] || empCode
    const lastName  = parts.slice(1).join(' ') || ''

    const gender   = normGender(String(row[4] ?? ''))
    const bloodGrp = String(row[5] ?? '').trim() || null
    const dob      = parseDate(row[6])
    const doj      = parseDate(row[8])
    const dept     = String(row[10] ?? '').trim()
    const desig    = String(row[11] ?? '').trim()
    const phone    = String(row[13] ?? '').replace(/\D/g, '').slice(0, 15) || null
    const emgCont  = String(row[14] ?? '').replace(/\D/g, '').slice(0, 15) || null
    const address  = String(row[15] ?? '').trim() || null

    const deptId = dept ? await getOrCreateDept(dept) : null

    try {
      const [r] = await db.execute(
        `INSERT INTO hr_employees
           (employee_code, first_name, last_name, department_id, job_title,
            phone, employment_type, basic_salary, status,
            date_of_joining, date_of_birth, gender, blood_group,
            emergency_contact, address)
         VALUES
           (:code, :fn, :ln, :dept, :jt,
            :ph, 'full_time', 0, 'active',
            :doj, :dob, :gen, :bg,
            :ec, :addr)
         RETURNING id`,
        {
          code: empCode, fn: firstName, ln: lastName || '', dept: deptId, jt: desig || null,
          ph: phone, doj: doj || new Date().toISOString().slice(0, 10), dob: dob || null,
          gen: gender, bg: bloodGrp, ec: emgCont, addr: address
        }
      )
      const newId = (r as any).insertId
      created++
      nameToId.set(fullName.toLowerCase().trim(), newId)
      details.push({ code: empCode, name: fullName, dept, action: 'created' })
    } catch (err: any) {
      skipped++
      details.push({ code: empCode, name: fullName, dept, action: `error: ${err.message}` })
    }
  }

  // ── 4. Re-link June attendance by employee name ──────────────────────────
  let attRestored = 0, attUnmatched = 0
  for (const att of juneAttendance) {
    const nameKey = att.emp_name?.trim()
    const empId   = nameKey ? nameToId.get(nameKey) : null
    if (!empId) { attUnmatched++; continue }
    try {
      await db.execute(
        `INSERT INTO hr_attendance
           (employee_id, date, check_in, check_out, lunch_out, lunch_in,
            punch_count, status, is_late_lunch, late_lunch_mins, late_morning_mins)
         VALUES
           (:eid, :date, :ci, :co, :lo, :li,
            :pc, :st, :ill, :llm, :lmm)
         ON CONFLICT (employee_id, date) DO NOTHING`,
        {
          eid: empId, date: att.date,
          ci: att.check_in  || null, co: att.check_out  || null,
          lo: att.lunch_out || null, li: att.lunch_in   || null,
          pc: att.punch_count || 0,
          st: att.status || 'present',
          ill: att.is_late_lunch  || false,
          llm: att.late_lunch_mins  || 0,
          lmm: att.late_morning_mins || 0,
        }
      )
      attRestored++
    } catch { attUnmatched++ }
  }

  return NextResponse.json({
    success: true,
    summary: {
      employees_created: created,
      employees_skipped: skipped,
      june_attendance_restored: attRestored,
      june_attendance_unmatched: attUnmatched,
    },
    details,
  })
  } catch (err: any) {
    console.error('reset-import error:', err)
    return NextResponse.json({ error: err?.message || 'Reset failed' }, { status: 500 })
  }
}
