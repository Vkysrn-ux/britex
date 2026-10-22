import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

// Bulk edit of existing employees (UI grid or edited Excel export).
// Only updates — never creates — so a bad sheet can't add duplicates.

const emptyToNull = (v: unknown) => (v === '' ? null : v)

const rowSchema = z.object({
  id:              z.coerce.number().int(),
  first_name:      z.string().trim().min(1, 'First name is required').optional(),
  last_name:       z.preprocess(emptyToNull, z.string().trim().optional().nullable()),
  department_id:   z.preprocess(emptyToNull, z.coerce.number().int().optional().nullable()),
  job_title:       z.preprocess(emptyToNull, z.string().trim().optional().nullable()),
  phone:           z.preprocess(emptyToNull, z.string().trim().optional().nullable()),
  gender:          z.preprocess(emptyToNull, z.enum(['male', 'female', 'other']).optional().nullable()),
  date_of_joining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Joining date must be YYYY-MM-DD').optional(),
  day_rate:        z.coerce.number().min(0).optional(),
  status:          z.enum(['active', 'inactive', 'terminated']).optional(),
})
const bodySchema = z.object({ updates: z.array(rowSchema).min(1).max(1000) })

export async function GET() {
  try {
    const [rows] = await getDb().query(
      `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.department_id,
              d.name AS department_name, e.job_title, e.phone, e.gender,
              TO_CHAR(e.date_of_joining, 'YYYY-MM-DD') AS date_of_joining,
              COALESCE(e.day_rate, 0) AS day_rate, e.status
         FROM hr_employees e LEFT JOIN hr_departments d ON d.id = e.department_id
        ORDER BY CAST(NULLIF(regexp_replace(e.employee_code, '\\D', '', 'g'), '') AS int) NULLS LAST, e.employee_code`
    )
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    console.error('GET employees/bulk error', err)
    return NextResponse.json({ error: 'Failed to load employees' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await req.json())
  } catch (err: any) {
    const issue = err?.issues?.[0]
    const where = issue ? ` (row ${Number(issue.path?.[1]) + 1}, ${issue.path?.[2] ?? ''})` : ''
    return NextResponse.json({ error: `${issue?.message || 'Invalid data'}${where}` }, { status: 400 })
  }

  const conn = await getDb().getConnection()
  try {
    await conn.beginTransaction()
    let updated = 0
    for (const { id, ...fields } of parsed.updates) {
      const keys = Object.keys(fields)
      if (!keys.length) continue
      const sets = keys.map(k => `${k} = :${k}`).join(', ')
      const [res] = await conn.execute(`UPDATE hr_employees SET ${sets} WHERE id = :id`, { ...fields, id })
      updated += (res as any).affectedRows || 0
    }
    await conn.commit()
    return NextResponse.json({ success: true, updated })
  } catch (err: any) {
    await conn.rollback()
    console.error('POST employees/bulk error', err)
    return NextResponse.json({ error: err?.message || 'Bulk update failed — nothing was changed' }, { status: 500 })
  } finally {
    conn.release()
  }
}
