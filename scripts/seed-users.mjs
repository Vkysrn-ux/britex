import pg from 'pg'
import bcrypt from 'bcryptjs'

const pool = new pg.Pool({
  host: '147.93.155.21', port: 5432,
  user: 'postgres', password: 'Mind56%^', database: 'mattress_erp',
})

const users = [
  { name: 'Admin User',       email: 'admin@erp.com',      password: 'Admin@123',    role: 'admin' },
  { name: 'HR Manager',       email: 'hr@erp.com',         password: 'Hr@123',       role: 'hr' },
  { name: 'Production Head',  email: 'prod@erp.com',       password: 'Prod@123',     role: 'production' },
  { name: 'Sales Manager',    email: 'sales@erp.com',      password: 'Sales@123',    role: 'sales' },
  { name: 'QC Manager',       email: 'quality@erp.com',    password: 'Quality@123',  role: 'quality' },
  { name: 'Warehouse Manager',email: 'warehouse@erp.com',  password: 'Warehouse@123',role: 'warehouse' },
]

for (const u of users) {
  const hash = await bcrypt.hash(u.password, 10)
  await pool.query(
    `INSERT INTO erp_users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash=$3, name=$1, role=$4`,
    [u.name, u.email, hash, u.role]
  )
  console.log(`✓ ${u.email} (${u.role}) → password: ${u.password}`)
}

await pool.end()
console.log('\nAll users seeded.')
