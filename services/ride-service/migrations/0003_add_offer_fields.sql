-- Add fields for sequential offer logic
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS candidates JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS candidate_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_offer_driver_id TEXT NULL,
ADD COLUMN IF NOT EXISTS offer_expires_at TIMESTAMPTZ NULL;

-- Index for timeout query
CREATE INDEX IF NOT EXISTS idx_rides_offering_expires 
ON rides(status, offer_expires_at) 
WHERE status = 'OFFERING' AND offer_expires_at IS NOT NULL;
