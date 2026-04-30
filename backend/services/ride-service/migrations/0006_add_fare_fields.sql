-- Add pricing snapshot columns to rides for driver offer display
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS fare NUMERIC(12,2) NULL,
ADD COLUMN IF NOT EXISTS distance_m INTEGER NULL,
ADD COLUMN IF NOT EXISTS duration_s INTEGER NULL,
ADD COLUMN IF NOT EXISTS currency TEXT NULL DEFAULT 'VND';
