import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const pool = new pg.Pool({ host: '147.93.155.21', port: 5432, user: 'postgres', password: 'Mind56%^', database: 'mattress_erp' })
const sql  = fs.readFileSync(path.join(__dirname, '04-shift-schema.sql'), 'utf8')

try {
  await pool.query(sql)
  console.log('Shift migration done')
  const r = await pool.query('SELECT id, name, start_time, end_time, break_minutes, grace_minutes FROM hr_shifts')
  console.log('Shifts:', r.rows)
} catch (e) {
  console.error('Error:', e.message)
} finally {
  await pool.end()
}
