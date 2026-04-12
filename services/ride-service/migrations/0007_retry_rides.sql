-- Add retry metadata for rides when no drivers available
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ NULL;
