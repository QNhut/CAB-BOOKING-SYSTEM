## ✅ BOOKING → DRIVER MATCH TEST PASSED!

### 📊 Test Results:

**Driver Setup:**
- ✅ Driver ID: `d1`
- ✅ Status: `ONLINE`
- ✅ Vehicle Type: `CAR_4`
- ✅ Location: `10.762622, 106.660172`
- ✅ In Redis GEO set: YES

**Nearby Query:**
- ✅ Found 1 driver: `d1` (distance: 0m)

**Booking:**
- ✅ Booking ID: `9ffa617e-20f4-4f8e-8257-c53ab4d6c6c3`
- ✅ User ID: `u1`
- ✅ Vehicle Type: `CAR_4`
- ✅ Status: `DRIVER_ASSIGNED`

**Ride:**
- ✅ Ride ID: `ad55ef97-03e7-4dd1-b235-096f40d224fa`
- ✅ Driver ID: `d1`
- ✅ Status: `DRIVER_ASSIGNED`

**Flow:**
```
BOOKING_CREATED
    ↓
BOOKING_MATCH_REQUESTED
    ↓
Query Nearby Drivers → Found d1
    ↓
Set Driver d1 BUSY
    ↓
Offer Ride to d1
    ↓
Driver d1 Auto-Accepted
    ↓
Status: DRIVER_ASSIGNED ✅
```

---

## 🔍 Nếu bạn gặp lỗi "không match được driver":

### Checklist 1: Driver Setup

**Kiểm tra driver có ONLINE không:**
```powershell
docker exec -it taxi_redis redis-cli GET "driver:state:d1"
```
→ Phải trả về: `"ONLINE"`

**Kiểm tra vehicleType:**
```powershell
docker exec -it taxi_redis redis-cli GET "driver:vehicle:d1"
```
→ Phải trả về: `"CAR_4"` hoặc `"CAR_7"`

**Kiểm tra driver trong GEO set:**
```powershell
docker exec -it taxi_redis redis-cli ZRANGE "geo:drivers:CAR_4" 0 -1
```
→ Phải thấy driver ID trong list

---

### Checklist 2: VehicleType Matching

**❌ LỖI THƯỜNG GẶP:**
```javascript
// Driver.html dùng: SEDAN
// Testbooking.html dùng: CAR_4
// → KHÔNG KHỚP!
```

**✅ ĐÚNG:**
```javascript
// Driver: CAR_4
// Booking: CAR_4
// → KHỚP!
```

**Quy tắc:**
- `CAR_4` match `CAR_4`
- `CAR_7` match `CAR_7`
- `SEDAN` ≠ `CAR_4` (khác nhau!)
- `SUV` ≠ `CAR_7` (khác nhau!)

---

### Checklist 3: Nearby Query

