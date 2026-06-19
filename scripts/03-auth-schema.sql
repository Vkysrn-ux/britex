-- Auth: users table
CREATE TABLE IF NOT EXISTS erp_users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          VARCHAR(30)  NOT NULL DEFAULT 'viewer',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erp_users_email ON erp_users(email);

-- Seed default users (password = "password@123" hashed with bcrypt rounds=10)
-- Hash is pre-generated; app will hash on creation via API too
-- Using bcrypt hash of "password@123"
INSERT INTO erp_users (name, email, password_hash, role) VALUES
  ('Admin User',  'admin@erp.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
  ('HR Manager',  'hr@erp.com',    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'hr')
ON CONFLICT (email) DO NOTHING;
