# TEST CHEAT SHEET

## Quick Commands

### Run Tests
```powershell
# All tests
.\test\run-all-tests.ps1

# Quick only
.\test\quick-test-reject.ps1
.\test\quick-test-timeout.ps1

# Full suite
.\test\test-multi-driver-offer.ps1
```

### Verify System
```powershell
# Check all services
.\test\verify-test-readiness.ps1

# Check specific service
docker ps | Select-String "taxi_ride"
docker logs taxi_ride_dev --tail 20
```

### Setup Drivers Manually
```powershell
# Driver 1
curl -X POST http://localhost:8004/drivers/me/status `
  -H "Content-Type: application/json" -H "x-driver-id: d1" `
  -d '{"status":"ONLINE","vehicleType":"CAR_4"}'

curl -X POST http://localhost:8004/drivers/me/location `
  -H "Content-Type: application/json" -H "x-driver-id: d1" `
  -d '{"lat":10.762622,"lng":106.660172,"accuracyM":10}'

# Driver 2
curl -X POST http://localhost:8004/drivers/me/status `
  -H "Content-Type: application/json" -H "x-driver-id: d2" `
  -d '{"status":"ONLINE","vehicleType":"CAR_4"}'

curl -X POST http://localhost:8004/drivers/me/location `
  -H "Content-Type: application/json" -H "x-driver-id: d2" `
  -d '{"lat":10.763200,"lng":106.661000,"accuracyM":10}'
```

### Query Drivers
```powershell
# Nearby drivers
Invoke-RestMethod -Uri "http://localhost:8004/drivers/nearby?lat=10.762622&lng=106.660172&radiusM=3000&vehicleType=CAR_4&limit=10" | ConvertTo-Json
```

### Check Database
```powershell
# Latest rides
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT id, booking_id, status, driver_id, current_offer_driver_id FROM rides ORDER BY created_at DESC LIMIT 5"

# Latest offers
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT ride_id, driver_id, status, created_at FROM ride_offers ORDER BY created_at DESC LIMIT 10"

# Specific ride
$rideId = "..."
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT * FROM rides WHERE id='$rideId'"
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT * FROM ride_offers WHERE ride_id='$rideId' ORDER BY created_at"
```

### Check Redis
```powershell
# Driver state
docker exec -it taxi_redis redis-cli GET "driver:state:d1"
docker exec -it taxi_redis redis-cli GET "driver:state:d2"

# Vehicle type
docker exec -it taxi_redis redis-cli GET "driver:vehicle:d1"
docker exec -it taxi_redis redis-cli GET "driver:vehicle:d2"

# Heartbeat
docker exec -it taxi_redis redis-cli GET "driver:hb:d1"
docker exec -it taxi_redis redis-cli GET "driver:hb:d2"

# Lock
docker exec -it taxi_redis redis-cli GET "lock:driver:d1"
docker exec -it taxi_redis redis-cli GET "lock:driver:d2"

# GEO sets
docker exec -it taxi_redis redis-cli ZRANGE "geo:drivers:CAR_4" 0 -1
docker exec -it taxi_redis redis-cli GEOPOS "geo:drivers:CAR_4" "d1"

# Clear all (DANGER!)
docker exec -it taxi_redis redis-cli FLUSHALL
```

### Check Kafka
```bash
# Latest events
docker exec -it taxi_kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:9092 \
  --topic taxi.events \
  --from-beginning \
  --max-messages 50

# Tail events
docker exec -it taxi_kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:9092 \
  --topic taxi.events \
  --from-beginning
```

### Service Logs
```powershell
# Ride service
docker logs taxi_ride_dev --tail 30
docker logs -f taxi_ride_dev  # Follow

# Driver service
docker logs taxi_driver_dev --tail 30

# Booking service
docker logs taxi_booking_dev --tail 30

# Notification service
docker logs taxi_notification_dev --tail 30
```

### SSE Streams
```
# Driver d1
http://localhost:8007/notifications/stream?role=DRIVER&driverId=d1

# Driver d2
http://localhost:8007/notifications/stream?role=DRIVER&driverId=d2

# User u1
http://localhost:8007/notifications/stream?role=USER&userId=u1
```

### Manual Ride Actions
```powershell
$rideId = "..."

# Accept (as d1)
curl -X POST "http://localhost:8005/rides/$rideId/driver/accept" `
  -H "Content-Type: application/json" -H "x-driver-id: d1"

