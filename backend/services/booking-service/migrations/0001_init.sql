-- bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY,
  user_id UUID NULL,
  status TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL,

  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  pickup_address TEXT NULL,

  dropoff_lat DOUBLE PRECISION NOT NULL,
  dropoff_lng DOUBLE PRECISION NOT NULL,
  dropoff_address TEXT NULL,

  vehicle_type TEXT NOT NULL,

  distance_m INT NOT NULL,
  duration_s INT NOT NULL,
  fare INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',

  ride_id UUID NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_status_created
  ON bookings(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_user_created
  ON bookings(user_id, created_at DESC);

-- booking status history
CREATE TABLE IF NOT EXISTS booking_status_history (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL,
  from_status TEXT NULL,
  to_status TEXT NOT NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bsh_booking_created
  ON booking_status_history(booking_id, created_at DESC);

-- outbox events (MVP)
CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created
  ON outbox_events(status, created_at ASC);