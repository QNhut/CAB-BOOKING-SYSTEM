-- Add idempotency_key column for deduplication of booking creation
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency_key ON bookings(idempotency_key) WHERE idempotency_key IS NOT NULL;
