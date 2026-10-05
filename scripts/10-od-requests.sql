-- OD (On Duty): employee working outside the factory (delivery, bank, site
-- visit, outstation). Separate from leave — an approved OD day is paid as a
-- present day and keeps the full-attendance incentive.

CREATE TABLE IF NOT EXISTS hr_od_requests (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES hr_employees(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INT NOT NULL DEFAULT 1,
  out_time TIME,
  in_time TIME,
  place TEXT,
  purpose TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_at TIMESTAMPTZ,
  rejection_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_od_emp ON hr_od_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_od_status ON hr_od_requests(status);
-- The app connects as mattress_app (owner of the other hr_* tables)
ALTER TABLE hr_od_requests OWNER TO mattress_app;

ALTER TABLE hr_attendance DROP CONSTRAINT IF EXISTS hr_attendance_status_check;
ALTER TABLE hr_attendance ADD CONSTRAINT hr_attendance_status_check
  CHECK (status IN ('present','absent','half_day','late','on_leave','on_duty'));
