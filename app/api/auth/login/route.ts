import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'
import { signToken, sessionCookieOptions } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    if (!email || !password)
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

    const db = getDb()
    const [rows] = await db.query(
      `SELECT id, name, email, password_hash, role, is_active
         FROM erp_users WHERE email = :email LIMIT 1`,
      { email: email.toLowerCase().trim() }
    )
    const user = (rows as any[])[0]

    if (!user || !user.is_active)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    const session = { id: user.id, name: user.name, email: user.email, role: user.role }
    const token = await signToken(session)

    const res = NextResponse.json({ success: true, user: session })
    res.cookies.set(sessionCookieOptions(token))
    return res
  } catch (err: any) {
    console.error('login error', err)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
