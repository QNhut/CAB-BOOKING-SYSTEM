# Run All Tests
# Master script to run all test scenarios

param(
    [switch]$SkipVerify,
    [switch]$QuickOnly,
    [switch]$FullOnly
)

Write-Host "=== CAR BOOKING SYSTEM - TEST RUNNER ===" -ForegroundColor Cyan
Write-Host ""

# ==========================================
# 1. Verify System Readiness
# ==========================================

if (-not $SkipVerify) {
    Write-Host "Step 1: Verifying system readiness..." -ForegroundColor Yellow
    & "$PSScriptRoot\verify-test-readiness.ps1"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nERROR: System verification failed. Fix issues before running tests." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "`nPress Enter to continue with tests, or Ctrl+C to abort..."
    Read-Host
}

# ==========================================
# 2. Quick Tests
# ==========================================

if (-not $FullOnly) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "QUICK TESTS (Fast, individual scenarios)" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Write-Host "Running Quick Test 1: Reject Flow..." -ForegroundColor Yellow
    & "$PSScriptRoot\quick-test-reject.ps1"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nOK - Reject test passed" -ForegroundColor Green
    } else {
        Write-Host "`nERROR - Reject test failed" -ForegroundColor Red
    }
    
    Write-Host "`n----------------------------------------`n"
    
    Write-Host "Running Quick Test 2: Timeout Flow..." -ForegroundColor Yellow
    & "$PSScriptRoot\quick-test-timeout.ps1"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nOK - Timeout test passed" -ForegroundColor Green
    } else {
        Write-Host "`nERROR - Timeout test failed" -ForegroundColor Red
    }
}

# ==========================================
# 3. Full Test Suite
# ==========================================

if (-not $QuickOnly) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "FULL TEST SUITE (Comprehensive)" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Write-Host "Running Full Multi-Driver Test Suite..." -ForegroundColor Yellow
    Write-Host "This will test both Reject and Timeout flows in sequence.`n" -ForegroundColor Yellow
    
    & "$PSScriptRoot\test-multi-driver-offer.ps1"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nOK - Full test suite passed" -ForegroundColor Green
    } else {
        Write-Host "`nERROR - Full test suite failed" -ForegroundColor Red
    }
}

# ==========================================
# 4. Summary
# ==========================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Tests completed. Check logs above for details." -ForegroundColor White

Write-Host "`nTo check database state:" -ForegroundColor Yellow
Write-Host '  docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT * FROM ride_offers ORDER BY created_at DESC LIMIT 10"' -ForegroundColor White

Write-Host "`nTo check Kafka events:" -ForegroundColor Yellow
Write-Host '  docker exec -it taxi_kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:9092 --topic taxi.events --from-beginning --max-messages 50' -ForegroundColor White

Write-Host "`nTo check service logs:" -ForegroundColor Yellow
Write-Host "  docker logs taxi_ride_dev --tail 50" -ForegroundColor White

Write-Host "`n"
