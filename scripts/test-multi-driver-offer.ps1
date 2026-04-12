# Test: Multi-driver Offer/Reject/Timeout Flow
# Test Case A: Reject flow - d1 rejects -> d2 receives offer
# Test Case B: Timeout flow - d1 timeout -> d2 receives offer

Write-Host "=== MULTI-DRIVER OFFER FLOW TEST ===" -ForegroundColor Cyan
Write-Host "Test Case A: Reject flow"
Write-Host "Test Case B: Timeout flow"
Write-Host ""

# Configuration
$DRIVER_URL = "http://localhost:8004"
$BOOKING_URL = "http://localhost:8003"
$PRICING_URL = "http://localhost:8006"
$RIDE_URL = "http://localhost:8005"
$NOTIFICATION_URL = "http://localhost:8007"

# Test coordinates
$d1Location = @{
    lat = 10.762622
    lng = 106.660172
}

$d2Location = @{
    lat = 10.763200
    lng = 106.661000
}

$bookingPickup = @{
    lat = 10.762622
    lng = 106.660172
}

$bookingDropoff = @{
    lat = 10.770000
    lng = 106.670000
}

# ==========================================
# STEP 1: Setup 2 Drivers
# ==========================================

Write-Host "`n=== STEP 1: Setup 2 Drivers ONLINE ===" -ForegroundColor Yellow

