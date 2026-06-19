import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const pool = new pg.Pool({
  host:     '147.93.155.21',
  port:     5432,
  user:     'postgres',
  password: 'Mind56%^',
  database: 'mattress_erp',
})

const sql = fs.readFileSync(path.join(__dirname, '03-auth-schema.sql'), 'utf8')

try {
  await pool.query(sql)
  console.log('Auth migration done')
  const r = await pool.query('SELECT id, name, email, role FROM erp_users')
  console.log('Users:', r.rows)
} catch (e) {
  console.error('Migration error:', e.message)
} finally {
  await pool.end()
}
