-- Add user_id to rides table
ALTER TABLE rides ADD COLUMN IF NOT EXISTS user_id TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_rides_user ON rides(user_id);
