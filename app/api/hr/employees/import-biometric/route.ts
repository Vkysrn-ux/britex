import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import path from 'path'
import fs from 'fs'
import * as XLSX from 'xlsx'
import { getDb } from '@/lib/db'

function parseName(raw: string): { first_name: string; last_name: string } {
  // Split on ~ (biometric separator), filter empty parts
  const parts = raw.split('~').map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) return { first_name: 'Unknown', last_name: '' }

  const toTitle = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

  if (parts.length === 1) {
    return { first_name: toTitle(parts[0]), last_name: '' }
  }

  // If last part is a single letter it's an initial; middle parts join as first name
  // e.g. RIZWANA~BANU~M → first: "Rizwana Banu", last: "M"
  // e.g. SARASWATHI~RAMASAMY → first: "Saraswathi", last: "Ramasamy"
  const last = parts[parts.length - 1]
  const rest = parts.slice(0, -1).map(toTitle).join(' ')
  return { first_name: rest, last_name: toTitle(last) }
}

function toCode(id: string | number): string {
  return String(id).trim()
}

export async function POST() {
  try {
    const filePath = path.join(process.cwd(), 'public', '1_StandardReport.xls')
    const fileBuffer = fs.readFileSync(filePath)
    const wb = XLSX.read(fileBuffer, { type: 'buffer' })
    const ws = wb.Sheets['Schedule Infor.']
    if (!ws) return NextResponse.json({ error: 'Sheet "Schedule Infor." not found in file' }, { status: 400 })

    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Data rows start at index 4 (after title, date range, header, day-name rows)
    const empRows = rows.slice(4).filter(r => r[0] !== '' && r[0] != null)

    const db = getDb()

    // ── Step 1: collect unique departments and upsert them ────────────────────
    const deptNames = [...new Set(empRows.map(r => String(r[2]).trim()).filter(Boolean))]
    const deptIdMap: Record<string, number> = {}

    for (const name of deptNames) {
      const code = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20) || 'DEPT'
      // Try insert, ignore conflict
      await db.execute(
        `INSERT INTO hr_departments (name, code) VALUES (:name, :code)
         ON CONFLICT (code) DO NOTHING`,
        { name, code }
      )
      const [rows] = await db.query(
        `SELECT id FROM hr_departments WHERE code = :code`, { code }
      )
      const dept = (rows as any[])[0]
      if (dept) deptIdMap[name] = dept.id
    }

    // ── Step 2: import employees ──────────────────────────────────────────────
    let created = 0, skipped = 0, updated = 0
    const details: { code: string; name: string; dept: string; action: string }[] = []

    for (const row of empRows) {
      const rawCode = toCode(row[0])
      const rawName = String(row[1]).trim()
      const rawDept = String(row[2]).trim()

      if (!rawCode || !rawName) { skipped++; continue }

      const { first_name, last_name } = parseName(rawName)
      const deptId = deptIdMap[rawDept] ?? null

      // Check if employee already exists by employee_code
      const [existing] = await db.query(
        `SELECT id FROM hr_employees WHERE employee_code = :code`, { code: rawCode }
      )

      if ((existing as any[]).length > 0) {
        // Update department if missing
        await db.execute(
          `UPDATE hr_employees
              SET department_id = COALESCE(department_id, :dept_id)
            WHERE employee_code = :code AND department_id IS NULL`,
          { dept_id: deptId, code: rawCode }
        )
        skipped++
        details.push({ code: rawCode, name: `${first_name} ${last_name}`.trim(), dept: rawDept, action: 'skipped (exists)' })
        continue
      }

      await db.execute(
        `INSERT INTO hr_employees
           (employee_code, first_name, last_name, department_id, date_of_joining)
         VALUES (:code, :first_name, :last_name, :dept_id, CURRENT_DATE)`,
        { code: rawCode, first_name, last_name, dept_id: deptId }
      )
      created++
      details.push({ code: rawCode, name: `${first_name} ${last_name}`.trim(), dept: rawDept, action: 'created' })
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: empRows.length,
        created,
        skipped,
        departments_created: Object.keys(deptIdMap).length,
      },
      departments: Object.keys(deptIdMap),
      details,
    })
  } catch (err: any) {
    console.error('import-biometric error', err)
    return NextResponse.json({ error: err?.message || 'Import failed' }, { status: 500 })
  }
}
