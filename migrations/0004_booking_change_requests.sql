CREATE TABLE IF NOT EXISTS booking_change_requests (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  requested_by INTEGER NOT NULL,
  requested_date TIMESTAMP,
  requested_start_time TEXT,
  requested_end_time TEXT,
  requested_venue_ids INTEGER[],
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_booking_change_requests_booking_id ON booking_change_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_change_requests_status ON booking_change_requests(status);
