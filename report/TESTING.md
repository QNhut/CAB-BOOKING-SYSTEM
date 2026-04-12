# 🧪 E2E Testing Guide - Car Booking System

## 📋 Bước 16: Test End-to-End + Khóa chặt các case hay gãy

---

## 16.1 E2E Test "Happy Path" (Booking → Match → Offer → Accept → Complete)

### A) Mở log Kafka events (để thấy chuỗi event)

**Terminal 1 - Kafka Consumer:**
```powershell
docker exec -it taxi_kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:9092 --topic taxi.events --property print.key=true --property print.timestamp=true
```

> 💡 Nếu topic có nhiều event cũ, bỏ `--from-beginning` để chỉ xem event mới

---

### B) Chuẩn bị Driver (Tab 1: driver.html)

**Mở:** `file:///C:/Users/Levinh/Desktop/car-booking/frontend/driver.html`

1. **Cấu hình Driver:**
   - Driver ID: `d1`
   - Loại xe: `CAR_4`
   - Click **"✅ Áp dụng"**

2. **Cập nhật vị trí:**
   - Latitude: `10.762622`
   - Longitude: `106.660172`
   - Click **"📡 Cập nhật vị trí"**

3. **Kết nối SSE:**
   - Click **"🔌 Kết nối SSE"**

**✅ Expected:**
- SSE status: "✅ SSE đã kết nối thành công!"
- Event Log: "SSE connected successfully"
- Debug Info: `status: "ONLINE"`, `vehicleType: "CAR_4"`

---

### C) User đặt xe (Tab 2: testbooking.html)

**Mở:** `file:///C:/Users/Levinh/Desktop/car-booking/frontend/testbooking.html`

1. **Cấu hình:**
   - User ID: `u1` (đã mặc định)
   - Pickup: `10.762622`, `106.660172` (gần driver d1)
   - Dropoff: `10.771928`, `106.698229`
   - Loại xe: `CAR_4`
   - Thanh toán: `CASH`

2. **Tạo booking:**
   - Click **"Bước 1: Tính giá"**
   - Click **"Bước 2: Đặt xe ngay"**

**✅ Expected (User Tab):**
- Notification area:
  1. "✅ Đơn đặt xe đã được tạo!"
  2. "🔍 Đang tìm tài xế gần bạn..."
- Booking ID: `<uuid>`
- Trạng thái: `PAID`

**✅ Expected (Driver Tab):**
- "Current Ride" card xuất hiện
- Ride ID, Booking ID hiển thị
- Trạng thái: `OFFERED`
- Buttons: **Accept**, **Reject**
- Event Log: "🚗 RIDE OFFER"

**✅ Expected (Kafka Terminal):**
Chuỗi events theo thứ tự:
```json
1. BOOKING_CREATED { userId: "u1", bookingId, status: "PAID" }
2. BOOKING_MATCH_REQUESTED { userId: "u1", bookingId, pickup, vehicleType }
3. RIDE_OFFERED_TO_DRIVER { driverId: "d1", rideId, bookingId }
```

---

### D) Driver Accept Ride

**Trong driver.html (Tab 1):**
- Click **"✅ Accept"**

**✅ Expected (Driver Tab):**
- Trạng thái: `ACCEPTED`
- Buttons: Chỉ còn **"🏁 Complete Ride"**
- Event Log: "✅ RIDE ACCEPTED"
- Notification: "✅ Bạn đã nhận chuyến đi!"

**✅ Expected (User Tab):**
- Notification: "🚗 Tài xế d1 đã nhận chuyến!"
- Trạng thái: `DRIVER_ASSIGNED`
- Driver ID: `d1`

**✅ Expected (Kafka):**
```json
4. RIDE_ACCEPTED { rideId, bookingId, driverId: "d1", userId: "u1" }
```

**✅ Expected (Driver State):**
- Driver d1 state → `BUSY`
- Driver d1 không xuất hiện trong nearby query

**Verify driver BUSY:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8004/drivers/nearby?lat=10.762622&lng=106.660172&radiusM=3000&vehicleType=CAR_4&limit=10" | ConvertTo-Json -Depth 5
```
→ Should return empty drivers array

---

### E) Complete Ride

**Trong driver.html (Tab 1):**
- Click **"🏁 Complete Ride"**

**✅ Expected (Driver Tab):**
- "Current Ride" card ẩn đi
- Notification: "🏁 Chuyến đi đã hoàn thành!"
- Event Log: "🏁 RIDE COMPLETED"
- Status badge: `ONLINE` (trở lại)

**✅ Expected (User Tab):**
- Notification: "🏁 Chuyến đi hoàn thành!"
- Trạng thái: `COMPLETED`

**✅ Expected (Kafka):**
```json
5. RIDE_COMPLETED { rideId, bookingId, driverId: "d1", userId: "u1" }
```

**✅ Expected (Driver State):**
- Driver d1 state → `ONLINE`
- Driver d1 xuất hiện lại trong nearby query

**Verify driver ONLINE:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8004/drivers/nearby?lat=10.762622&lng=106.660172&radiusM=3000&vehicleType=CAR_4&limit=10" | ConvertTo-Json -Depth 5
```
→ Should return driver d1

