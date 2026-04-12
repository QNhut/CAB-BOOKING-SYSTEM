# Quick test script to verify booking → driver match flow
# Run this step by step to debug matching issues

Write-Host "=== STEP 1: Setup Driver d1 ===" -ForegroundColor Cyan

# 1.1 Set driver status ONLINE with vehicleType
Write-Host "`n1.1 Setting driver d1 ONLINE with CAR_4..." -ForegroundColor Yellow
$statusResp = Invoke-RestMethod -Uri "http://localhost:8004/drivers/me/status" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"; "x-driver-id"="d1"} `
    -Body (@{status="ONLINE"; vehicleType="CAR_4"} | ConvertTo-Json)
Write-Host "Response:" -ForegroundColor Green
$statusResp | ConvertTo-Json -Depth 3

# 1.2 Update driver location
Write-Host "`n1.2 Updating driver d1 location..." -ForegroundColor Yellow
$locResp = Invoke-RestMethod -Uri "http://localhost:8004/drivers/me/location" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"; "x-driver-id"="d1"} `
    -Body (@{lat=10.762622; lng=106.660172} | ConvertTo-Json)
Write-Host "Response:" -ForegroundColor Green
$locResp | ConvertTo-Json -Depth 3

# 1.3 Verify driver in Redis
Write-Host "`n1.3 Checking Redis state..." -ForegroundColor Yellow
Write-Host "Driver state:" -ForegroundColor Green
docker exec -it taxi_redis redis-cli GET "driver:state:d1"
Write-Host "Driver vehicleType:" -ForegroundColor Green
docker exec -it taxi_redis redis-cli GET "driver:vehicle:d1"
Write-Host "Drivers in CAR_4 geo set:" -ForegroundColor Green
docker exec -it taxi_redis redis-cli ZRANGE "geo:drivers:CAR_4" 0 -1

Write-Host "`n=== STEP 2: Query Nearby Drivers ===" -ForegroundColor Cyan

# 2.1 Test nearby query
Write-Host "`n2.1 Querying nearby drivers (same as booking will use)..." -ForegroundColor Yellow
$nearbyResp = Invoke-RestMethod -Uri "http://localhost:8004/drivers/nearby?lat=10.762622&lng=106.660172&radiusM=3000&vehicleType=CAR_4&limit=10"
Write-Host "Nearby drivers:" -ForegroundColor Green
$nearbyResp | ConvertTo-Json -Depth 5

if ($nearbyResp.drivers.Count -eq 0) {
    Write-Host "`n❌ ERROR: No drivers found nearby!" -ForegroundColor Red
    Write-Host "Possible causes:" -ForegroundColor Yellow
    Write-Host "  - Driver not in geo set (check step 1.3)" -ForegroundColor Yellow
    Write-Host "  - VehicleType mismatch (driver has different type)" -ForegroundColor Yellow
    Write-Host "  - Distance too far (check coordinates)" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "`n✅ SUCCESS: Found $($nearbyResp.drivers.Count) driver(s)" -ForegroundColor Green
}

Write-Host "`n=== STEP 3: Get Pricing Estimate ===" -ForegroundColor Cyan

# 3.1 Get pricing
Write-Host "`n3.1 Getting price estimate..." -ForegroundColor Yellow
$pricingResp = Invoke-RestMethod -Uri "http://localhost:8002/pricing/estimate" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body (@{
        pickup=@{lat=10.762622; lng=106.660172}
        dropoff=@{lat=10.771928; lng=106.698229}
        vehicleType="CAR_4"
    } | ConvertTo-Json)
Write-Host "Pricing:" -ForegroundColor Green
$pricingResp | ConvertTo-Json -Depth 3

Write-Host "`n=== STEP 4: Create Booking ===" -ForegroundColor Cyan

# 4.1 Create booking
Write-Host "`n4.1 Creating booking with userId=u1..." -ForegroundColor Yellow
$bookingResp = Invoke-RestMethod -Uri "http://localhost:8003/bookings" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body (@{
        userId="u1"
        pickup=@{lat=10.762622; lng=106.660172; address="Test Pickup"}
        dropoff=@{lat=10.771928; lng=106.698229; address="Test Dropoff"}
        vehicleType="CAR_4"
        paymentMethod="CASH"
        pricingSnapshot=$pricingResp
    } | ConvertTo-Json -Depth 5)

