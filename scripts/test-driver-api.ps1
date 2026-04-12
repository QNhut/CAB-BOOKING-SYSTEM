# Test driver API endpoints
Write-Host "=== Test Driver API ===" -ForegroundColor Cyan

# Step 1: Login as driver
Write-Host "`n1. Login as driver..." -ForegroundColor Yellow
$loginBody = @{
    identifier = "driver@test.com"
    password = "pass123"
} | ConvertTo-Json

try {
    $loginResp = Invoke-RestMethod -Uri "http://localhost:8001/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    Write-Host "✅ Login successful" -ForegroundColor Green
    $token = $loginResp.accessToken
    
    # Decode token to see claims
    $tokenParts = $token.Split('.')
    $payload = $tokenParts[1]
    # Add padding if needed
    while ($payload.Length % 4 -ne 0) { $payload += "=" }
    $decodedBytes = [System.Convert]::FromBase64String($payload)
    $decodedText = [System.Text.Encoding]::UTF8.GetString($decodedBytes)
    Write-Host "Token payload: $decodedText" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Test set status
Write-Host "`n2. Test set status to ONLINE..." -ForegroundColor Yellow
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
    Write-Host "✅ Status updated: $($statusResp | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Status update failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
}

# Step 3: Test update location
Write-Host "`n3. Test update location..." -ForegroundColor Yellow
$locationBody = @{
    lat = 10.775
    lng = 106.700
    accuracyM = 10
} | ConvertTo-Json

try {
    $locationResp = Invoke-RestMethod -Uri "http://localhost:8004/drivers/me/location" -Method POST -Body $locationBody -Headers $headers
    Write-Host "✅ Location updated: $($locationResp | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Location update failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