---

## 16.2 ✅ COMPLETED: Chuẩn hoá UI test

**Driver.html đã có:**
- ✅ Accept button (manual accept, không auto)
- ✅ Reject button
- ✅ Complete button
- ✅ Current Ride display
- ✅ Real-time state updates via SSE

---

## 16.3 5 lỗi hay gãy nhất (và cách check cực nhanh)

### 1️⃣ Driver không nhận ride_offer

**Symptoms:**
- Driver SSE connected nhưng không thấy ride offer
- User đã create booking thành công

**Check nhanh:**
```powershell
# Check notification-service logs
docker logs taxi_notification_dev --tail 50

# Check ride-service logs
docker logs taxi_ride_dev --tail 50

# Check Kafka consumer group
docker exec -it taxi_kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --group notification-service
```

**Common causes:**
- ❌ eventType không đúng: `RIDE_OFFERED_TO_DRIVER` (case-sensitive)
- ❌ payload thiếu `driverId`
- ❌ notification-service consumer group không chạy
- ❌ SSE connection bị disconnect

**Fix:**
- Verify event payload trong Kafka console
- Restart notification-service: `docker compose -f docker-compose.dev.yml restart notification-service`

---

### 2️⃣ User không nhận ride_accepted

**Symptoms:**
- Driver accept thành công
- User SSE connected nhưng không nhận event

**Check nhanh:**
```powershell
# Check booking có userId không
Invoke-RestMethod -Uri "http://localhost:8003/bookings/<bookingId>"
```

**Common causes:**
- ❌ RIDE_ACCEPTED payload thiếu `userId`
- ❌ userId không khớp (booking có "u1" nhưng SSE connect với "u2")
- ❌ notification-service không route RIDE_ACCEPTED cho user

**Fix:**
- Verify payload có `userId` trong Kafka
- Verify testbooking.html connect SSE với đúng userId
- Check notification-service routing logic

---

### 3️⃣ Driver BUSY nhưng vẫn bị offer tiếp

**Symptoms:**
- Driver d1 accept ride
- Booking mới vẫn offer cho d1

**Check nhanh:**
```powershell
# Check driver state
docker exec -it taxi_redis redis-cli GET driver:state:d1

# Check nearby drivers
Invoke-RestMethod -Uri "http://localhost:8004/drivers/nearby?lat=10.762622&lng=106.660172&radiusM=3000&vehicleType=CAR_4&limit=10" | ConvertTo-Json -Depth 5
```

**Common causes:**
- ❌ Ride accept không gọi driver internal set BUSY
- ❌ Driver service không remove BUSY driver khỏi GEO set
- ❌ Nearby query không filter state

**Fix:**
- Verify ride-service gọi `POST /internal/drivers/:driverId/state` với `state: "BUSY"`
- Verify driver-service remove driver khỏi GEO khi BUSY
- Check driver-service nearby logic

---

### 4️⃣ SSE bị "đứng" / không update

**Symptoms:**
- SSE status: connected
- Nhưng không nhận event mới

**Check nhanh:**
```javascript
// Trong browser console
console.log('EventSource readyState:', eventSource.readyState);
// 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
```

**Common causes:**
- ❌ Heartbeat ping không chạy
- ❌ Network timeout (proxy/nginx buffering)
- ❌ Browser tab inactive (Chrome throttling)

**Fix:**
- Verify heartbeat ping mỗi 15s trong Network tab
- Add `X-Accel-Buffering: no` nếu dùng nginx
- Keep browser tab active

---

### 5️⃣ Duplicate accept / duplicate events

**Symptoms:**
- Accept button bấm nhiều lần → nhiều accept calls
- Kafka consumer xử lý cùng 1 event nhiều lần

**Check nhanh:**
```powershell
# Check processed_events table
docker exec -it taxi_postgres psql -U taxi -d ride_db -c "SELECT * FROM processed_events ORDER BY created_at DESC LIMIT 10;"
```

**Common causes:**
- ❌ Accept button không disable sau click
- ❌ Ride consumer không có idempotency (processed_events)
- ❌ Kafka at-least-once delivery

**Fix:**
- ✅ Driver.html: Buttons tự disable sau click (via SSE state update)
- ✅ Ride-service: Already has `processed_events` idempotency
- ✅ Notification-service: Read-only consumer, no side effects

---

## 16.4 Bước 17: Test "Reject + Timeout + Vòng offer"

### Setup: 2 Drivers Online

**Terminal 2 - Setup Driver d2:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8004/drivers/me/status" -Method POST -Headers @{"Content-Type"="application/json"; "x-driver-id"="d2"} -Body (@{status="ONLINE"; vehicleType="CAR_4"} | ConvertTo-Json)

