-- Change user_id from UUID to TEXT to support simple identifiers like 'u1'
ALTER TABLE bookings ALTER COLUMN user_id TYPE TEXT;
