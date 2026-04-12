# Quick Test: Just Reject Flow
# Lightweight version - only tests d1 reject -> d2 accept

Write-Host "=== QUICK TEST: REJECT FLOW ===" -ForegroundColor Cyan

# Setup
$DRIVER_URL = "http://localhost:8004"
$BOOKING_URL = "http://localhost:8003"
$PRICING_URL = "http://localhost:8006"
$RIDE_URL = "http://localhost:8005"

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
    -Body (@{userId="u1"; pickup=@{lat=10.762622;lng=106.660172}; dropoff=@{lat=10.770000;lng=106.670000}; vehicleType="CAR_4"; estimatedPrice=$estimate.estimatedPrice} | ConvertTo-Json)
$bookingId = $booking.bookingId
Write-Host "Booking: $bookingId" -ForegroundColor Green

# Wait
Start-Sleep -Seconds 3

# Get ride ID
$rideInfo = docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT id FROM rides WHERE booking_id='$bookingId'" -t
$rideId = $rideInfo.Trim()
Write-Host "Ride: $rideId" -ForegroundColor Green

# d1 rejects
Write-Host "`nd1 REJECT..." -ForegroundColor Yellow
Invoke-RestMethod -Method Post -Uri "$RIDE_URL/rides/$rideId/driver/reject" `
    -Headers @{"Content-Type"="application/json"; "x-driver-id"="d1"} | Out-Null

Start-Sleep -Seconds 2

# d2 accepts
Write-Host "d2 ACCEPT..." -ForegroundColor Yellow
$result = Invoke-RestMethod -Method Post -Uri "$RIDE_URL/rides/$rideId/driver/accept" `
    -Headers @{"Content-Type"="application/json"; "x-driver-id"="d2"}

# Check result
Write-Host "`nResult:" -ForegroundColor Cyan
Write-Host "  Status: $($result.status)" -ForegroundColor $(if ($result.status -eq "DRIVER_ASSIGNED") {"Green"} else {"Red"})

# Verify
$offers = docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT driver_id, status FROM ride_offers WHERE ride_id='$rideId' ORDER BY created_at"
Write-Host "`nOffers:" -ForegroundColor Cyan
Write-Host $offers

if ($result.status -eq "DRIVER_ASSIGNED") {
    Write-Host "`nOK - Test PASSED" -ForegroundColor Green
} else {
    Write-Host "`nERROR - Test FAILED" -ForegroundColor Red
}
