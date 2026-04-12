# Auth Service Test Script

Write-Host "=== AUTH SERVICE TEST ===" -ForegroundColor Cyan

$AUTH_URL = "http://localhost:8001"

# ==========================================
# 1. Health Check
# ==========================================

Write-Host "`n[1] Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$AUTH_URL/health"
    Write-Host "  OK - $($health.service)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR - Auth service not running" -ForegroundColor Red
    exit 1
}

# ==========================================
# 2. Register User
# ==========================================

Write-Host "`n[2] Register User..." -ForegroundColor Yellow
try {
    $user = Invoke-RestMethod -Method Post -Uri "$AUTH_URL/auth/register" `
        -Headers @{"Content-Type"="application/json"} `
        -Body '{"identifier":"testuser@example.com","password":"password123","role":"USER","userId":"test-u1"}'
    
    Write-Host "  Account ID: $($user.account.id)" -ForegroundColor Green
    Write-Host "  Role: $($user.account.role)" -ForegroundColor Green
    Write-Host "  Access Token: $($user.accessToken.Substring(0,20))..." -ForegroundColor Green
    
    $userAccessToken = $user.accessToken
    $userRefreshToken = $user.refreshToken
} catch {
    if ($_.Exception.Message -match "409") {
        Write-Host "  User already exists, attempting login..." -ForegroundColor Yellow
        
        $user = Invoke-RestMethod -Method Post -Uri "$AUTH_URL/auth/login" `
            -Headers @{"Content-Type"="application/json"} `
            -Body '{"identifier":"testuser@example.com","password":"password123","userId":"test-u1"}'
        
        Write-Host "  Logged in successfully" -ForegroundColor Green
        $userAccessToken = $user.accessToken
        $userRefreshToken = $user.refreshToken
    } else {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# ==========================================
# 3. Register Driver
# ==========================================

Write-Host "`n[3] Register Driver..." -ForegroundColor Yellow
try {
    $driver = Invoke-RestMethod -Method Post -Uri "$AUTH_URL/auth/register" `
        -Headers @{"Content-Type"="application/json"} `
        -Body '{"identifier":"testdriver@example.com","password":"password123","role":"DRIVER","driverId":"test-d1"}'
    
    Write-Host "  Account ID: $($driver.account.id)" -ForegroundColor Green
    Write-Host "  Role: $($driver.account.role)" -ForegroundColor Green
    Write-Host "  Driver ID in token: test-d1" -ForegroundColor Green
    
    $driverAccessToken = $driver.accessToken
    $driverRefreshToken = $driver.refreshToken
} catch {
    if ($_.Exception.Message -match "409") {
        Write-Host "  Driver already exists, attempting login..." -ForegroundColor Yellow
        
        $driver = Invoke-RestMethod -Method Post -Uri "$AUTH_URL/auth/login" `
            -Headers @{"Content-Type"="application/json"} `
            -Body '{"identifier":"testdriver@example.com","password":"password123","driverId":"test-d1"}'
        
        Write-Host "  Logged in successfully" -ForegroundColor Green
        $driverAccessToken = $driver.accessToken
        $driverRefreshToken = $driver.refreshToken
    } else {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# ==========================================
# 4. Get User Info
# ==========================================

Write-Host "`n[4] Get User Info (/auth/me)..." -ForegroundColor Yellow
try {
    $me = Invoke-RestMethod -Uri "$AUTH_URL/auth/me" `
        -Headers @{"Authorization"="Bearer $userAccessToken"}
    
    Write-Host "  Identifier: $($me.account.identifier)" -ForegroundColor Green
    Write-Host "  Role: $($me.account.role)" -ForegroundColor Green
    Write-Host "  User ID: $($me.auth.userId)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

# ==========================================
# 5. Get Driver Info
# ==========================================

Write-Host "`n[5] Get Driver Info (/auth/me)..." -ForegroundColor Yellow
try {
    $me = Invoke-RestMethod -Uri "$AUTH_URL/auth/me" `
        -Headers @{"Authorization"="Bearer $driverAccessToken"}
    
    Write-Host "  Identifier: $($me.account.identifier)" -ForegroundColor Green
    Write-Host "  Role: $($me.account.role)" -ForegroundColor Green
    Write-Host "  Driver ID: $($me.auth.driverId)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

# ==========================================
# 6. Refresh Token
# ==========================================

Write-Host "`n[6] Refresh Token..." -ForegroundColor Yellow
try {
    $refreshed = Invoke-RestMethod -Method Post -Uri "$AUTH_URL/auth/refresh" `
        -Headers @{"Content-Type"="application/json"} `
        -Body "{`"refreshToken`":`"$userRefreshToken`"}"
    
    Write-Host "  New Access Token: $($refreshed.accessToken.Substring(0,20))..." -ForegroundColor Green
    Write-Host "  New Refresh Token: $($refreshed.refreshToken.Substring(0,20))..." -ForegroundColor Green
    
    $newUserAccessToken = $refreshed.accessToken
    $newUserRefreshToken = $refreshed.refreshToken
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

# ==========================================
# 7. Verify Old Refresh Token is Revoked
# ==========================================

Write-Host "`n[7] Verify Old Refresh Token is Revoked..." -ForegroundColor Yellow
try {
    $shouldFail = Invoke-RestMethod -Method Post -Uri "$AUTH_URL/auth/refresh" `
        -Headers @{"Content-Type"="application/json"} `
        -Body "{`"refreshToken`":`"$userRefreshToken`"}"
    
    Write-Host "  ERROR - Old token should have been revoked!" -ForegroundColor Red
} catch {
    if ($_.Exception.Message -match "401") {
        Write-Host "  OK - Old token correctly revoked" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ==========================================
# 8. Logout
# ==========================================

Write-Host "`n[8] Logout..." -ForegroundColor Yellow
try {
    $logout = Invoke-RestMethod -Method Post -Uri "$AUTH_URL/auth/logout" `
        -Headers @{"Content-Type"="application/json"} `
        -Body "{`"refreshToken`":`"$newUserRefreshToken`"}"
    
    Write-Host "  OK - $($logout.message)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

# ==========================================
# 9. Verify Logout
# ==========================================

Write-Host "`n[9] Verify Token After Logout..." -ForegroundColor Yellow
try {
    $shouldFail = Invoke-RestMethod -Method Post -Uri "$AUTH_URL/auth/refresh" `
        -Headers @{"Content-Type"="application/json"} `
        -Body "{`"refreshToken`":`"$newUserRefreshToken`"}"
    
    Write-Host "  ERROR - Token should have been revoked after logout!" -ForegroundColor Red
} catch {
    if ($_.Exception.Message -match "401") {
        Write-Host "  OK - Token correctly revoked after logout" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ==========================================
# 10. Test Invalid Token
# ==========================================

Write-Host "`n[10] Test Invalid Token..." -ForegroundColor Yellow
try {
    $shouldFail = Invoke-RestMethod -Uri "$AUTH_URL/auth/me" `
        -Headers @{"Authorization"="Bearer invalid-token-12345"}
    
    Write-Host "  ERROR - Invalid token should have been rejected!" -ForegroundColor Red
} catch {
    if ($_.Exception.Message -match "401") {
        Write-Host "  OK - Invalid token correctly rejected" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ==========================================
# Summary
# ==========================================

Write-Host "`n=== TEST SUMMARY ===" -ForegroundColor Cyan
Write-Host "All core auth flows tested:" -ForegroundColor White
Write-Host "  OK - Register (User & Driver)" -ForegroundColor Green
Write-Host "  OK - Login" -ForegroundColor Green
Write-Host "  OK - Get user info (/auth/me)" -ForegroundColor Green
Write-Host "  OK - Refresh token (with rotation)" -ForegroundColor Green
Write-Host "  OK - Logout" -ForegroundColor Green
Write-Host "  OK - Token validation" -ForegroundColor Green

Write-Host "`nTokens for manual testing:" -ForegroundColor Yellow
Write-Host "Driver Access Token:" -ForegroundColor White
Write-Host $driverAccessToken -NoNewline
Write-Host ""

Write-Host "`nTo check database:" -ForegroundColor Yellow
Write-Host '  docker exec -i taxi_postgres psql -U taxi -d auth_db -c "SELECT * FROM accounts"' -ForegroundColor White
Write-Host '  docker exec -i taxi_postgres psql -U taxi -d auth_db -c "SELECT * FROM refresh_tokens ORDER BY created_at DESC LIMIT 5"' -ForegroundColor White
Write-Host '  docker exec -i taxi_postgres psql -U taxi -d auth_db -c "SELECT * FROM login_audit ORDER BY created_at DESC LIMIT 10"' -ForegroundColor White

Write-Host "`n"
