-- HR Management System Schema

-- HR Departments
CREATE TABLE IF NOT EXISTS hr_departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_hr_departments_updated_at ON hr_departments;
CREATE TRIGGER trg_hr_departments_updated_at BEFORE UPDATE ON hr_departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- HR Employees
CREATE TABLE IF NOT EXISTS hr_employees (
  id SERIAL PRIMARY KEY,
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  gender TEXT CHECK (gender IN ('male','female','other')),
  date_of_birth DATE,
  date_of_joining DATE NOT NULL DEFAULT CURRENT_DATE,
  department_id INT REFERENCES hr_departments(id),
  job_title VARCHAR(100),
  employment_type TEXT DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  basic_salary DECIMAL(12,2) DEFAULT 0,
  bank_account VARCHAR(50),
  bank_name VARCHAR(100),
  address TEXT,
  emergency_contact VARCHAR(100),
  emergency_phone VARCHAR(20),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','terminated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_hr_employees_updated_at ON hr_employees;
CREATE TRIGGER trg_hr_employees_updated_at BEFORE UPDATE ON hr_employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_hr_emp_dept ON hr_employees(department_id);
CREATE INDEX IF NOT EXISTS idx_hr_emp_status ON hr_employees(status);

-- Department head (added after employees table exists)
ALTER TABLE hr_departments ADD COLUMN IF NOT EXISTS head_id INT REFERENCES hr_employees(id);

-- HR Attendance
CREATE TABLE IF NOT EXISTS hr_attendance (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES hr_employees(id),
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  status TEXT DEFAULT 'present' CHECK (status IN ('present','absent','half_day','late','on_leave')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, date)
);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_date ON hr_attendance(date);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_emp ON hr_attendance(employee_id);

-- HR Leave Types
CREATE TABLE IF NOT EXISTS hr_leave_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  days_per_year INT DEFAULT 0,
  carry_forward BOOLEAN DEFAULT FALSE,
  paid BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default leave types
INSERT INTO hr_leave_types (name, code, days_per_year, carry_forward, paid) VALUES
  ('Annual Leave',   'AL',  18, TRUE,  TRUE),
  ('Sick Leave',     'SL',  12, FALSE, TRUE),
  ('Casual Leave',   'CL',  6,  FALSE, TRUE),
  ('Maternity Leave','ML',  90, FALSE, TRUE),
  ('Unpaid Leave',   'UL',  0,  FALSE, FALSE)
ON CONFLICT (code) DO NOTHING;

-- HR Leave Requests
CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES hr_employees(id),
  leave_type_id INT NOT NULL REFERENCES hr_leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INT NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by INT REFERENCES hr_employees(id),
  approved_at TIMESTAMPTZ,
  rejection_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_leave_emp ON hr_leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_status ON hr_leave_requests(status);

-- HR Payroll Runs
CREATE TABLE IF NOT EXISTS hr_payroll (
  id SERIAL PRIMARY KEY,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','processed','paid')),
  total_gross DECIMAL(12,2) DEFAULT 0,
  total_deductions DECIMAL(12,2) DEFAULT 0,
  total_net DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  processed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (month, year)
);

-- HR Payroll Items (per employee per payroll run)
CREATE TABLE IF NOT EXISTS hr_payroll_items (
  id SERIAL PRIMARY KEY,
  payroll_id INT NOT NULL REFERENCES hr_payroll(id),
  employee_id INT NOT NULL REFERENCES hr_employees(id),
  basic_salary DECIMAL(12,2) DEFAULT 0,
  allowances DECIMAL(12,2) DEFAULT 0,
  overtime_pay DECIMAL(12,2) DEFAULT 0,
  gross_salary DECIMAL(12,2) DEFAULT 0,
  tax_deduction DECIMAL(12,2) DEFAULT 0,
  other_deductions DECIMAL(12,2) DEFAULT 0,
  net_salary DECIMAL(12,2) DEFAULT 0,
  working_days INT DEFAULT 26,
  present_days INT DEFAULT 0,
  absent_days INT DEFAULT 0,
  leave_days INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (payroll_id, employee_id)
);
