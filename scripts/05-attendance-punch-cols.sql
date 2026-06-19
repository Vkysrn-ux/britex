-- Add 4-punch tracking and lunch-late columns to hr_attendance
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS lunch_out      TIME;
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS lunch_in       TIME;
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS punch_count    SMALLINT  NOT NULL DEFAULT 0;
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS is_late_lunch  BOOLEAN   NOT NULL DEFAULT FALSE;
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS late_lunch_mins INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS late_morning_mins INTEGER NOT NULL DEFAULT 0;

-- Backfill punch_count from existing records (check_in=1 punch, check_out=2nd punch)
UPDATE hr_attendance SET punch_count = CASE
  WHEN check_in IS NOT NULL AND check_out IS NOT NULL THEN 2
  WHEN check_in IS NOT NULL THEN 1
  ELSE 0
END WHERE punch_count = 0;
