-- Add pickup and dropoff JSONB columns to rides for driver offer enrichment
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS pickup JSONB NULL,
ADD COLUMN IF NOT EXISTS dropoff JSONB NULL;
