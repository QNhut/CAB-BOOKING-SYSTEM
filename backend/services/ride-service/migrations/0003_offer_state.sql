ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS current_offer_driver_id UUID NULL;

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS offer_expires_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_rides_offer_exp ON rides(offer_expires_at);