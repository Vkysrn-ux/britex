import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import * as XLSX from 'xlsx'
import { getDb } from '@/lib/db'

// ─── Column aliases ──────────────────────────────────────────────────────────

const ALIASES: Record<string, string[]> = {
  employee_code:     ['emp id','emp code','employee code','employee id','code','staff id','id no','card no','badge','enroll no','enrollment no','emp no','employee no'],
  name:              ['name','employee name','emp name','full name','staff name'],
  first_name:        ['first name','firstname','fname','given name'],
  last_name:         ['last name','lastname','lname','surname','family name'],
  department:        ['department','dept','section','unit','division','branch'],
  designation:       ['designation','job title','position','role','post','title','grade'],
  phone:             ['contact number','phone','mobile','contact','mobile no','phone no','contact no','cell','ph no'],
  email:             ['email','email address','mail','email id'],
  date_of_joining:   ['date of joining','joining date','doj','join date','date joined','joining','joined on'],
  basic_salary:      ['basic salary','salary','basic pay','pay','ctc','gross salary','monthly salary','basic','wage'],
  employment_type:   ['employment type','type','emp type','category','contract type','worker type'],
  gender:            ['gender','sex','male / female','male/female'],
  date_of_birth:     ['date of birth','dob','birth date','birthday'],
  blood_group:       ['blood group','blood type','blood grp'],
  emergency_contact: ['emergency contact number','emergency contact','emergency no','emergency phone','emg contact'],
  address:           ['address (aadhaar)','address','residential address','home address','aadhaar address'],
  status:            ['status','emp status','employee status','active status'],
}

function resolveColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  const norm = headers.map(h => String(h ?? '').toLowerCase().trim().replace(/\s+/g, ' '))
  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const a of aliases) {
      const idx = norm.indexOf(a)
      if (idx !== -1 && !(field in map)) { map[field] = idx; break }
    }
  }
  return map
}

// NOTE: XLSX SSF.parse_date_code returns { y, m, d, H, M, S } where m=month, M=minutes
function parseDate(raw: any): string | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    const parsed = new Date(s)
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  }
  if (typeof raw === 'number' && raw > 0) {
    // Use JS Date arithmetic (avoids XLSX SSF field-naming confusion)
    // Excel epoch: Dec 30, 1899 (accounting for the 1900 leap-year bug)
    const msPerDay = 86400000
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const date = new Date(excelEpoch.getTime() + Math.floor(raw) * msPerDay)
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return null
}

// Normalise "BT  - 05" → "BT-05", etc.
function normaliseCode(raw: string): string {
  const m = raw.replace(/\s+/g, '').match(/^([A-Za-z]+)-?(\d+)$/)
  if (m) return `${m[1].toUpperCase()}-${m[2].padStart(2, '0')}`
  return raw.trim()
}

function normalizeEmpType(raw: string): string {
  const s = raw.toLowerCase().trim()
  if (s.includes('part')) return 'part_time'
  if (s.includes('contract') || s.includes('temp')) return 'contract'
  if (s.includes('intern') || s.includes('trainee')) return 'intern'
  return 'full_time'
}

function normalizeGender(raw: string): string | null {
  const s = raw.toLowerCase().trim()
  if (s === 'male' || s === 'm') return 'male'
  if (s === 'female' || s === 'f') return 'female'
  return null
}

