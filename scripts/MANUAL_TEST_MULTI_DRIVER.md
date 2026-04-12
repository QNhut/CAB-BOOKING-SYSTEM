# Manual Test Guide: Multi-Driver Offer/Reject/Timeout Flow

## Overview

Test các scenarios sau:
- **Test Case A**: Driver reject → offer chuyển sang driver khác
- **Test Case B**: Offer timeout → offer chuyển sang driver khác

## Prerequisites

1. Tất cả services đang chạy:
   ```powershell
   docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String "taxi_"
   ```

2. Kiểm tra `OFFER_TIMEOUT_SEC` trong ride-service (default: 60s, dev: 10s)
   ```powershell
   docker logs taxi_ride_dev | Select-String "OFFER_TIMEOUT"
   ```

---

## Test Case A: Reject Flow

### Step 1: Chuẩn bị 2 Drivers

#### Tab 1: Driver d1

1. Mở [driver.html](../frontend/driver.html) trong tab mới
2. **Driver ID**: `d1`
3. **Loại xe**: `CAR_4`
4. Click **"Áp dụng"** (set status + vehicleType)
5. **Tọa độ**: 
   - Lat: `10.762622`
   - Lng: `106.660172`
6. Click **"Cập nhật vị trí"**
7. Click **"Kết nối SSE"**

✅ Verify: Status badge = 🟢 ONLINE, Current Ride = "Chưa có ride"

#### Tab 2: Driver d2

1. Mở [driver.html](../frontend/driver.html) trong tab mới khác
2. **Driver ID**: `d2`
3. **Loại xe**: `CAR_4`
4. Click **"Áp dụng"**
5. **Tọa độ**:
   - Lat: `10.763200`
   - Lng: `106.661000`
6. Click **"Cập nhật vị trí"**
7. Click **"Kết nối SSE"**

✅ Verify: Status badge = 🟢 ONLINE

#### Verify both drivers

Terminal:
```powershell
Invoke-RestMethod -Uri "http://localhost:8004/drivers/nearby?lat=10.762622&lng=106.660172&radiusM=3000&vehicleType=CAR_4&limit=10" | ConvertTo-Json
```

Expected output:
```json
{
  "drivers": [
    {"driverId": "d1", "distanceM": 0},
    {"driverId": "d2", "distanceM": 100}
  ]
}
```

### Step 2: Setup SSE cho User

#### Tab 3: User u1 SSE

Mở URL trong tab mới:
```
http://localhost:8007/notifications/stream?role=USER&userId=u1
```

Browser sẽ hiển thị SSE stream. Giữ tab này mở.

### Step 3: Tạo Booking

#### Tab 4: User Booking

1. Mở [testbooking.html](../frontend/testbooking.html)
2. **User ID**: `u1`
3. **Pickup**: `10.762622, 106.660172` (gần d1)
4. **Dropoff**: `10.770000, 106.670000`
5. **Loại xe**: `Xe 4 chỗ`
6. Click **"Get estimate"** → verify price
7. Click **"Tạo Booking"**

### Step 4: Observe Events

#### Tab 1 (Driver d1) 
Sẽ nhận SSE event:
```json
{
  "eventType": "RIDE_OFFERED_TO_DRIVER",
  "payload": {
    "rideId": "...",
    "bookingId": "...",
    "driverId": "d1",
    "expiresInSec": 10
  }
}
```

**Current Ride card** sẽ hiển thị ride info với 3 buttons: Accept | Reject | Complete

#### Tab 2 (Driver d2)
Chưa nhận gì.

#### Tab 3 (User u1)
Nhận event `BOOKING_CREATED`, `BOOKING_MATCH_REQUESTED`.

### Step 5: Driver d1 REJECT

#### Tab 1 (Driver d1)
Click button **"❌ Reject"**

Expected:
- Alert: "Rejected ride ..."
- Current Ride card biến mất
- Ride ID cleared

### Step 6: Observe Offer Transfer

#### Tab 2 (Driver d2)
Sau vài giây (< 2s), sẽ nhận SSE event:
```json
{
  "eventType": "RIDE_OFFERED_TO_DRIVER",
  "payload": {
    "rideId": "...",
    "bookingId": "...",
    "driverId": "d2",
    "expiresInSec": 10
  }
}
```

**Current Ride card** xuất hiện với ride info.

#### Tab 3 (User u1)
Không nhận event gì (ride vẫn đang OFFERING).

### Step 7: Driver d2 ACCEPT

#### Tab 2 (Driver d2)
Click button **"✅ Accept"**

