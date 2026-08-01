-- Britex payroll v2: Basic/DA/HRA/Other split, auto ESI/PF, auto-detected
-- permission from raw punches, per-day permission tracking, Others deduction.

-- Every individual punch, so permission gaps (in-between punches) can be
-- detected instead of only keeping first/last of the day.
CREATE TABLE IF NOT EXISTS hr_punches (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES hr_employees(id),
  date DATE NOT NULL,
  punch_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_punches_emp_date ON hr_punches(employee_id, date);

ALTER TABLE hr_attendance
  ADD COLUMN IF NOT EXISTS permission_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;

ALTER TABLE hr_payroll_items
  ADD COLUMN IF NOT EXISTS basic NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS da NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hra NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowance NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pf NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS others_deduction NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permission_auto_hours NUMERIC(6,2) DEFAULT 0;

ALTER TABLE hr_payroll_inputs
  ADD COLUMN IF NOT EXISTS others_deduction NUMERIC(12,2) DEFAULT 0;
