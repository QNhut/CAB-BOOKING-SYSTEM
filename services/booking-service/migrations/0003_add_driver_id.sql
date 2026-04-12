-- Add driver_id column to bookings table (for history enrichment)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_id TEXT NULL;