Expected:
- Alert: "Accepted ride ..."
- Status badge → 🔴 BUSY
- Buttons: Accept/Reject disabled, Complete enabled

### Step 8: Verify Final State

#### Tab 3 (User u1)
Nhận SSE event:
```json
{
  "eventType": "RIDE_ACCEPTED",
  "payload": {
    "rideId": "...",
    "bookingId": "...",
    "driverId": "d2",
    "userId": "u1"
  }
}
```

#### Terminal: Check Database
```powershell
# Get booking ID from testbooking.html response
$bookingId = "..." # Copy từ UI

# Check ride status
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT id, status, driver_id FROM rides WHERE booking_id='$bookingId'"
```

Expected:
```
id                                   | status           | driver_id
-------------------------------------+------------------+-----------
xxx-xxx-xxx                          | DRIVER_ASSIGNED  | d2
```

#### Check Offers
```powershell
$rideId = "..." # Copy từ UI hoặc query trên

docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT driver_id, status FROM ride_offers WHERE ride_id='$rideId' ORDER BY created_at"
```

Expected:
```
driver_id | status
----------+---------
d1        | REJECTED
d2        | ACCEPTED
```

✅ **TEST CASE A PASSED**: d1 rejected → d2 offered → d2 accepted → ride DRIVER_ASSIGNED

---

## Test Case B: Timeout Flow

### Step 1: Reset Drivers

#### Tab 1 (Driver d1)
1. Click **"Áp dụng"** lại (set ONLINE)
2. Click **"Cập nhật vị trí"** (refresh heartbeat)

#### Tab 2 (Driver d2)  
1. Click **"Áp dụng"** lại
2. Click **"Cập nhật vị trí"**

### Step 2: Tạo Booking Mới

#### Tab 4 (testbooking.html)
1. Click **"Tạo Booking"** lại
2. Ghi lại Booking ID

### Step 3: Driver d1 Nhận Offer

#### Tab 1 (Driver d1)
Sẽ nhận SSE event `RIDE_OFFERED_TO_DRIVER`.

**Current Ride card** hiển thị ride info.

### Step 4: KHÔNG LÀM GÌ - Chờ Timeout

⏱️ **Chờ `OFFER_TIMEOUT_SEC` seconds** (default 10s dev, 60s prod)

**QUAN TRỌNG**: KHÔNG click Accept/Reject ở tab Driver d1!

### Step 5: Observe Timeout

#### Tab 1 (Driver d1)
Sau timeout, Current Ride card có thể vẫn hiển thị (UI chưa tự động clear).

#### Terminal: Check Logs
```powershell
docker logs taxi_ride_dev --tail 20
```

Expected log:
```
[RIDE] TIMEOUT ride=... driver=d1 -> offer next
[RIDE] Offered ride=... to driver=d2 idx=1
```

### Step 6: Driver d2 Nhận Offer

#### Tab 2 (Driver d2)
Sau timeout, nhận SSE event:
```json
{
  "eventType": "RIDE_OFFERED_TO_DRIVER",
  "payload": {
    "driverId": "d2",
    ...
  }
}
```

**Current Ride card** xuất hiện.

### Step 7: Driver d2 ACCEPT

#### Tab 2 (Driver d2)
Click button **"✅ Accept"**

Expected:
- Status → 🔴 BUSY
- Accept/Reject disabled, Complete enabled

### Step 8: Verify Final State

#### Terminal: Check Offers
```powershell
$rideId = "..." # From UI

docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT driver_id, status FROM ride_offers WHERE ride_id='$rideId' ORDER BY created_at"
```

Expected:
```
driver_id | status
----------+---------
d1        | TIMEOUT
d2        | ACCEPTED
```

#### Check Ride Status
```powershell
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT status, driver_id FROM rides WHERE id='$rideId'"
```

Expected:
```
status           | driver_id
-----------------+-----------
DRIVER_ASSIGNED  | d2
```

✅ **TEST CASE B PASSED**: d1 timeout → d2 offered → d2 accepted → ride DRIVER_ASSIGNED

---

## Expected Events Timeline

### Test Case A (Reject)

| Time | Event | Source | Destination |
|------|-------|--------|-------------|
| 0s   | BOOKING_CREATED | booking-service | Kafka |
| 1s   | BOOKING_MATCH_REQUESTED | booking-service | Kafka |
| 2s   | RIDE_OFFERED_TO_DRIVER (d1) | ride-service | d1 SSE |
| 5s   | d1 clicks Reject | d1 | ride-service |
| 6s   | RIDE_OFFERED_TO_DRIVER (d2) | ride-service | d2 SSE |
| 10s  | d2 clicks Accept | d2 | ride-service |
| 11s  | RIDE_ACCEPTED | ride-service | u1 SSE + Kafka |

