import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const schema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(20),
  description: z.string().optional().nullable(),
  head_id: z.coerce.number().int().optional().nullable(),
})

export async function GET() {
  try {
    const db = getDb()
    const [rows] = await db.query(
      `SELECT d.id, d.name, d.code, d.description, d.head_id,
              CONCAT(e.first_name,' ',e.last_name) AS head_name,
              COUNT(emp.id) AS employee_count
         FROM hr_departments d
         LEFT JOIN hr_employees e ON e.id = d.head_id
         LEFT JOIN hr_employees emp ON emp.department_id = d.id AND emp.status = 'active'
         GROUP BY d.id, d.name, d.code, d.description, d.head_id, e.first_name, e.last_name
         ORDER BY d.name`
    )
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    console.error('GET hr/departments error', err)
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const parsed = schema.parse(await req.json())
    const db = getDb()
    const [result] = await db.execute(
      `INSERT INTO hr_departments (name, code, description, head_id)
       VALUES (:name, :code, :description, :head_id)`,
      { name: parsed.name, code: parsed.code.toUpperCase(), description: parsed.description ?? null, head_id: parsed.head_id ?? null }
    )
    const [rows] = await db.query('SELECT * FROM hr_departments WHERE id = :id', { id: (result as any).insertId })
    return NextResponse.json({ data: (rows as any[])[0] }, { status: 201 })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    console.error('POST hr/departments error', err)
    return NextResponse.json({ error: err?.message || 'Failed to create department' }, { status: 500 })
  }
}
