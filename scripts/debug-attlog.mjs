import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath  = path.join(__dirname, '..', 'public', '1_StandardReport.xls')

const buf = fs.readFileSync(filePath)
const wb  = XLSX.read(buf, { type: 'buffer' })

console.log('Sheets:', wb.SheetNames)

const sheet = wb.Sheets['Att.log report']
if (!sheet) { console.log('No Att.log report sheet!'); process.exit(1) }

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
console.log('Total rows:', rows.length)

// Find date range
let startDate = ''
for (const row of rows) {
  for (const cell of row) {
    const m = String(cell).match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/)
    if (m) { startDate = m[1]; console.log('Date range found:', cell, '| startDate:', startDate); break }
  }
  if (startDate) break
}

// Find day header row
let dayHeaderRow = []
for (let i = 0; i < rows.length; i++) {
  const row = rows[i]
  const nums = row.filter(c => typeof c === 'number' && Number.isInteger(c) && c >= 1 && c <= 31)
  if (nums.length >= 5) {
    dayHeaderRow = row
    console.log(`Day header row found at index ${i}:`, JSON.stringify(row.slice(0, 25)))
    break
  }
}

if (!dayHeaderRow.length) {
  console.log('Day header row NOT found! Checking rows 0-6:')
  for (let i = 0; i < 7; i++) {
    const row = rows[i] || []
    console.log(`Row ${i}:`, JSON.stringify(row.slice(0, 25)))
    console.log(`  Types:`, row.slice(0,25).map(c => `${typeof c}(${c})`).join(', '))
  }
}

// Find first employee block
for (let i = 0; i < rows.length; i++) {
  const row = rows[i]
  if (String(row[0]).trim() === 'ID:') {
    console.log(`\nFirst employee at row ${i}:`)
    console.log('  Info:', JSON.stringify(row.slice(0,22)))
    const punchRow = rows[i+1] || []
    console.log('  Punch:', JSON.stringify(punchRow.slice(0,22)))
    console.log('  Punch types:', punchRow.slice(0,22).map(c => `${typeof c}`).join(', '))
    break
  }
}
