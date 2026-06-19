import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const pool = new pg.Pool({ host: '147.93.155.21', port: 5432, user: 'postgres', password: 'Mind56%^', database: 'mattress_erp' })
const sql  = fs.readFileSync(path.join(__dirname, '05-attendance-punch-cols.sql'), 'utf8')

try {
  await pool.query(sql)
  console.log('Punch-cols migration done')
  const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='hr_attendance' ORDER BY ordinal_position`)
  console.log('Columns:', r.rows.map(c => c.column_name).join(', '))
} catch (e) {
  console.error('Error:', e.message)
} finally {
  await pool.end()
}
