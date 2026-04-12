# Test Suite - Car Booking System

Comprehensive test suite cho multi-driver offer/reject/timeout flows.

## Test Files

### 1. Automated Tests

#### PowerShell (Windows)
```powershell
# Verify system readiness
.\test\verify-test-readiness.ps1

# Run ALL tests (verify + quick + full)
.\test\run-all-tests.ps1

# Or run specific test suites:
.\test\run-all-tests.ps1 -QuickOnly   # Skip full suite
.\test\run-all-tests.ps1 -FullOnly    # Skip quick tests
.\test\run-all-tests.ps1 -SkipVerify  # Skip verification

# Individual tests:
.\test\test-multi-driver-offer.ps1  # Full suite (both scenarios)
.\test\quick-test-reject.ps1        # Just reject flow (~10 seconds)
.\test\quick-test-timeout.ps1       # Just timeout flow (~15 seconds)
```

#### Bash (Linux/Mac/WSL)
```bash
# Make executable
chmod +x ./test/test-multi-driver-offer.sh

# Run automated test
./test/test-multi-driver-offer.sh
```

### 2. Manual Tests

Xem hướng dẫn chi tiết: [MANUAL_TEST_MULTI_DRIVER.md](./MANUAL_TEST_MULTI_DRIVER.md)

Step-by-step guide để test thủ công với driver.html và testbooking.html UI.

## Test Scenarios

### Test Case A: Reject Flow

**Scenario**: Driver đầu tiên reject offer → Offer chuyển sang driver thứ 2

**Steps**:
1. Setup 2 drivers (d1, d2) ONLINE với location gần nhau
2. User tạo booking
3. d1 nhận offer đầu tiên
4. **d1 clicks Reject**
5. d2 nhận offer
6. d2 accepts
7. Ride status = DRIVER_ASSIGNED, driver_id = d2

**Expected Results**:
- ✅ Offer chuyển từ d1 → d2 trong < 2s
- ✅ Database: offer d1 = REJECTED, offer d2 = ACCEPTED
- ✅ User nhận SSE event RIDE_ACCEPTED với driverId = d2
- ✅ Driver d1 unlock, driver d2 lock → BUSY

### Test Case B: Timeout Flow

**Scenario**: Driver đầu tiên không respond → Timeout → Offer chuyển sang driver thứ 2

**Steps**:
1. Setup 2 drivers (d1, d2) ONLINE
2. User tạo booking
3. d1 nhận offer
4. **d1 không click gì (wait OFFER_TIMEOUT_SEC)**
5. Timeout loop mark offer TIMEOUT
6. d2 nhận offer
7. d2 accepts
8. Ride status = DRIVER_ASSIGNED, driver_id = d2

**Expected Results**:
- ✅ Sau OFFER_TIMEOUT_SEC (10s dev, 60s prod), offer auto-expire
- ✅ Database: offer d1 = TIMEOUT, offer d2 = ACCEPTED
- ✅ Logs show: `[RIDE] TIMEOUT ride=... driver=d1 -> offer next`
- ✅ Driver d1 unlock, driver d2 lock → BUSY

## Test Architecture

```
┌──────────────┐
│  User u1     │
│ (testbooking)│
└──────┬───────┘
       │ 1. Create Booking
       │    vehicleType=CAR_4
       ▼
┌──────────────┐      2. BOOKING_MATCH_REQUESTED      ┌──────────────┐
│ Booking Svc  │ ────────────────────────────────────>│  Ride Svc    │
└──────────────┘           (via Kafka)                └──────┬───────┘
                                                              │
                                                              │ 3. Query Nearby
                                                              ▼
                                                       ┌──────────────┐
                                                       │ Driver Svc   │
                                                       │ Returns:     │
                                                       │ [d1, d2]     │
                                                       └──────────────┘
                                                              │
                           ┌──────────────────────────────────┘
                           │ 4. Sequential Offering
                           ▼
                    ┌──────────────┐
                    │   Driver d1  │
                    │ (driver.html)│
                    └──────┬───────┘
                           │
                   ┌───────┴────────┐
                   │                │
            ACCEPT │                │ REJECT or TIMEOUT
                   ▼                ▼
             ┌─────────┐      ┌──────────────┐
             │  DONE   │      │   Driver d2  │
             │  BUSY   │      │ (driver.html)│
             └─────────┘      └──────┬───────┘
                                     │
                                     │ ACCEPT
                                     ▼
                               ┌─────────┐
                               │  DONE   │
                               │  BUSY   │
                               └─────────┘
```

