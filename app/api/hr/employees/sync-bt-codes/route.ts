import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import * as XLSX from 'xlsx'
import path from 'path'
import { getDb } from '@/lib/db'

// Normalise "BT  - 05" / "BT - 5" → "BT-05"
function normaliseBT(raw: string): string {
  const m = raw.replace(/\s+/g, '').match(/^BT-?(\d+)$/i)
  if (!m) return raw.trim()
  return 'BT-' + m[1].padStart(2, '0')
}

export async function POST() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'EMPLOYEES UPDATION NEW 2026-2027.xlsx')
    const wb = XLSX.readFile(filePath)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Collect (btCode, name) from data rows (skip header rows 0-2)
    type ExcelRow = { btCode: string; numericPart: string; name: string }
    const excelRows: ExcelRow[] = []
    for (const row of rows.slice(3)) {
      if (!row[0] || !row[1]) continue
      const raw = String(row[1]).trim()
      const btCode = normaliseBT(raw)
      // numeric part only: "BT-05" → "05" and "5"
      const numericPart = btCode.replace(/^BT-/i, '')
      const name = String(row[2] ?? '').trim()
      excelRows.push({ btCode, numericPart, name })
    }

    const db = getDb()
    const [empRows] = await db.query(
      `SELECT id, employee_code, LOWER(CONCAT(first_name, ' ', COALESCE(last_name,''))) AS full_name FROM hr_employees`
    )

    // Build lookup maps from DB
    const byCode     = new Map<string, any>()  // employee_code (lowercased) → row
    const byName     = new Map<string, any>()  // full_name (lowercased) → row
    const byNumeric  = new Map<string, any>()  // stripped numeric → row
    for (const e of empRows as any[]) {
      const code = String(e.employee_code).toLowerCase().trim()
      byCode.set(code, e)
      // also index by numeric-only version: "bt-05"→"05", "05"→"05", "5"→"5"
      const stripped = code.replace(/^bt-?/i, '').replace(/^0+/, '') || '0'
      byNumeric.set(stripped, e)
      byNumeric.set(stripped.padStart(2, '0'), e)
      if (e.full_name) byName.set(e.full_name.trim(), e)
    }

    const updated: string[] = []
    const skipped:  string[] = []

    for (const { btCode, numericPart, name } of excelRows) {
      const nameKey = name.toLowerCase().replace(/\s+/g, ' ').trim()
      const numKey  = numericPart.replace(/^0+/, '') || '0'

      // Match: exact btCode > numeric part > name
      const match =
        byCode.get(btCode.toLowerCase()) ??
        byCode.get(numericPart.toLowerCase()) ??
        byNumeric.get(numKey) ??
        byNumeric.get(numKey.padStart(2, '0')) ??
        byName.get(nameKey) ??
        null

      if (!match) {
        skipped.push(`${btCode} / ${name} — no match`)
        continue
      }

      if (String(match.employee_code) === btCode) {
        updated.push(`${btCode} already correct`)
        continue
      }

      await db.execute(
        `UPDATE hr_employees SET employee_code = :code WHERE id = :id`,
        { code: btCode, id: match.id }
      )
      updated.push(`${match.employee_code} → ${btCode}  (${name})`)
    }

    return NextResponse.json({
      success: true,
      summary: { total: excelRows.length, updated: updated.length, skipped: skipped.length },
      updated,
      skipped,
    })
  } catch (err: any) {
    console.error('sync-bt-codes error', err)
    return NextResponse.json({ error: err?.message || 'Sync failed' }, { status: 500 })
  }
}
