-- Add vehicle_type column to rides so retries can query appropriate drivers
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT NULL;