## Database Schema (Rides)

### rides table
```sql
CREATE TABLE rides (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL,
  user_id TEXT,
  driver_id UUID,                    -- Final assigned driver
  status TEXT,                        -- OFFERING | DRIVER_ASSIGNED | COMPLETED | NO_DRIVER_FOUND
  candidates JSONB,                   -- Array of nearby drivers
  candidate_index INT DEFAULT 0,     -- Current offer index
  current_offer_driver_id UUID,      -- Driver being offered to
  offer_expires_at TIMESTAMPTZ,      -- Offer expiration
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### ride_offers table
```sql
CREATE TABLE ride_offers (
  id UUID PRIMARY KEY,
  ride_id UUID NOT NULL,
  driver_id TEXT NOT NULL,
  status TEXT DEFAULT 'OFFERED',     -- OFFERED | ACCEPTED | REJECTED | TIMEOUT
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);
```

## Verification Queries

### Check ride status
```sql
SELECT 
  r.id, 
  r.booking_id, 
  r.status, 
  r.driver_id, 
  r.current_offer_driver_id,
  r.candidate_index
FROM rides r 
WHERE r.booking_id = '<booking-id>';
```

### Check all offers for a ride
```sql
SELECT 
  ro.driver_id,
  ro.status,
  ro.created_at,
  ro.responded_at,
  EXTRACT(EPOCH FROM (responded_at - created_at)) as response_time_sec
FROM ride_offers ro
WHERE ro.ride_id = '<ride-id>'
ORDER BY ro.created_at;
```

Expected output for Reject flow:
```
driver_id | status   | response_time_sec
----------+----------+------------------
d1        | REJECTED | 5.2
d2        | ACCEPTED | 3.1
```

Expected output for Timeout flow:
```
driver_id | status   | response_time_sec
----------+----------+------------------
d1        | TIMEOUT  | NULL (handled by timeout loop)
d2        | ACCEPTED | 2.8
```

### Check Redis locks
```powershell
# Check if driver is locked
docker exec -it taxi_redis redis-cli GET "lock:driver:d1"

# Check driver state
docker exec -it taxi_redis redis-cli GET "driver:state:d1"

# Expected:
# - During offer: lock exists (value="1"), state="ONLINE"
# - After accept: lock removed, state="BUSY"
# - After reject: lock removed, state="ONLINE"
```

## Logs to Monitor

### Ride Service
```powershell
docker logs -f taxi_ride_dev
```

Key log patterns:
```
[RIDE] MATCH_REQUEST booking=<id> ride=<id> drivers=2
[RIDE] Offered ride=<id> to driver=d1 idx=0
[RIDE] TIMEOUT ride=<id> driver=d1 -> offer next
[RIDE] Offered ride=<id> to driver=d2 idx=1
```

### Driver Service
```powershell
docker logs -f taxi_driver_dev
```

Key log patterns:
```
[DRIVER] d1 set state ONLINE
[DRIVER] d1 updated location
[DRIVER] Nearby query: found 2 drivers
```

### Notification Service
```powershell
docker logs -f taxi_notification_dev
```

Key log patterns:
```
[NOTIF] Publishing RIDE_OFFERED_TO_DRIVER to d1
[NOTIF] Publishing RIDE_ACCEPTED to u1
```

### Kafka Events
```bash
docker exec -it taxi_kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:9092 \
  --topic taxi.events \
  --from-beginning \
  --max-messages 50
```

## Environment Variables

### Ride Service

| Variable | Default | Description |
|----------|---------|-------------|
| OFFER_TIMEOUT_SEC | 60 | Offer expiration time (dev: 10) |
| DRIVER_BASE_URL | http://driver-service:8004 | Driver service URL |
| REDIS_URL | redis://redis:6379 | Redis connection |

### Test Configuration

Edit `docker-compose.dev.yml` to change timeout for faster testing:

```yaml
ride-service:
  environment:
    OFFER_TIMEOUT_SEC: 10  # Fast timeout for dev/testing