// ─── Entry point ─────────────────────────────────────────────────────────────

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
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    if (rows.length < 2) return NextResponse.json({ error: 'File is empty or has only a header row' }, { status: 400 })

    // Find header row (first row with ≥2 recognisable keywords)
    let headerIdx = 0
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const text = rows[i].map((c: any) => String(c).toLowerCase()).join(' ')
      const hits = ['name', 'code', 'dept', 'emp', 'id', 'designation', 'joining', 'blood', 'contact'].filter(k => text.includes(k))
      if (hits.length >= 2) { headerIdx = i; break }
    }

    const headers = rows[headerIdx].map((h: any) => String(h ?? ''))
    const col = resolveColumns(headers)

    if (!col.employee_code && !col.name && !col.first_name)
      return NextResponse.json({ error: `Could not detect employee columns. Headers: ${headers.join(', ')}` }, { status: 400 })

    const db = getDb()

    // Cache departments (name → id)
    const [deptRows] = await db.query(`SELECT id, LOWER(name) AS lname FROM hr_departments`)
    const deptMap = new Map<string, number>()
    for (const d of deptRows as any[]) deptMap.set(d.lname.trim(), d.id)

    async function getOrCreateDept(name: string): Promise<number | null> {
      if (!name) return null
      const key = name.toLowerCase().trim()
      if (deptMap.has(key)) return deptMap.get(key)!
      const code = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'DEPT'
      const [r] = await db.execute(
        `INSERT INTO hr_departments (name, code) VALUES (:name, :code) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        { name: name.trim(), code }
      )
      const newId = (r as any).insertId
      deptMap.set(key, newId)
      return newId
    }

    let created = 0, updated = 0, skipped = 0
    const details: any[] = []
    const newDepts = new Set<string>()

    for (const row of rows.slice(headerIdx + 1)) {
      if (row.every((c: any) => !String(c).trim())) continue

      // Employee code — normalise "BT  - 05" → "BT-05"
      let empCode = col.employee_code !== undefined ? normaliseCode(String(row[col.employee_code] ?? '').trim()) : ''

      // Name resolution
      let firstName = '', lastName = ''
      if (col.first_name !== undefined) firstName = String(row[col.first_name] ?? '').trim()
      if (col.last_name  !== undefined) lastName  = String(row[col.last_name]  ?? '').trim()
      if (!firstName && col.name !== undefined) {
        const full = String(row[col.name] ?? '').trim()
        const parts = full.split(/\s+/)
        firstName = parts[0] || ''
        lastName  = parts.slice(1).join(' ')
      }

      if (!firstName && !empCode) { skipped++; continue }

      if (!empCode) {
        const initials = (firstName.slice(0, 2) + lastName.slice(0, 1)).toUpperCase() || 'EMP'
        empCode = `${initials}${Date.now().toString().slice(-4)}`
      }

      const rawDept    = col.department        !== undefined ? String(row[col.department]        ?? '').trim() : ''
      const designation= col.designation       !== undefined ? String(row[col.designation]       ?? '').trim() : ''
      const phone      = col.phone             !== undefined ? String(row[col.phone]             ?? '').trim() : ''
      const email      = col.email             !== undefined ? String(row[col.email]             ?? '').trim() : ''
      const doj        = col.date_of_joining   !== undefined ? parseDate(row[col.date_of_joining])  : null
      const dob        = col.date_of_birth     !== undefined ? parseDate(row[col.date_of_birth])    : null
      const bloodGroup = col.blood_group       !== undefined ? String(row[col.blood_group]       ?? '').trim() : ''
      const emergencyContact = col.emergency_contact !== undefined ? String(row[col.emergency_contact] ?? '').trim() : ''
      const address    = col.address           !== undefined ? String(row[col.address]           ?? '').trim() : ''
      const genderRaw  = col.gender            !== undefined ? String(row[col.gender]            ?? '').trim() : ''
      const gender     = normalizeGender(genderRaw)
      const salaryRaw  = col.basic_salary      !== undefined ? row[col.basic_salary] : null
      const salary     = salaryRaw !== null && salaryRaw !== '' ? Number(String(salaryRaw).replace(/[^0-9.]/g, '')) : 0
      const empTypeRaw = col.employment_type   !== undefined ? String(row[col.employment_type]   ?? '').trim() : ''
      const empType    = empTypeRaw ? normalizeEmpType(empTypeRaw) : 'full_time'
      const statusRaw  = col.status            !== undefined ? String(row[col.status]            ?? '').toLowerCase().trim() : ''
      const status     = statusRaw.includes('inactive') || statusRaw.includes('no') || statusRaw === '0' ? 'inactive' : 'active'

      const deptId = rawDept ? await getOrCreateDept(rawDept) : null
      if (rawDept && deptId) newDepts.add(rawDept)

      try {
        await db.execute(
          `INSERT INTO hr_employees
             (employee_code, first_name, last_name, department_id, job_title, phone, email,
              employment_type, basic_salary, status, date_of_joining, date_of_birth,
              gender, blood_group, emergency_contact, address)
           VALUES
             (:code, :fn, :ln, :dept, :jt, :ph, :em,
              :et, :sal, :st, :doj, :dob,
              :gen, :bg, :ec, :addr)
           ON CONFLICT (employee_code) DO UPDATE SET
             first_name        = EXCLUDED.first_name,
             last_name         = EXCLUDED.last_name,
             department_id     = COALESCE(EXCLUDED.department_id,     hr_employees.department_id),
             job_title         = COALESCE(NULLIF(EXCLUDED.job_title,''),         hr_employees.job_title),
             phone             = COALESCE(NULLIF(EXCLUDED.phone,''),             hr_employees.phone),
             email             = COALESCE(NULLIF(EXCLUDED.email,''),             hr_employees.email),
             employment_type   = EXCLUDED.employment_type,
             basic_salary      = CASE WHEN EXCLUDED.basic_salary > 0 THEN EXCLUDED.basic_salary ELSE hr_employees.basic_salary END,
             status            = EXCLUDED.status,
             date_of_joining   = COALESCE(EXCLUDED.date_of_joining, hr_employees.date_of_joining),
             date_of_birth     = COALESCE(EXCLUDED.date_of_birth,   hr_employees.date_of_birth),
             gender            = COALESCE(EXCLUDED.gender,           hr_employees.gender),
             blood_group       = COALESCE(NULLIF(EXCLUDED.blood_group,''),       hr_employees.blood_group),
             emergency_contact = COALESCE(NULLIF(EXCLUDED.emergency_contact,''), hr_employees.emergency_contact),
             address           = COALESCE(NULLIF(EXCLUDED.address,''),           hr_employees.address)`,
          { code: empCode, fn: firstName, ln: lastName || '', dept: deptId,
            jt: designation || null, ph: phone || null, em: email || null,
            et: empType, sal: salary || 0, st: status,
            doj: doj || new Date().toISOString().slice(0, 10), dob: dob || null,
            gen: gender || null, bg: bloodGroup || null,
            ec: emergencyContact || null, addr: address || null }
        )
        updated++
        details.push({ code: empCode, name: `${firstName} ${lastName}`.trim(), dept: rawDept, action: 'updated' })
      } catch (err: any) {
        skipped++
        details.push({ code: empCode, name: `${firstName} ${lastName}`.trim(), dept: rawDept, action: `error: ${err.message}` })
      }
    }

    return NextResponse.json({
      success: true,
      summary: { created, updated, skipped, departments_created: newDepts.size, total: created + updated + skipped },
      departments: [...newDepts],
      detected_columns: Object.fromEntries(Object.entries(col).map(([k, v]) => [k, headers[v]])),
      details,
    })
  } catch (err: any) {
    console.error('import-excel error', err)
    return NextResponse.json({ error: err?.message || 'Import failed' }, { status: 500 })
  }
}
