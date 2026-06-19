import { Pool, PoolClient } from 'pg'
import { scheduleMigrationsOnce } from './migrate'

let pool: Pool | null = null

// Convert :name placeholders to $1, $2, ... positional params for pg
function convertNamed(sql: string, params: Record<string, any> = {}) {
  const order: string[] = []
  const converted = sql.replace(/:([a-zA-Z_]\w*)/g, (_, name) => {
    let i = order.indexOf(name)
    if (i === -1) { order.push(name); i = order.length - 1 }
    return `$${i + 1}`
  })
  return { sql: converted, values: order.map(n => params[n] ?? null) }
}

async function runQuery(client: Pool | PoolClient, rawSql: string, params?: Record<string, any>) {
  const { sql, values } = convertNamed(rawSql, params || {})
  const res = await client.query(sql, values.length ? values : [])
  return [res.rows] as [any[]]
}

async function runExecute(client: Pool | PoolClient, rawSql: string, params?: Record<string, any>) {
  const isInsert = /^\s*INSERT\b/i.test(rawSql.trim())
  const { sql: converted, values } = convertNamed(rawSql, params || {})
  const finalSql = isInsert && !/\bRETURNING\b/i.test(converted)
    ? converted.replace(/\s*;\s*$/, '') + ' RETURNING id'
    : converted
  const res = await client.query(finalSql, values.length ? values : [])
  if (isInsert) {
    return [{ insertId: res.rows[0]?.id ?? null, affectedRows: res.rowCount }] as [any]
  }
  return [{ affectedRows: res.rowCount }] as [any]
}

function wrapClient(client: PoolClient) {
  return {
    query: (sql: string, params?: Record<string, any>) => runQuery(client, sql, params),
    execute: (sql: string, params?: Record<string, any>) => runExecute(client, sql, params),
    beginTransaction: () => client.query('BEGIN').then(() => undefined as void),
    commit: () => client.query('COMMIT').then(() => undefined as void),
    rollback: () => client.query('ROLLBACK').then(() => undefined as void),
    release: () => client.release(),
  }
}

export function getDb() {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'postgres',
      max: 10,
    })
    scheduleMigrationsOnce(pool)
  }
  return {
    query: (sql: string, params?: Record<string, any>) => runQuery(pool!, sql, params),
    execute: (sql: string, params?: Record<string, any>) => runExecute(pool!, sql, params),
    getConnection: async () => wrapClient(await pool!.connect()),
  }
}

export type Db = ReturnType<typeof getDb>
