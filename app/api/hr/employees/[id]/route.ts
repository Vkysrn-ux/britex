import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const updateSchema = z.object({
  first_name:        z.string().min(1).optional(),
  last_name:         z.string().optional().nullable(),
  email:             z.string().email().optional().nullable(),
  phone:             z.string().optional().nullable(),
  gender:            z.enum(['male', 'female', 'other']).optional().nullable(),
  date_of_birth:     z.string().optional().nullable(),
  date_of_joining:   z.string().optional(),
  department_id:     z.coerce.number().int().optional().nullable(),
  job_title:         z.string().optional().nullable(),
  employment_type:   z.enum(['full_time', 'part_time', 'contract', 'intern']).optional(),
  basic_salary:      z.coerce.number().min(0).optional(),
  day_rate:          z.coerce.number().min(0).optional(),
  esi_amount:        z.coerce.number().min(0).optional(),
  bank_account:      z.string().optional().nullable(),
  bank_name:         z.string().optional().nullable(),
  address:           z.string().optional().nullable(),
  emergency_contact: z.string().optional().nullable(),
  emergency_phone:   z.string().optional().nullable(),
  father_name:       z.string().optional().nullable(),
  blood_group:       z.string().optional().nullable(),
  contribution_type: z.string().optional().nullable(),
  status:            z.enum(['active', 'inactive', 'terminated']).optional(),
})

type Ctx = { params: { id: string } }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const db = getDb()
    const [rows] = await db.query(
      `SELECT e.*, d.name AS department_name
         FROM hr_employees e LEFT JOIN hr_departments d ON d.id = e.department_id
         WHERE e.id = :id`,
      { id: Number(params.id) }
    )
    const emp = (rows as any[])[0]
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    return NextResponse.json({ data: emp })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const parsed = updateSchema.parse(await req.json())
    const db = getDb()
    const sets = Object.keys(parsed).map(k => `${k} = :${k}`).join(', ')
    if (!sets) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    await db.execute(`UPDATE hr_employees SET ${sets} WHERE id = :id`, { ...parsed, id: Number(params.id) })
    const [rows] = await db.query(
      `SELECT e.*, d.name AS department_name FROM hr_employees e LEFT JOIN hr_departments d ON d.id = e.department_id WHERE e.id = :id`,
      { id: Number(params.id) }
    )
    return NextResponse.json({ data: (rows as any[])[0] })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    return NextResponse.json({ error: err?.message || 'Failed to update employee' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const db = getDb()
    await db.execute(`UPDATE hr_employees SET status = 'terminated' WHERE id = :id`, { id: Number(params.id) })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to terminate employee' }, { status: 500 })
  }
}