Write-Host "`nSetting up Driver d1..."
try {
    $d1Status = Invoke-RestMethod -Method Post -Uri "$DRIVER_URL/drivers/me/status" `
        -Headers @{"Content-Type"="application/json"; "x-driver-id"="d1"} `
        -Body (@{status="ONLINE"; vehicleType="CAR_4"} | ConvertTo-Json)
    Write-Host "  Status: $($d1Status.status), VehicleType: $($d1Status.vehicleType)" -ForegroundColor Green

    $d1Loc = Invoke-RestMethod -Method Post -Uri "$DRIVER_URL/drivers/me/location" `
        -Headers @{"Content-Type"="application/json"; "x-driver-id"="d1"} `
        -Body ($d1Location | ConvertTo-Json)
    Write-Host "  Location: $($d1Loc.stored.lat), $($d1Loc.stored.lng)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`nSetting up Driver d2..."
try {
    $d2Status = Invoke-RestMethod -Method Post -Uri "$DRIVER_URL/drivers/me/status" `
        -Headers @{"Content-Type"="application/json"; "x-driver-id"="d2"} `
        -Body (@{status="ONLINE"; vehicleType="CAR_4"} | ConvertTo-Json)
    Write-Host "  Status: $($d2Status.status), VehicleType: $($d2Status.vehicleType)" -ForegroundColor Green

    $d2Loc = Invoke-RestMethod -Method Post -Uri "$DRIVER_URL/drivers/me/location" `
        -Headers @{"Content-Type"="application/json"; "x-driver-id"="d2"} `
        -Body ($d2Location | ConvertTo-Json)
    Write-Host "  Location: $($d2Loc.stored.lat), $($d2Loc.stored.lng)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Verify nearby query
Write-Host "`nVerify nearby drivers..."
try {
    $nearby = Invoke-RestMethod -Uri "$DRIVER_URL/drivers/nearby?lat=$($bookingPickup.lat)&lng=$($bookingPickup.lng)&radiusM=3000&vehicleType=CAR_4&limit=10"
    Write-Host "  Found $($nearby.drivers.Count) drivers:" -ForegroundColor Green
    $nearby.drivers | ForEach-Object {
        Write-Host "    - $($_.driverId) at $($_.distanceM)m"
    }
    
    if ($nearby.drivers.Count -lt 2) {
        Write-Host "  ERROR: Need at least 2 drivers for multi-offer test!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`nOK - Both drivers ready" -ForegroundColor Green

# ==========================================
# STEP 2: Get Price Estimate
# ==========================================

Write-Host "`n=== STEP 2: Get Price Estimate ===" -ForegroundColor Yellow

try {
    $estimate = Invoke-RestMethod -Method Post -Uri "$PRICING_URL/pricing/estimate" `
        -Headers @{"Content-Type"="application/json"} `
        -Body (@{
            pickup = $bookingPickup
            dropoff = $bookingDropoff
            vehicleType = "CAR_4"
        } | ConvertTo-Json)
    
    Write-Host "  Estimated price: $($estimate.estimatedPrice)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ==========================================
# HELPER FUNCTIONS
# ==========================================

function Get-RideByBookingId($bookingId) {
    $query = "SELECT id, booking_id, status, driver_id, current_offer_driver_id, candidate_index FROM rides WHERE booking_id='$bookingId'"
    $result = docker exec -i taxi_postgres psql -U taxi -d ride_db -c "$query" -t
    return $result
}

function Get-RideOffers($rideId) {
    $query = "SELECT id, driver_id, status, responded_at FROM ride_offers WHERE ride_id='$rideId' ORDER BY created_at"
    $result = docker exec -i taxi_postgres psql -U taxi -d ride_db -c "$query"
    return $result
}

# ==========================================
# TEST CASE A: REJECT FLOW
# ==========================================

Write-Host "`n=== TEST CASE A: REJECT FLOW ===" -ForegroundColor Cyan
Write-Host "Scenario: d1 receives offer -> d1 rejects -> d2 receives offer -> d2 accepts"

Write-Host "`nCreating booking..."
try {
    $booking = Invoke-RestMethod -Method Post -Uri "$BOOKING_URL/bookings" `
        -Headers @{"Content-Type"="application/json"; "x-user-id"="u1"} `
        -Body (@{
            userId = "u1"
            pickup = $bookingPickup
            dropoff = $bookingDropoff
            vehicleType = "CAR_4"
            estimatedPrice = $estimate.estimatedPrice
        } | ConvertTo-Json)
    
    $bookingId = $booking.bookingId
    Write-Host "  Booking created: $bookingId" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Wait for matching
Write-Host "`nWaiting for driver matching (3s)..."
Start-Sleep -Seconds 3

# Check ride record
Write-Host "`nChecking ride record..."
$rideInfo = Get-RideByBookingId $bookingId
Write-Host $rideInfo

# Get ride ID from postgres output
$rideIdMatch = $rideInfo -match '([a-f0-9\-]{36})\s+\|\s+' + $bookingId
if ($rideIdMatch) {
    $rideId = $matches[1].Trim()
    Write-Host "  Ride ID: $rideId" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Could not find ride ID" -ForegroundColor Red
    exit 1
}

# Show initial offer
Write-Host "`nCurrent offers:"
Get-RideOffers $rideId

# Simulate d1 REJECT
Write-Host "`nSimulating Driver d1 REJECT..."
try {
    $reject = Invoke-RestMethod -Method Post -Uri "$RIDE_URL/rides/$rideId/driver/reject" `
        -Headers @{"Content-Type"="application/json"; "x-driver-id"="d1"}
    Write-Host "  d1 rejected successfully" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    # Continue to check state
}

# Wait for next offer
Write-Host "`nWaiting for offer to d2 (2s)..."
Start-Sleep -Seconds 2

# Check offers again
Write-Host "`nOffers after d1 reject:"
Get-RideOffers $rideId

# Simulate d2 ACCEPT
Write-Host "`nSimulating Driver d2 ACCEPT..."
try {
    $accept = Invoke-RestMethod -Method Post -Uri "$RIDE_URL/rides/$rideId/driver/accept" `
        -Headers @{"Content-Type"="application/json"; "x-driver-id"="d2"}
    Write-Host "  d2 accepted successfully" -ForegroundColor Green
    Write-Host "  Ride status: $($accept.status)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

# Final state
Write-Host "`nFinal ride state:"
Get-RideByBookingId $bookingId

Write-Host "`nFinal offers:"
Get-RideOffers $rideId

Write-Host "`n=== TEST CASE A: COMPLETED ===" -ForegroundColor Green
Write-Host "Expected: d1 REJECTED -> d2 ACCEPTED -> Ride DRIVER_ASSIGNED"

# ==========================================
# CLEANUP & PREPARE FOR TEST CASE B
# ==========================================

Write-Host "`n=== Cleanup for Test Case B ===" -ForegroundColor Yellow

# Reset drivers to ONLINE
Write-Host "Resetting drivers to ONLINE..."
Invoke-RestMethod -Method Post -Uri "$DRIVER_URL/drivers/me/status" `
    -Headers @{"Content-Type"="application/json"; "x-driver-id"="d1"} `
    -Body (@{status="ONLINE"; vehicleType="CAR_4"} | ConvertTo-Json) | Out-Null

Invoke-RestMethod -Method Post -Uri "$DRIVER_URL/drivers/me/status" `
    -Headers @{"Content-Type"="application/json"; "x-driver-id"="d2"} `
    -Body (@{status="ONLINE"; vehicleType="CAR_4"} | ConvertTo-Json) | Out-Null

# Update locations again (refresh heartbeat)
Invoke-RestMethod -Method Post -Uri "$DRIVER_URL/drivers/me/location" `
    -Headers @{"Content-Type"="application/json"; "x-driver-id"="d1"} `
    -Body ($d1Location | ConvertTo-Json) | Out-Null

Invoke-RestMethod -Method Post -Uri "$DRIVER_URL/drivers/me/location" `
    -Headers @{"Content-Type"="application/json"; "x-driver-id"="d2"} `
    -Body ($d2Location | ConvertTo-Json) | Out-Null

Write-Host "Drivers reset" -ForegroundColor Green

# ==========================================
# TEST CASE B: TIMEOUT FLOW
# ==========================================

Write-Host "`n=== TEST CASE B: TIMEOUT FLOW ===" -ForegroundColor Cyan
Write-Host "Scenario: d1 receives offer -> d1 timeout -> d2 receives offer -> d2 accepts"

# Get OFFER_TIMEOUT_SEC from environment (default 60, but dev might be 10)
$timeoutSec = 10
Write-Host "OFFER_TIMEOUT_SEC = $timeoutSec seconds (configured in ride-service)" -ForegroundColor Yellow

Write-Host "`nCreating second booking..."
try {
    $booking2 = Invoke-RestMethod -Method Post -Uri "$BOOKING_URL/bookings" `
        -Headers @{"Content-Type"="application/json"; "x-user-id"="u1"} `
        -Body (@{
            userId = "u1"
            pickup = $bookingPickup
            dropoff = $bookingDropoff
            vehicleType = "CAR_4"
            estimatedPrice = $estimate.estimatedPrice
        } | ConvertTo-Json)
    
    $bookingId2 = $booking2.bookingId
    Write-Host "  Booking created: $bookingId2" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Wait for matching
Write-Host "`nWaiting for driver matching (3s)..."
Start-Sleep -Seconds 3

# Check ride record
Write-Host "`nChecking ride record..."
$rideInfo2 = Get-RideByBookingId $bookingId2
Write-Host $rideInfo2

# Get ride ID
$rideIdMatch2 = $rideInfo2 -match '([a-f0-9\-]{36})\s+\|\s+' + $bookingId2
if ($rideIdMatch2) {
    $rideId2 = $matches[1].Trim()
    Write-Host "  Ride ID: $rideId2" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Could not find ride ID" -ForegroundColor Red
    exit 1
}

# Show initial offer
Write-Host "`nCurrent offers (d1 should be offered):"
Get-RideOffers $rideId2

# Wait for timeout
Write-Host "`nWaiting for timeout ($timeoutSec seconds)..." -ForegroundColor Yellow
Write-Host "Driver d1 will NOT respond (simulating timeout)"
Start-Sleep -Seconds ($timeoutSec + 3)

# Check offers after timeout
Write-Host "`nOffers after timeout:"
Get-RideOffers $rideId2

Write-Host "`nRide state after timeout:"
Get-RideByBookingId $bookingId2

# Simulate d2 ACCEPT
Write-Host "`nSimulating Driver d2 ACCEPT..."
try {
    $accept2 = Invoke-RestMethod -Method Post -Uri "$RIDE_URL/rides/$rideId2/driver/accept" `
        -Headers @{"Content-Type"="application/json"; "x-driver-id"="d2"}
    Write-Host "  d2 accepted successfully" -ForegroundColor Green
    Write-Host "  Ride status: $($accept2.status)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

# Final state
Write-Host "`nFinal ride state:"
Get-RideByBookingId $bookingId2

Write-Host "`nFinal offers:"
Get-RideOffers $rideId2

Write-Host "`n=== TEST CASE B: COMPLETED ===" -ForegroundColor Green
Write-Host "Expected: d1 TIMEOUT -> d2 OFFERED -> d2 ACCEPTED -> Ride DRIVER_ASSIGNED"

# ==========================================
# SUMMARY
# ==========================================

Write-Host "`n=== TEST SUMMARY ===" -ForegroundColor Cyan

Write-Host "`nTest Case A (Reject flow):"
Write-Host "  Booking ID: $bookingId"
Write-Host "  Ride ID: $rideId"
Write-Host "  Flow: d1 offered -> d1 rejected -> d2 offered -> d2 accepted"

Write-Host "`nTest Case B (Timeout flow):"
Write-Host "  Booking ID: $bookingId2"
Write-Host "  Ride ID: $rideId2"
Write-Host "  Flow: d1 offered -> timeout -> d2 offered -> d2 accepted"

Write-Host "`nTo verify SSE events, open these URLs in browser:"
Write-Host "  Driver d1 SSE: http://localhost:8007/notifications/stream?role=DRIVER&driverId=d1"
Write-Host "  Driver d2 SSE: http://localhost:8007/notifications/stream?role=DRIVER&driverId=d2"
Write-Host "  User u1 SSE: http://localhost:8007/notifications/stream?role=USER&userId=u1"

Write-Host "`nTo check Kafka events:"
Write-Host '  docker exec -it taxi_kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:9092 --topic taxi.events --from-beginning --max-messages 50' -NoNewline

Write-Host "`n"
