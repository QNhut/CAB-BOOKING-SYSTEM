# Pre-test Verification Script
# Check if system is ready for multi-driver offer tests

Write-Host "=== PRE-TEST VERIFICATION ===" -ForegroundColor Cyan
Write-Host "Checking if system is ready for multi-driver offer tests...`n"

$allOk = $true

# ==========================================
# 1. Check Docker Services
# ==========================================

Write-Host "[1] Checking Docker services..." -ForegroundColor Yellow

$requiredServices = @(
    "taxi_redis",
    "taxi_postgres",
    "taxi_kafka",
    "taxi_booking_dev",
    "taxi_driver_dev",
    "taxi_ride_dev",
    "taxi_notification_dev"
)

foreach ($service in $requiredServices) {
    $running = docker ps --format "{{.Names}}" | Select-String -Pattern "^$service$" -Quiet
    if ($running) {
        Write-Host "  OK - $service is running" -ForegroundColor Green
    } else {
        Write-Host "  ERROR - $service is NOT running" -ForegroundColor Red
        $allOk = $false
    }
}

# ==========================================
# 2. Check OFFER_TIMEOUT_SEC
# ==========================================

Write-Host "`n[2] Checking OFFER_TIMEOUT_SEC..." -ForegroundColor Yellow

try {
    $logs = docker logs taxi_ride_dev 2>&1 | Select-String "OFFER_TIMEOUT" | Select-Object -First 1
    if ($logs) {
        Write-Host "  Found: $logs" -ForegroundColor Green
    } else {
        Write-Host "  WARNING - Cannot find OFFER_TIMEOUT_SEC in logs" -ForegroundColor Yellow
        Write-Host "  Default is likely 60 seconds (production) or 10 seconds (dev)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  WARNING - Cannot read ride-service logs" -ForegroundColor Yellow
}

# ==========================================
# 3. Test Redis Connection
# ==========================================

Write-Host "`n[3] Testing Redis connection..." -ForegroundColor Yellow

try {
    $ping = docker exec -i taxi_redis redis-cli PING 2>&1
    if ($ping -match "PONG") {
        Write-Host "  OK - Redis responding" -ForegroundColor Green
    } else {
        Write-Host "  ERROR - Redis not responding" -ForegroundColor Red
        $allOk = $false
    }
} catch {
    Write-Host "  ERROR - Cannot connect to Redis: $($_.Exception.Message)" -ForegroundColor Red
    $allOk = $false
}

# ==========================================
# 4. Test Postgres Connection
# ==========================================

Write-Host "`n[4] Testing Postgres connection..." -ForegroundColor Yellow

try {
    $pgVersion = docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT version();" -t 2>&1
    if ($pgVersion) {
        Write-Host "  OK - Postgres responding" -ForegroundColor Green
    } else {
        Write-Host "  ERROR - Postgres not responding" -ForegroundColor Red
        $allOk = $false
    }
} catch {
    Write-Host "  ERROR - Cannot connect to Postgres: $($_.Exception.Message)" -ForegroundColor Red
    $allOk = $false
}

# ==========================================
# 5. Test API Endpoints
# ==========================================

Write-Host "`n[5] Testing API endpoints..." -ForegroundColor Yellow

$endpoints = @(
    @{Name="Driver Service"; Url="http://localhost:8004/health"},
    @{Name="Booking Service"; Url="http://localhost:8003/health"},
    @{Name="Ride Service"; Url="http://localhost:8005/health"},
    @{Name="Pricing Service"; Url="http://localhost:8006/pricing/health"},
    @{Name="Notification Service"; Url="http://localhost:8007/health"}
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-RestMethod -Uri $endpoint.Url -TimeoutSec 3 -ErrorAction Stop
        Write-Host "  OK - $($endpoint.Name)" -ForegroundColor Green
    } catch {
        Write-Host "  ERROR - $($endpoint.Name) not responding" -ForegroundColor Red
        $allOk = $false
    }
}

# ==========================================
# 6. Clean Previous Test Data
# ==========================================

Write-Host "`n[6] Checking for existing test drivers..." -ForegroundColor Yellow

try {
    $d1State = docker exec -i taxi_redis redis-cli GET "driver:state:d1" 2>&1
    $d2State = docker exec -i taxi_redis redis-cli GET "driver:state:d2" 2>&1
    
    if ($d1State -or $d2State) {
        Write-Host "  Found existing test drivers:" -ForegroundColor Yellow
        if ($d1State) { Write-Host "    d1: $d1State" }
        if ($d2State) { Write-Host "    d2: $d2State" }
        
        Write-Host "`n  Recommendation: Clean Redis before testing" -ForegroundColor Yellow
        Write-Host "  Run: docker exec -it taxi_redis redis-cli FLUSHALL" -ForegroundColor White
    } else {
        Write-Host "  OK - No existing test drivers" -ForegroundColor Green
    }
} catch {
    Write-Host "  WARNING - Cannot check Redis state" -ForegroundColor Yellow
}

# ==========================================
# 7. Check Kafka Topics
# ==========================================

Write-Host "`n[7] Checking Kafka topics..." -ForegroundColor Yellow

try {
    $topics = docker exec -i taxi_kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --list 2>&1
    foreach ($t in @("taxi.bookings", "taxi.rides", "taxi.payments")) {
        if ($topics -match [regex]::Escape($t)) {
            Write-Host "  OK - $t topic exists" -ForegroundColor Green
        } else {
            Write-Host "  WARNING - $t topic not found" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "  WARNING - Cannot check Kafka topics" -ForegroundColor Yellow
}

# ==========================================
# SUMMARY
# ==========================================

Write-Host "`n=== VERIFICATION SUMMARY ===" -ForegroundColor Cyan

if ($allOk) {
    Write-Host "`nOK - System is ready for testing!" -ForegroundColor Green
    Write-Host "`nYou can now run:" -ForegroundColor White
    Write-Host "  1. Automated Test:" -ForegroundColor Yellow
    Write-Host "     powershell -File .\test\test-multi-driver-offer.ps1" -ForegroundColor White
    Write-Host "`n  2. Manual Test:" -ForegroundColor Yellow
    Write-Host "     See .\test\MANUAL_TEST_MULTI_DRIVER.md" -ForegroundColor White
} else {
    Write-Host "`nERROR - System is NOT ready!" -ForegroundColor Red
    Write-Host "Please fix the errors above before running tests." -ForegroundColor Yellow
}

Write-Host "`n"
