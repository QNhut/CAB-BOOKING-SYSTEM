# Quick Test: Just Timeout Flow
# Lightweight version - only tests d1 timeout -> d2 accept

Write-Host "=== QUICK TEST: TIMEOUT FLOW ===" -ForegroundColor Cyan

# Setup
$DRIVER_URL = "http://localhost:8004"
$BOOKING_URL = "http://localhost:8003"
$PRICING_URL = "http://localhost:8006"
$RIDE_URL = "http://localhost:8005"
$TIMEOUT_SEC = 10

Write-Host "OFFER_TIMEOUT_SEC = $TIMEOUT_SEC (make sure ride-service uses this)" -ForegroundColor Yellow

# Setup d1
Write-Host "`nSetup d1..." -ForegroundColor Yellow
Invoke-RestMethod -Method Post -Uri "$DRIVER_URL/drivers/me/status" `
    -Headers @{"Content-Type"="application/json"; "x-driver-id"="d1"} `
    -Body (@{status="ONLINE"; vehicleType="CAR_4"} | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$DRIVER_URL/drivers/me/location" `
    -Headers @{"Content-Type"="application/json"; "x-driver-id"="d1"} `
    -Body (@{lat=10.762622; lng=106.660172} | ConvertTo-Json) | Out-Null

# Setup d2
Write-Host "Setup d2..." -ForegroundColor Yellow
Invoke-RestMethod -Method Post -Uri "$DRIVER_URL/drivers/me/status" `
    -Headers @{"Content-Type"="application/json"; "x-driver-id"="d2"} `
    -Body (@{status="ONLINE"; vehicleType="CAR_4"} | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$DRIVER_URL/drivers/me/location" `
    -Headers @{"Content-Type"="application/json"; "x-driver-id"="d2"} `
    -Body (@{lat=10.763200; lng=106.661000} | ConvertTo-Json) | Out-Null

# Get price
Write-Host "Get estimate..." -ForegroundColor Yellow
$estimate = Invoke-RestMethod -Method Post -Uri "$PRICING_URL/pricing/estimate" `
    -Headers @{"Content-Type"="application/json"} `
    -Body (@{pickup=@{lat=10.762622;lng=106.660172}; dropoff=@{lat=10.770000;lng=106.670000}; vehicleType="CAR_4"} | ConvertTo-Json)

# Create booking
Write-Host "Create booking..." -ForegroundColor Yellow
$booking = Invoke-RestMethod -Method Post -Uri "$BOOKING_URL/bookings" `
    -Headers @{"Content-Type"="application/json"; "x-user-id"="u1"} `
    -Body (@{userId="u1"; pickup=@{lat=10.762622;lng=106.660172}; dropoff=@{lat=10.770000;lng=106.660000}; vehicleType="CAR_4"; estimatedPrice=$estimate.estimatedPrice} | ConvertTo-Json)
$bookingId = $booking.bookingId
Write-Host "Booking: $bookingId" -ForegroundColor Green

# Wait for matching
Start-Sleep -Seconds 3

# Get ride ID
$rideInfo = docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT id FROM rides WHERE booking_id='$bookingId'" -t
$rideId = $rideInfo.Trim()
Write-Host "Ride: $rideId" -ForegroundColor Green

Write-Host "`nOffers before timeout:" -ForegroundColor Cyan
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT driver_id, status FROM ride_offers WHERE ride_id='$rideId' ORDER BY created_at"

# Wait for timeout
Write-Host "`nWaiting for TIMEOUT ($TIMEOUT_SEC seconds)..." -ForegroundColor Yellow
Write-Host "d1 will NOT respond (simulating timeout)" -ForegroundColor Yellow
Start-Sleep -Seconds ($TIMEOUT_SEC + 3)

Write-Host "`nOffers after timeout:" -ForegroundColor Cyan
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT driver_id, status FROM ride_offers WHERE ride_id='$rideId' ORDER BY created_at"

# d2 accepts
Write-Host "`nd2 ACCEPT..." -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod -Method Post -Uri "$RIDE_URL/rides/$rideId/driver/accept" `
        -Headers @{"Content-Type"="application/json"; "x-driver-id"="d2"}
    
    # Check result
    Write-Host "`nResult:" -ForegroundColor Cyan
    Write-Host "  Status: $($result.status)" -ForegroundColor $(if ($result.status -eq "DRIVER_ASSIGNED") {"Green"} else {"Red"})
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

# Verify final state
Write-Host "`nFinal offers:" -ForegroundColor Cyan
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT driver_id, status FROM ride_offers WHERE ride_id='$rideId' ORDER BY created_at"

Write-Host "`nRide state:" -ForegroundColor Cyan
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT status, driver_id FROM rides WHERE id='$rideId'"

# Check for timeout in logs
Write-Host "`nLogs (last 10 lines):" -ForegroundColor Cyan
docker logs taxi_ride_dev --tail 10 | Select-String -Pattern "TIMEOUT|Offered"

if ($result.status -eq "DRIVER_ASSIGNED") {
    Write-Host "`nOK - Test PASSED" -ForegroundColor Green
    Write-Host "Expected: d1=TIMEOUT, d2=ACCEPTED" -ForegroundColor Green
} else {
    Write-Host "`nERROR - Test FAILED" -ForegroundColor Red
}
