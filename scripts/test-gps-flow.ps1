# Test GPS Location Update Flow
Write-Host "=== Test GPS Location Update Flow ===" -ForegroundColor Cyan

# Step 1: Login
Write-Host "`n[1/4] Login as driver..." -ForegroundColor Yellow
$loginBody = @{
    identifier = "driver@test.com"
    password = "pass123"
} | ConvertTo-Json

try {
    $loginResp = Invoke-RestMethod -Uri "http://localhost:8001/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    Write-Host "  ✅ Login successful" -ForegroundColor Green
    $token = $loginResp.accessToken
    
    # Decode token
    $tokenParts = $token.Split('.')
    $payload = $tokenParts[1]
    while ($payload.Length % 4 -ne 0) { $payload += "=" }
    $decodedBytes = [System.Convert]::FromBase64String($payload)
    $decodedText = [System.Text.Encoding]::UTF8.GetString($decodedBytes)
    $tokenData = $decodedText | ConvertFrom-Json
    
    Write-Host "  Driver ID: $($tokenData.driverId)" -ForegroundColor Cyan
    Write-Host "  Role: $($tokenData.role)" -ForegroundColor Cyan
} catch {
    Write-Host "  ❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Set status to ONLINE
Write-Host "`n[2/4] Set driver status to ONLINE..." -ForegroundColor Yellow
$statusBody = @{
    status = "ONLINE"
    vehicleType = "CAR_4"
} | ConvertTo-Json

try {
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    $statusResp = Invoke-RestMethod -Uri "http://localhost:8004/drivers/me/status" -Method POST -Body $statusBody -Headers $headers
    Write-Host "  ✅ Status: $($statusResp.status)" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
}

# Step 3: Update location (simulate GPS coordinates from Ho Chi Minh City)
Write-Host "`n[3/4] Update location (GPS coordinates)..." -ForegroundColor Yellow
$locations = @(
    @{ lat = 10.762622; lng = 106.660172; name = "District 1" },
    @{ lat = 10.775000; lng = 106.700000; name = "District 3" },
    @{ lat = 10.780000; lng = 106.695000; name = "Binh Thanh" }
)

foreach ($loc in $locations) {
    Write-Host "  📍 Updating to: $($loc.name) ($($loc.lat), $($loc.lng))" -ForegroundColor Cyan
    
    $locationBody = @{
        lat = $loc.lat
        lng = $loc.lng
        accuracyM = 10
    } | ConvertTo-Json
    
    try {
        $locationResp = Invoke-RestMethod -Uri "http://localhost:8004/drivers/me/location" -Method POST -Body $locationBody -Headers $headers
        Write-Host "    ✅ Success - State: $($locationResp.state)" -ForegroundColor Green
        Start-Sleep -Seconds 1
    } catch {
        Write-Host "    ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 4: Verify in Redis
Write-Host "`n[4/4] Verify location in Redis..." -ForegroundColor Yellow
try {
    # Get driver state
    $state = docker exec -i taxi_redis redis-cli GET "driver:state:$($tokenData.driverId)"
    Write-Host "  📊 Driver State: $state" -ForegroundColor Cyan
    
    # Get geo position
    $geoPos = docker exec -i taxi_redis redis-cli GEOPOS "geo:drivers:CAR_4" "$($tokenData.driverId)"
    Write-Host "  📍 Geo Position in Redis:" -ForegroundColor Cyan
    Write-Host "    $geoPos" -ForegroundColor White
    
    # Count nearby drivers
    $nearby = docker exec -i taxi_redis redis-cli GEORADIUS "geo:drivers:CAR_4" 106.700000 10.775000 5000 m WITHCOORD
    Write-Host "`n  🚗 Nearby drivers (5km radius):" -ForegroundColor Cyan
    Write-Host "    $nearby" -ForegroundColor White
} catch {
    Write-Host "  ⚠️ Redis check failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "`nTo test in browser: file:///C:/Users/Levinh/Desktop/car-booking/test-gps.html" -ForegroundColor Yellow
Write-Host "Or frontend: http://localhost:5174" -ForegroundColor Yellow
