# Debug: Why driver.html setup does not match bookings

Write-Host "=== DEBUG: Driver Matching Issue ===" -ForegroundColor Cyan

Write-Host "`n[1] Check driver d1 in Redis..." -ForegroundColor Yellow

Write-Host "`nState:" -ForegroundColor Green
$state = docker exec -it taxi_redis redis-cli GET "driver:state:d1"
Write-Host "  $state"

Write-Host "`nVehicleType:" -ForegroundColor Green
$vtype = docker exec -it taxi_redis redis-cli GET "driver:vehicle:d1"
Write-Host "  $vtype"

Write-Host "`nHeartbeat:" -ForegroundColor Green
$hb = docker exec -it taxi_redis redis-cli GET "driver:hb:d1"
if ($hb) {
    Write-Host "  OK - exists" -ForegroundColor Green
} else {
    Write-Host "  ERROR - missing or expired!" -ForegroundColor Red
}

Write-Host "`n[2] Check GEO sets..." -ForegroundColor Yellow

Write-Host "`ngeo:drivers:CAR_4:" -ForegroundColor Green
$geo4 = docker exec -it taxi_redis redis-cli ZRANGE "geo:drivers:CAR_4" 0 -1
Write-Host "  $geo4"

Write-Host "`ngeo:drivers:CAR_7:" -ForegroundColor Green
$geo7 = docker exec -it taxi_redis redis-cli ZRANGE "geo:drivers:CAR_7" 0 -1
Write-Host "  $geo7"

Write-Host "`nWRONG sets (should be empty):" -ForegroundColor Green
Write-Host "  SEDAN: $(docker exec -it taxi_redis redis-cli ZRANGE 'geo:drivers:SEDAN' 0 -1)"
Write-Host "  SUV: $(docker exec -it taxi_redis redis-cli ZRANGE 'geo:drivers:SUV' 0 -1)"

Write-Host "`n[3] Test nearby query..." -ForegroundColor Yellow
try {
    $nearby = Invoke-RestMethod -Uri "http://localhost:8004/drivers/nearby?lat=10.762622&lng=106.660172&radiusM=3000&vehicleType=CAR_4&limit=10"
    Write-Host "Found $($nearby.drivers.Count) drivers:" -ForegroundColor Green
    $nearby.drivers | ForEach-Object {
        Write-Host "  - $($_.driverId) at $($_.distanceM)m"
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== ANALYSIS ===" -ForegroundColor Cyan

$issues = @()

if ($state -ne '"ONLINE"') {
    $issues += "State is not ONLINE (current: $state)"
}

if ($vtype -ne '"CAR_4"' -and $vtype -ne '"CAR_7"') {
    $issues += "VehicleType is wrong (current: $vtype, expected: CAR_4 or CAR_7)"
}

if (-not $hb) {
    $issues += "Heartbeat expired - driver considered offline"
}

if ($geo4 -notcontains "d1" -and $geo7 -notcontains "d1") {
    $issues += "Driver d1 NOT in any GEO set"
}

if ($issues.Count -eq 0) {
    Write-Host "`nOK - No issues detected!" -ForegroundColor Green
    Write-Host "Driver should match. Try creating booking from testbooking.html" -ForegroundColor Green
} else {
    Write-Host "`nFOUND $($issues.Count) ISSUES:" -ForegroundColor Red
    $issues | ForEach-Object {
        Write-Host "  - $_" -ForegroundColor Yellow
    }
}

Write-Host "`n=== SOLUTION ===" -ForegroundColor Cyan

Write-Host "`nCorrect steps to setup driver from driver.html:"
Write-Host "  1. Driver ID: d1"
Write-Host "  2. Vehicle Type: select CAR_4"
Write-Host "  3. Click 'Ap dung' button"
Write-Host "  4. Enter lat: 10.762622, lng: 106.660172"
Write-Host "  5. Click 'Cap nhat vi tri' button"
Write-Host "  6. Click 'Ket noi SSE' button"

Write-Host "`nOR use automated script:"
Write-Host "  powershell -File .\scripts\test-booking-flow.ps1"

Write-Host "`n"
