-- Britex payroll engine: day-rate salary breakdown + monthly manual inputs
-- Salary = day_rate*(present + 0.5*half) + day_rate*sundays + incentive(5% if full attendance)
--          - ESI - advance - permission_hours*(day_rate/8)

ALTER TABLE hr_payroll_items
  ADD COLUMN IF NOT EXISTS day_rate NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS half_days NUMERIC(4,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sunday_days NUMERIC(4,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS working_salary NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sunday_salary NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentive NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS esi NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permission_hours NUMERIC(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permission_amount NUMERIC(12,2) DEFAULT 0;

-- Manual monthly inputs entered by office (survive re-generation)
CREATE TABLE IF NOT EXISTS hr_payroll_inputs (
  id SERIAL PRIMARY KEY,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  employee_id INT NOT NULL REFERENCES hr_employees(id),
  advance NUMERIC(12,2) DEFAULT 0,
  permission_hours NUMERIC(6,2) DEFAULT 0,
  esi NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (month, year, employee_id)
);
