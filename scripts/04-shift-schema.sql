-- Shift definitions
CREATE TABLE IF NOT EXISTS hr_shifts (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  start_time    TIME        NOT NULL,
  end_time      TIME        NOT NULL,
  break_minutes INTEGER     NOT NULL DEFAULT 0,
  grace_minutes INTEGER     NOT NULL DEFAULT 10,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_name ON hr_shifts(LOWER(name));
CREATE INDEX  IF NOT EXISTS idx_shifts_active ON hr_shifts(is_active);

-- Shift allocations (which shift each employee is on)
CREATE TABLE IF NOT EXISTS hr_shift_allocations (
  id             SERIAL  PRIMARY KEY,
  employee_id    INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  shift_id       INTEGER NOT NULL REFERENCES hr_shifts(id),
  effective_from DATE    NOT NULL DEFAULT CURRENT_DATE,
  effective_to   DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_emp_shift_date UNIQUE (employee_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_shift_alloc_emp   ON hr_shift_allocations(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_alloc_shift ON hr_shift_allocations(shift_id);

-- Default shift: 9:00 – 17:30, 30 min lunch, 10 min grace
INSERT INTO hr_shifts (name, start_time, end_time, break_minutes, grace_minutes)
VALUES ('General Shift', '09:00:00', '17:30:00', 30, 10)
ON CONFLICT DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER set_hr_shifts_updated_at
  BEFORE UPDATE ON hr_shifts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
