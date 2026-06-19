import type { Pool } from 'pg'
import fs from 'fs/promises'
import path from 'path'

let started = false
let done: Promise<void> | null = null

export function scheduleMigrationsOnce(pool: Pool) {
  if (started) return done!
  started = true
  done = run(pool).catch(err => {
    console.error('Migrations failed (continuing):', err?.message || err)
  })
  return done!
}

async function run(pool: Pool) {
  await ensureDatabaseExists()
  await runSchemaFile(pool)
}

async function ensureDatabaseExists() {
  const { Pool: PgPool } = await import('pg')
  const db = process.env.DB_NAME || 'mattress_erp'
  const adminPool = new PgPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'postgres',
    max: 1,
  })
  try {
    const res = await adminPool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [db])
    if ((res.rowCount ?? 0) === 0) {
      await adminPool.query(`CREATE DATABASE "${db.replace(/"/g, '')}"`)
      console.log(`[DB BOOTSTRAP] Created database ${db}`)
    }
  } catch (e: any) {
    console.warn('[DB] Could not ensure database exists:', e?.message || e)
  } finally {
    await adminPool.end()
  }
}

async function runSchemaFile(pool: Pool) {
  const schemaFile = path.join(process.cwd(), 'scripts', '01-database-schema.sql')
  let sql: string
  try {
    sql = await fs.readFile(schemaFile, 'utf8')
  } catch (e) {
    console.error('[SQL FILE] Cannot read', schemaFile, '-', (e as any)?.message || e)
    return
  }

  const client = await pool.connect()
  try {
    for (const stmt of splitStatements(sql)) {
      const trimmed = stmt.trim()
      if (!trimmed) continue
      try {
        await client.query(trimmed)
      } catch (e: any) {
        const msg = String(e?.message || '').toLowerCase()
        const ok = ['already exists', 'does not exist', 'duplicate'].some(t => msg.includes(t))
        if (!ok) console.warn('[SCHEMA] Warning:', String(e?.message || '').substring(0, 200))
      }
    }
  } finally {
    client.release()
  }
}

// Split SQL on semicolons, respecting $$ dollar-quoted blocks
function splitStatements(sql: string): string[] {
  const stmts: string[] = []
  let buf = ''
  let inDollar = false
  let tag = ''
  let i = 0
  while (i < sql.length) {
    if (!inDollar && sql[i] === '$') {
      const end = sql.indexOf('$', i + 1)
      if (end !== -1) {
        const t = sql.slice(i, end + 1)
        if (/^\$[a-zA-Z_]*\$$/.test(t)) {
          inDollar = true; tag = t; buf += t; i = end + 1; continue
        }
      }
    } else if (inDollar && sql.slice(i, i + tag.length) === tag) {
      inDollar = false; buf += tag; i += tag.length; continue
    }
    if (!inDollar && sql[i] === ';') {
      stmts.push(buf); buf = ''; i++
    } else {
      buf += sql[i]; i++
    }
  }
  if (buf.trim()) stmts.push(buf)
  return stmts
}