```

## Troubleshooting

### Issue: Test fails at "d2 không nhận offer"

**Possible causes**:
1. d2 không ONLINE
2. d2 heartbeat expired
3. d2 location ngoài radius
4. d1 lock không được unlock

**Debug**:
```powershell
# Check d2 state
docker exec -it taxi_redis redis-cli GET "driver:state:d2"

# Check d2 heartbeat
docker exec -it taxi_redis redis-cli GET "driver:hb:d2"

# Check d1 lock
docker exec -it taxi_redis redis-cli GET "lock:driver:d1"

# Check ride state
docker exec -i taxi_postgres psql -U taxi -d ride_db -c \
  "SELECT current_offer_driver_id, candidate_index FROM rides WHERE booking_id='<id>'"
```

### Issue: Timeout không trigger

**Check timeout loop**:
```powershell
docker logs taxi_ride_dev | Select-String "timeout loop"
```

Should see logs every 2-3 seconds checking for expired offers.

**Manual force expire** (for testing):
```sql
UPDATE rides 
SET offer_expires_at = now() - interval '1 second'
WHERE id = '<ride-id>';
```

### Issue: SSE không nhận event

**Check SSE connection**:
```powershell
curl -N "http://localhost:8007/notifications/stream?role=DRIVER&driverId=d1"
```

Should see: `Connected to SSE stream. Waiting for events...`

**Check Kafka consumer**:
```powershell
docker logs taxi_notification_dev | Select-String "SSE"
```

## Success Metrics

✅ **Full Test Suite PASSED nếu**:

1. **Test Case A (Reject)**:
   - d1 reject → d2 offered in < 2s
   - Database: d1=REJECTED, d2=ACCEPTED
   - User SSE: RIDE_ACCEPTED event
   - Ride: status=DRIVER_ASSIGNED, driver_id=d2

2. **Test Case B (Timeout)**:
   - d1 timeout after OFFER_TIMEOUT_SEC
   - d2 offered automatically
   - Database: d1=TIMEOUT, d2=ACCEPTED
   - Logs: TIMEOUT message exists
   - Ride: status=DRIVER_ASSIGNED, driver_id=d2

3. **System State**:
   - No orphaned locks in Redis
   - All drivers back to ONLINE after test
   - No stuck rides in OFFERING state
   - Kafka events published correctly

## Quick Start

### Option 1: Automated (Recommended)

```powershell
# 1. Verify system
.\test\verify-test-readiness.ps1

# 2. Run full test suite
powershell -ExecutionPolicy Bypass -File .\test\test-multi-driver-offer.ps1
```

### Option 2: Manual (For UI testing)

```powershell
# 1. Open terminals/tabs
# - Tab 1: driver.html (d1)
# - Tab 2: driver.html (d2)
# - Tab 3: SSE stream (u1)
# - Tab 4: testbooking.html

# 2. Follow guide
Get-Content .\test\MANUAL_TEST_MULTI_DRIVER.md
```

### Option 3: Step-by-step API calls

See existing `happybooking.sh` for individual curl commands.

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Multi-Driver Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start services
        run: docker compose -f docker-compose.dev.yml up -d
      
      - name: Wait for services
        run: sleep 30
      
      - name: Run tests
        run: ./test/test-multi-driver-offer.sh
      
      - name: Check results
        run: |
          docker logs taxi_ride_dev
          docker exec -i taxi_postgres psql -U taxi -d ride_db -c \
            "SELECT COUNT(*) FROM ride_offers WHERE status IN ('REJECTED', 'TIMEOUT', 'ACCEPTED')"
```

## References

- [Service Architecture](../README.md)
- [E2E Testing Guide](../TESTING.md)
- [Troubleshooting](../TROUBLESHOOTING.md)
- [Driver Dashboard](../frontend/driver.html)
- [User Booking UI](../frontend/testbooking.html)

---

**Last Updated**: 2026-02-22  
**Test Coverage**: Reject flow, Timeout flow, Sequential offering, Redis locking, SSE notifications
