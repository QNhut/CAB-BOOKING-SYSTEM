-- User profiles (name + phone for USER accounts)
CREATE TABLE IF NOT EXISTS user_profiles (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  full_name  TEXT NULL,
  phone      TEXT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Driver profiles (name, phone + vehicle info for DRIVER accounts)
CREATE TABLE IF NOT EXISTS driver_profiles (
  account_id     UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  full_name      TEXT NULL,
  phone          TEXT NULL,
  vehicle_type   TEXT NULL CHECK (vehicle_type IN ('CAR_4', 'CAR_7', NULL)),
  license_plate  TEXT NULL,
  driver_license TEXT NULL,
  updated_at     TIMESTAMPTZ DEFAULT now()
);