**Test xem có driver gần không:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8004/drivers/nearby?lat=10.762622&lng=106.660172&radiusM=3000&vehicleType=CAR_4&limit=10" | ConvertTo-Json -Depth 5
```

**Nếu trả về empty array:**
- ❌ Driver không online
- ❌ VehicleType sai
- ❌ Khoảng cách > 3000m
- ❌ Driver state = BUSY

---

### Checklist 4: Browser HTML Setup

**driver.html:**
```
1. Driver ID: d1
2. Loại xe: CAR_4 ← QUAN TRỌNG!
3. Click "✅ Áp dụng"
4. Nhập tọa độ
5. Click "📡 Cập nhật vị trí"
6. Click "🔌 Kết nối SSE"
```

**testbooking.html:**
```
1. User ID: u1
2. Pickup: 10.762622, 106.660172
3. Dropoff: 10.771928, 106.698229
4. Loại xe: CAR_4 ← PHẢI KHỚP với driver!
5. Click "Bước 1: Tính giá"
6. Click "Bước 2: Đặt xe"
```

---

### Checklist 5: Services Running

**Check tất cả services đang chạy:**
```powershell
docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String "taxi_"
```

**Phải thấy:**
- ✅ taxi_booking_dev (Up)
- ✅ taxi_booking_worker_dev (Up)
- ✅ taxi_ride_dev (Up)
- ✅ taxi_driver_dev (Up)
- ✅ taxi_notification_dev (Up)
- ✅ taxi_kafka (Up, healthy)
- ✅ taxi_redis (Up, healthy)
- ✅ taxi_postgres (Up, healthy)

**Nếu service down:**
```powershell
docker compose -f docker-compose.dev.yml up -d
```

---

### Checklist 6: Kafka Events Flow

**Xem events trong Kafka:**
```powershell
docker exec -it taxi_kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:9092 --topic taxi.events --from-beginning --max-messages 10
```

**Phải thấy theo thứ tự:**
1. `BOOKING_CREATED`
2. `BOOKING_MATCH_REQUESTED`
3. `RIDE_OFFERED_TO_DRIVER`
4. `RIDE_ACCEPTED`

**Nếu không thấy RIDE_OFFERED_TO_DRIVER:**
→ ride-service không tìm thấy driver nearby
→ Check lại vehicleType matching!

---

### Checklist 7: Driver BUSY Issue

**Nếu driver vừa accept chuyến khác:**
```powershell
# Check driver state
docker exec -it taxi_redis redis-cli GET "driver:state:d1"
```

**Nếu trả về `"BUSY"`:**
- Driver đang trong chuyến
- Phải complete chuyến cũ trước
- Hoặc dùng driver khác

**Complete chuyến cũ:**
```powershell
# Tìm ride ID đang active
docker exec -it taxi_postgres psql -U taxi -d ride_db -c "SELECT id, status FROM rides WHERE driver_id='d1' AND status='DRIVER_ASSIGNED';"

# Complete ride đó
Invoke-RestMethod -Uri "http://localhost:8005/rides/<rideId>/complete" -Method POST -Headers @{"x-driver-id"="d1"}
```

---

## 🚀 Quick Fix: Reset Everything

**Nếu mọi thứ rối, reset lại:**

```powershell
# 1. Clear Redis (xóa tất cả driver state)
docker exec -it taxi_redis redis-cli FLUSHALL

# 2. Restart services
docker compose -f docker-compose.dev.yml restart booking-service booking-worker ride-service driver-service

# 3. Setup driver lại
powershell -ExecutionPolicy Bypass -File .\scripts\test-booking-flow.ps1
```

---

## 📱 Test với UI

**Sau khi reset, test bằng HTML:**

1. **Mở driver.html:**
   - Driver ID: `d1`
   - Loại xe: **CAR_4**
   - Tọa độ: `10.762622`, `106.660172`
   - Áp dụng → Cập nhật vị trí → Kết nối SSE

2. **Mở testbooking.html:**
   - User ID: `u1`
   - Pickup: `10.762622`, `106.660172`
   - Dropoff: `10.771928`, `106.698229`
   - Loại xe: **CAR_4**
   - Tính giá → Đặt xe

3. **Trong driver.html, click Accept:**
   - Sẽ thấy "Current Ride" card
   - Click "✅ Accept"
   - Status → DRIVER_ASSIGNED

---

## ✅ Expected Success

**Driver tab:**
- "🚗 RIDE OFFER" trong Event Log
- "Current Ride" card hiển thị
- Click Accept → Status: ACCEPTED
- Notification: "✅ Bạn đã nhận chuyến đi!"

**User tab:**
- "✅ Đơn đặt xe đã được tạo!"
- "🔍 Đang tìm tài xế gần bạn..."
- "🚗 Tài xế d1 đã nhận chuyến!"
- Status: DRIVER_ASSIGNED

---

**Nếu vẫn không được, paste log từ:**
1. `docker logs taxi_ride_dev --tail 50`
2. Driver.html Debug Info
3. Booking ID + Vehicle Type đang test