Write-Host "Booking created:" -ForegroundColor Green
$bookingResp | ConvertTo-Json -Depth 3
$bookingId = $bookingResp.bookingId

Write-Host "`n=== STEP 5: Check Events & Ride ===" -ForegroundColor Cyan

# Wait for processing
Write-Host "`n5.1 Waiting 3 seconds for event processing..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 5.2 Check outbox events
Write-Host "`n5.2 Checking booking outbox events..." -ForegroundColor Yellow
$outboxResp = Invoke-RestMethod -Uri "http://localhost:8003/outbox"
Write-Host "Recent outbox events:" -ForegroundColor Green
$outboxResp.items | Select-Object -First 5 | ForEach-Object {
    Write-Host "  - $($_.event_type) | Status: $($_.status) | Created: $($_.created_at)" -ForegroundColor Gray
}

# 5.3 Check if ride was created in ride-service
Write-Host "`n5.3 Checking ride in database..." -ForegroundColor Yellow
$rideCheck = docker exec -it taxi_postgres psql -U taxi -d ride_db -c "SELECT id, booking_id, driver_id, status, candidate_index FROM rides WHERE booking_id='$bookingId';" -t
Write-Host "Ride record:" -ForegroundColor Green
Write-Host $rideCheck

# 5.4 Check processed events
Write-Host "`n5.4 Checking processed events..." -ForegroundColor Yellow
$processedCheck = docker exec -it taxi_postgres psql -U taxi -d ride_db -c "SELECT event_id, event_type, created_at FROM processed_events ORDER BY created_at DESC LIMIT 5;" -t
Write-Host "Processed events:" -ForegroundColor Green
Write-Host $processedCheck

Write-Host "`n=== STEP 6: Check Notification Service ===" -ForegroundColor Cyan

# 6.1 Check notification service logs
Write-Host "`n6.1 Checking notification-service logs (last 20 lines)..." -ForegroundColor Yellow
docker logs taxi_notification_dev --tail 20

Write-Host "`n=== STEP 7: Check Ride Service ===" -ForegroundColor Cyan

# 7.1 Check ride service logs
Write-Host "`n7.1 Checking ride-service logs (last 30 lines)..." -ForegroundColor Yellow
docker logs taxi_ride_dev --tail 30

Write-Host "`n=== STEP 8: Final Verification ===" -ForegroundColor Cyan

# 8.1 Get booking status
Write-Host "`n8.1 Getting booking status..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
$bookingStatus = Invoke-RestMethod -Uri "http://localhost:8003/bookings/$bookingId"
Write-Host "Booking status:" -ForegroundColor Green
$bookingStatus | ConvertTo-Json -Depth 3

# 8.2 Summary
Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Booking ID: $bookingId" -ForegroundColor White
Write-Host "Booking Status: $($bookingStatus.status)" -ForegroundColor White
Write-Host "Driver State: $($locResp.state)" -ForegroundColor White
Write-Host "Nearby Drivers Found: $($nearbyResp.drivers.Count)" -ForegroundColor White

if ($bookingStatus.ride_id) {
    Write-Host "`n✅ SUCCESS: Ride was created!" -ForegroundColor Green
    Write-Host "Ride ID: $($bookingStatus.ride_id)" -ForegroundColor Green
} else {
    Write-Host "`n⚠️ WARNING: No ride created yet" -ForegroundColor Yellow
    Write-Host "Check logs above for errors in ride-service" -ForegroundColor Yellow
}

Write-Host "`n=== DEBUGGING TIPS ===" -ForegroundColor Cyan
Write-Host "1. Check Kafka events: docker exec -it taxi_kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:9092 --topic taxi.events --from-beginning --max-messages 10" -ForegroundColor Gray
Write-Host "2. Restart ride-service: docker compose -f docker-compose.dev.yml restart ride-service" -ForegroundColor Gray
Write-Host "3. Clear Redis: docker exec -it taxi_redis redis-cli FLUSHALL" -ForegroundColor Gray
Write-Host "4. Check ride DB: docker exec -it taxi_postgres psql -U taxi -d ride_db" -ForegroundColor Gray
