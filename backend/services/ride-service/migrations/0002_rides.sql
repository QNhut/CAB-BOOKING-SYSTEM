CREATE TABLE IF NOT EXISTS rides (
  id UUID PRIMARY KEY,
  booking_id UUID UNIQUE NOT NULL,
  driver_id TEXT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rides_status_created ON rides(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_driver_status ON rides(driver_id, status);

CREATE TABLE IF NOT EXISTS ride_offers (
  id UUID PRIMARY KEY,
  ride_id UUID NOT NULL,
  driver_id TEXT NOT NULL,
  status TEXT NOT NULL, -- OFFERED|ACCEPTED|REJECTED|TIMEOUT
  offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ NULL
);

-- 1 ride chỉ có 1 accepted offer
CREATE UNIQUE INDEX IF NOT EXISTS uq_offer_accept_per_ride
ON ride_offers(ride_id)
WHERE status = 'ACCEPTED';

CREATE INDEX IF NOT EXISTS idx_offers_ride_status ON ride_offers(ride_id, status);