### Test Case B (Timeout)

| Time | Event | Source | Destination |
|------|-------|--------|-------------|
| 0s   | BOOKING_CREATED | booking-service | Kafka |
| 1s   | BOOKING_MATCH_REQUESTED | booking-service | Kafka |
| 2s   | RIDE_OFFERED_TO_DRIVER (d1) | ride-service | d1 SSE |
| ... | d1 does nothing | - | - |
| 12s  | Timeout loop detects expired offer | ride-service | - |
| 13s  | RIDE_OFFERED_TO_DRIVER (d2) | ride-service | d2 SSE |
| 15s  | d2 clicks Accept | d2 | ride-service |
| 16s  | RIDE_ACCEPTED | ride-service | u1 SSE + Kafka |

---

## Troubleshooting

### Issue: Driver không nhận offer

**Check:**
1. Driver status = ONLINE? → Check badge color
2. VehicleType = CAR_4? → Check Debug Info
3. Heartbeat còn hạn? → Click "Cập nhật vị trí" lại
4. SSE connected? → Check SSE tab, phải thấy "Connected" hoặc comments

**Fix:**
```powershell
# Reset driver
curl -X POST http://localhost:8004/drivers/me/status `
  -H "Content-Type: application/json" -H "x-driver-id: d1" `
  -d '{"status":"ONLINE","vehicleType":"CAR_4"}'

curl -X POST http://localhost:8004/drivers/me/location `
  -H "Content-Type: application/json" -H "x-driver-id: d1" `
  -d '{"lat":10.762622,"lng":106.660172,"accuracyM":10}'
```

### Issue: Offer không chuyển sang d2 sau reject

**Check:**
```powershell
# Check ride state
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "SELECT current_offer_driver_id, candidate_index, status FROM rides WHERE id='$rideId'"
```

Expected after reject:
- `current_offer_driver_id` = NULL
- `candidate_index` tăng lên (0 → 1)
- `status` = OFFERING

**Check logs:**
```powershell
docker logs taxi_ride_dev --tail 30
```

Should see: `[RIDE] Offered ride=... to driver=d2 idx=1`

### Issue: Timeout không trigger

**Check timeout config:**
```powershell
docker exec -it taxi_ride_dev sh -c 'echo $OFFER_TIMEOUT_SEC'
```

**Check timeout loop running:**
```powershell
docker logs taxi_ride_dev | Select-String "TIMEOUT"
```

Should see: `[RIDE] TIMEOUT ride=... driver=d1 -> offer next`

**Manual trigger** (if needed):
```sql
-- Force expire offer
docker exec -i taxi_postgres psql -U taxi -d ride_db -c "UPDATE rides SET offer_expires_at = now() - interval '1 second' WHERE id='$rideId'"

-- Wait 2-3 seconds for timeout loop to detect
```

---

## Automated Test Alternative

Nếu không muốn test manual, chạy automated script:

**PowerShell:**
```powershell
powershell -ExecutionPolicy Bypass -File .\test\test-multi-driver-offer.ps1
```

**Bash (Git Bash / WSL):**
```bash
chmod +x ./test/test-multi-driver-offer.sh
./test/test-multi-driver-offer.sh
```

Script sẽ:
- Setup 2 drivers tự động
- Tạo 2 bookings
- Test cả reject flow và timeout flow
- Verify database state
- In summary report

---

## Success Criteria

✅ **Test Case A (Reject) SUCCESS nếu:**
- d1 nhận offer đầu tiên
- d1 reject thành công
- d2 nhận offer sau reject (< 2s)
- d2 accept thành công
- Ride status = DRIVER_ASSIGNED
- Ride driver_id = d2
- Offers table: d1=REJECTED, d2=ACCEPTED

✅ **Test Case B (Timeout) SUCCESS nếu:**
- d1 nhận offer đầu tiên
- Sau OFFER_TIMEOUT_SEC, offer expire
- d2 nhận offer tự động
- d2 accept thành công
- Ride status = DRIVER_ASSIGNED
- Ride driver_id = d2
- Offers table: d1=TIMEOUT, d2=ACCEPTED

---

## References

- [TESTING.md](../TESTING.md) - E2E testing guide
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - Debug guide
- [driver.html](../frontend/driver.html) - Driver dashboard
- [testbooking.html](../frontend/testbooking.html) - User booking UI