# Reject (as d1)
curl -X POST "http://localhost:8005/rides/$rideId/driver/reject" `
  -H "Content-Type: application/json" -H "x-driver-id: d1"

# Complete (as d1)
curl -X POST "http://localhost:8005/rides/$rideId/complete" `
  -H "Content-Type: application/json" -H "x-driver-id: d1"
```

### Reset Driver State
```powershell
# Set ONLINE
curl -X POST http://localhost:8004/drivers/me/status `
  -H "Content-Type: application/json" -H "x-driver-id: d1" `
  -d '{"status":"ONLINE","vehicleType":"CAR_4"}'

# Update location (refresh heartbeat)
curl -X POST http://localhost:8004/drivers/me/location `
  -H "Content-Type: application/json" -H "x-driver-id: d1" `
  -d '{"lat":10.762622,"lng":106.660172,"accuracyM":10}'
```

### Force Offer Timeout (Debug)
```sql
# Make offer expire immediately
docker exec -i taxi_postgres psql -U taxi -d ride_db -c \
  "UPDATE rides SET offer_expires_at = now() - interval '1 second' WHERE id='$rideId'"
```

### Clear Test Data
```powershell
# Clear rides
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "TRUNCATE rides, ride_offers CASCADE"

# Clear bookings
docker exec -i taxi_postgres psql -U taxi -d booking_db -c "TRUNCATE bookings CASCADE"

# Clear Redis
docker exec -it taxi_redis redis-cli FLUSHALL
```

### Restart Services
```powershell
# Just ride service
docker restart taxi_ride_dev

# All services
docker compose -f docker-compose.dev.yml restart

# Stop and rebuild
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up -d --build
```

## Common Issues

### Issue: Driver not matching
```powershell
# Debug steps
docker exec -it taxi_redis redis-cli GET "driver:state:d1"  # Should be "ONLINE"
docker exec -it taxi_redis redis-cli GET "driver:vehicle:d1"  # Should be "CAR_4"
docker exec -it taxi_redis redis-cli GET "driver:hb:d1"  # Should exist
docker exec -it taxi_redis redis-cli ZRANGE "geo:drivers:CAR_4" 0 -1  # Should contain d1
```

### Issue: Offer not transferring
```powershell
# Check lock
docker exec -it taxi_redis redis-cli GET "lock:driver:d1"  # Should be removed after reject/timeout

# Check ride state
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT current_offer_driver_id, candidate_index, status FROM rides WHERE id='$rideId'"

# Check logs
docker logs taxi_ride_dev --tail 50 | Select-String "Offered|TIMEOUT|REJECT"
```

### Issue: Timeout not working
```powershell
# Check timeout config
docker exec -it taxi_ride_dev sh -c 'echo $OFFER_TIMEOUT_SEC'

# Check timeout loop logs
docker logs taxi_ride_dev | Select-String "timeout loop"

# Manual trigger
docker exec -i taxi_postgres psql -U taxi -d ride_db -c \
  "UPDATE rides SET offer_expires_at = now() - interval '1 second' WHERE status='OFFERING'"
```

## Test Scenarios

### Scenario 1: Reject Flow
1. Setup d1, d2 ONLINE
2. Create booking
3. d1 receives offer
4. d1 rejects
5. d2 receives offer (< 2s)
6. d2 accepts
7. Verify: d1=REJECTED, d2=ACCEPTED, ride status=DRIVER_ASSIGNED

### Scenario 2: Timeout Flow
1. Setup d1, d2 ONLINE
2. Create booking
3. d1 receives offer
4. Wait OFFER_TIMEOUT_SEC (no action)
5. d2 receives offer automatically
6. d2 accepts
7. Verify: d1=TIMEOUT, d2=ACCEPTED, ride status=DRIVER_ASSIGNED

### Scenario 3: No Drivers Available
1. No drivers ONLINE
2. Create booking
3. Verify: ride status=NO_DRIVER_FOUND

### Scenario 4: All Drivers Reject/Timeout
1. Setup d1, d2 ONLINE
2. Create booking
3. d1 rejects
4. d2 rejects
5. Verify: ride status=NO_DRIVER_FOUND

## Performance Metrics

- Offer transfer time (reject): < 2 seconds
- Offer transfer time (timeout): OFFER_TIMEOUT_SEC + 3 seconds
- Nearby query: < 500ms
- Booking creation: < 1 second
- Accept/Reject API: < 200ms
