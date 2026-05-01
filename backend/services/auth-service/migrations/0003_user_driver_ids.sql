-- Store custom userId/driverId so login & refresh can embed them in JWT
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS driver_id TEXT;
