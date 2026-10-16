-- Company holidays (Sundays are always off and don't need a row). Used by
-- the daily 11:00 WhatsApp attendance report: on a holiday it lists only
-- who came in instead of who is absent.
CREATE TABLE IF NOT EXISTS hr_holidays (
  date DATE PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE hr_holidays OWNER TO mattress_app;
