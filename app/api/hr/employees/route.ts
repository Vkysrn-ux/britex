import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { z } from 'zod'
import { getDb } from '@/lib/db'

const schema = z.object({
  employee_code: z.string().min(1),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  date_of_joining: z.string().min(1),
  department_id: z.coerce.number().int().optional().nullable(),
  job_title: z.string().optional().nullable(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']).default('full_time'),
  basic_salary: z.coerce.number().min(0).default(0),
  bank_account: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  emergency_contact: z.string().optional().nullable(),
  emergency_phone: z.string().optional().nullable(),
})

const SELECT_COLS = `
  e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone,
  e.gender, e.date_of_birth, e.date_of_joining, e.department_id,
  e.job_title, e.employment_type, e.basic_salary, e.bank_account, e.bank_name,
  e.address, e.emergency_contact, e.emergency_phone, e.status,
  e.created_at, e.updated_at,
  d.name AS department_name`

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'active'
    const dept = searchParams.get('department_id')
    const search = searchParams.get('search') || ''

    const db = getDb()
    let sql = `SELECT ${SELECT_COLS} FROM hr_employees e
               LEFT JOIN hr_departments d ON d.id = e.department_id
               WHERE 1=1`
    const params: Record<string, any> = {}

    if (status !== 'all') { sql += ' AND e.status = :status'; params.status = status }
    if (dept) { sql += ' AND e.department_id = :dept'; params.dept = Number(dept) }
    if (search) {
      sql += ` AND (e.first_name ILIKE :search OR e.last_name ILIKE :search
                    OR e.employee_code ILIKE :search OR e.email ILIKE :search)`
      params.search = `%${search}%`
    }
    sql += ' ORDER BY e.first_name, e.last_name'

    const [rows] = await db.query(sql, params)
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    console.error('GET hr/employees error', err)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const parsed = schema.parse(await req.json())
    const db = getDb()
    const [result] = await db.execute(
      `INSERT INTO hr_employees (
         employee_code, first_name, last_name, email, phone, gender,
         date_of_birth, date_of_joining, department_id, job_title,
         employment_type, basic_salary, bank_account, bank_name,
         address, emergency_contact, emergency_phone
       ) VALUES (
         :employee_code, :first_name, :last_name, :email, :phone, :gender,
         :date_of_birth, :date_of_joining, :department_id, :job_title,
         :employment_type, :basic_salary, :bank_account, :bank_name,
         :address, :emergency_contact, :emergency_phone
       )`,
      { ...parsed, email: parsed.email ?? null, phone: parsed.phone ?? null,
        gender: parsed.gender ?? null, date_of_birth: parsed.date_of_birth ?? null,
        department_id: parsed.department_id ?? null, job_title: parsed.job_title ?? null,
        bank_account: parsed.bank_account ?? null, bank_name: parsed.bank_name ?? null,
        address: parsed.address ?? null, emergency_contact: parsed.emergency_contact ?? null,
        emergency_phone: parsed.emergency_phone ?? null }
    )
    const [rows] = await db.query(
      `SELECT ${SELECT_COLS} FROM hr_employees e LEFT JOIN hr_departments d ON d.id = e.department_id WHERE e.id = :id`,
      { id: (result as any).insertId }
    )
    return NextResponse.json({ data: (rows as any[])[0] }, { status: 201 })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    console.error('POST hr/employees error', err)
    return NextResponse.json({ error: err?.message || 'Failed to create employee' }, { status: 500 })
  }
}