Invoke-RestMethod -Uri "http://localhost:8004/drivers/me/location" -Method POST -Headers @{"Content-Type"="application/json"; "x-driver-id"="d2"} -Body (@{lat=10.763; lng=106.661} | ConvertTo-Json)
```

**Or open another driver.html tab:**
- Driver ID: `d2`
- Loại xe: `CAR_4`
- Location: `10.763`, `106.661`
- Connect SSE

---

### Test Scenario: Reject

1. **Create booking** (testbooking.html)
2. **Driver d1** nhận offer → Click **"❌ Reject"**
3. **Expected:**
   - d1: "Current Ride" card ẩn đi
   - d2: Nhận ride offer tiếp theo (sequential offering)
   - Kafka: `RIDE_OFFERED_TO_DRIVER(d1)` → reject → `RIDE_OFFERED_TO_DRIVER(d2)`

---

### Test Scenario: Timeout

1. **Create booking**
2. **Driver d1** nhận offer → **Không làm gì** (chờ 10s)
3. **Expected:**
   - After 10s: Offer timeout
   - d2: Nhận ride offer
   - Kafka: `RIDE_OFFERED_TO_DRIVER(d1)` → timeout → `RIDE_OFFERED_TO_DRIVER(d2)`

**Verify timeout:**
```powershell
# Check ride-service logs
docker logs taxi_ride_dev --tail 50 | Select-String "timeout"
```

---

## 🎯 Checklist Hoàn Thành

### ✅ Happy Path
- [ ] Driver d1 online với CAR_4
- [ ] User create booking với CAR_4
- [ ] Driver nhận ride_offer qua SSE
- [ ] Driver click Accept → nhận ride_accepted
- [ ] User nhận ride_accepted qua SSE
- [ ] Driver state → BUSY
- [ ] Driver biến mất khỏi nearby
- [ ] Driver click Complete
- [ ] Driver state → ONLINE
- [ ] Driver xuất hiện lại trong nearby
- [ ] User nhận ride_completed

### ✅ Kafka Event Flow
- [ ] BOOKING_CREATED với userId
- [ ] BOOKING_MATCH_REQUESTED với userId
- [ ] RIDE_OFFERED_TO_DRIVER với driverId
- [ ] RIDE_ACCEPTED với userId + driverId
- [ ] RIDE_COMPLETED với userId + driverId

### ✅ UI Manual Control
- [ ] driver.html: Accept button works
- [ ] driver.html: Reject button works
- [ ] driver.html: Complete button works
- [ ] testbooking.html: SSE updates realtime
- [ ] No auto-accept (manual control only)

### 🔄 Advanced Tests
- [ ] Reject → Sequential offer to d2
- [ ] Timeout → Auto offer to d2
- [ ] Multiple bookings → Concurrent handling
- [ ] Driver BUSY → Not in nearby
- [ ] Driver OFFLINE → Not in nearby

---

## 🐛 Debug Commands

### Check Driver State
```powershell
docker exec -it taxi_redis redis-cli GET "driver:state:d1"
```

### Check Driver Vehicle Type
```powershell
docker exec -it taxi_redis redis-cli GET "driver:vehicle:d1"
```

### Check Geo Drivers (CAR_4)
```powershell
docker exec -it taxi_redis redis-cli ZRANGE "geo:drivers:CAR_4" 0 -1
```

### Check Ride Table
```powershell
docker exec -it taxi_postgres psql -U taxi -d ride_db -c "SELECT id, booking_id, driver_id, status, candidate_index, offer_expires_at FROM rides ORDER BY created_at DESC LIMIT 5;"
```

### Check Booking Table
```powershell
docker exec -it taxi_postgres psql -U taxi -d taxi_main -c "SELECT id, user_id, status, vehicle_type FROM bookings ORDER BY created_at DESC LIMIT 5;"
```

### Clear Redis (Reset All Drivers)
```powershell
docker exec -it taxi_redis redis-cli FLUSHALL
```

---

## 📊 Expected Kafka Event Timeline

```
00:00 | BOOKING_CREATED          | userId: u1, bookingId, status: PAID
00:01 | BOOKING_MATCH_REQUESTED  | userId: u1, bookingId, vehicleType: CAR_4
00:02 | RIDE_OFFERED_TO_DRIVER   | driverId: d1, rideId, bookingId
00:05 | RIDE_ACCEPTED            | driverId: d1, userId: u1, rideId, bookingId
      |                          | → Driver state: BUSY
00:30 | RIDE_COMPLETED           | driverId: d1, userId: u1, rideId, bookingId
      |                          | → Driver state: ONLINE
```

---

## 🎓 Next Steps After E2E

1. **Payment Flow:** Add VNPAY payment testing
2. **Booking Updates:** Test booking status changes (CANCELLED, etc.)
3. **Driver Offline:** Test driver going offline mid-ride
4. **Location Updates:** Test driver location tracking during ride
5. **Multiple Users:** Test concurrent bookings

---

**Good luck testing! 🚀**
