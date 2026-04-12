-- Initialize all databases for taxi platform
-- This script runs when postgres container first starts

-- Create auth_db for auth-service
CREATE DATABASE auth_db;

-- Create booking_db for booking-service  
CREATE DATABASE booking_db;

-- Create ride_db for ride-service
CREATE DATABASE ride_db;

-- Create driver_db for driver-service (if needed)
-- CREATE DATABASE driver_db;

-- taxi_main already exists as POSTGRES_DB (for payment/legacy)

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE auth_db TO taxi;
GRANT ALL PRIVILEGES ON DATABASE booking_db TO taxi;
GRANT ALL PRIVILEGES ON DATABASE ride_db TO taxi;
-- GRANT ALL PRIVILEGES ON DATABASE driver_db TO taxi;
