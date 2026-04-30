# 📮 Hướng Dẫn Chạy Dự Án & Test API Trên Postman

> Tài liệu hướng dẫn chi tiết cách khởi động hệ thống và test toàn bộ API bằng Postman.

---

## Mục Lục

1. [Khởi động hệ thống](#1-khởi-động-hệ-thống)
2. [Cài đặt &amp; cấu hình Postman](#2-cài-đặt--cấu-hình-postman)
3. [Tạo Environment trong Postman](#3-tạo-environment-trong-postman)
4. [Test Auth Service (Xác thực)](#4-test-auth-service-xác-thực)
5. [Test Booking Service (Đặt xe)](#5-test-booking-service-đặt-xe)
6. [Test Driver Service (Tài xế)](#6-test-driver-service-tài-xế)
7. [Test Ride Service (Chuyến đi)](#7-test-ride-service-chuyến-đi)
8. [Test Pricing Service (Tính giá)](#8-test-pricing-service-tính-giá)
9. [Test Geo Service (Địa lý)](#9-test-geo-service-địa-lý)
10. [Test ETA Service (Dự đoán thời gian)](#10-test-eta-service-dự-đoán-thời-gian)
11. [Test Fraud Service (Phát hiện gian lận)](#11-test-fraud-service-phát-hiện-gian-lận)
12. [Test Agent Service (AI Agent)](#12-test-agent-service-ai-agent)
13. [Test Review Service (Đánh giá)](#13-test-review-service-đánh-giá)
14. [Test Payment Service (Thanh toán VNPay)](#14-test-payment-service-thanh-toán-vnpay)
15. [Test Notification Service (SSE)](#15-test-notification-service-sse)
16. [Test Full Flow (End-to-End)](#16-test-full-flow-end-to-end)
17. [Bảng tổng hợp tất cả Endpoints](#17-bảng-tổng-hợp-tất-cả-endpoints)

---

## 1. Khởi Động Hệ Thống

### Bước 1 — Chạy Docker Compose

```bash
cd Car-booking-backend-main

# Khởi động toàn bộ hệ thống (14 services + infrastructure)
docker compose -f docker-compose.dev.yml up -d
```

### Bước 2 — Đợi services sẵn sàng (~60 giây)

```bash
# Kiểm tra tất cả container đang chạy
docker compose -f docker-compose.dev.yml ps

# Kiểm tra API Gateway
curl http://localhost:8000/health
# → {"ok":true,"service":"api-gateway","upstreams":{...}}
```

### Bước 3 — Kiểm tra từng service

| Service     | Health Check URL                 | Kết quả mong đợi |
| ----------- | -------------------------------- | -------------------- |
| API Gateway | `http://localhost:8000/health` | `{"ok":true,"service":"api-gateway",...}`  |
| Auth        | `http://localhost:8001/health` | `{"ok":true,"service":"auth-service"}`  |
| Booking     | `http://localhost:8003/health` | `{"ok":true,...}`  |
| Driver      | `http://localhost:8004/health` | `{"ok":true,...}`  |
| Ride        | `http://localhost:8005/health` | `{"ok":true,...}`  |
| Pricing     | `http://localhost:8002/health` | `{"ok":true,...}`  |
| Geo         | `http://localhost:8007/health` | `{"ok":true,...}`  |
| ETA         | `http://localhost:8009/health` | `{"ok":true,...}`  |
| Fraud       | `http://localhost:8010/health` | `{"ok":true,...}`  |
| Agent       | `http://localhost:8012/health` | `{"ok":true,...}`  |

> **Lưu ý**: Tất cả API request đều đi qua **API Gateway (port 8000)**. Không cần gọi trực tiếp từng service.

---

## 2. Cài Đặt & Cấu Hình Postman

### Cài Postman

1. Tải Postman tại: [https://www.postman.com/downloads/](https://www.postman.com/downloads/)
2. Cài đặt và mở ứng dụng
3. Đăng nhập hoặc dùng **Lightweight API Client** (không cần tài khoản)

### Tạo Collection mới

1. Nhấn **New** → **Collection**
2. Đặt tên: `Car Booking System`
3. Tạo các folder con theo từng service:
   - `Auth`
   - `Booking`
   - `Driver`
   - `Ride`
   - `Pricing`
   - `Geo`
   - `ETA`
   - `Fraud`
   - `Agent`
   - `Review`
   - `Payment`
   - `Notification`

---

## 3. Tạo Environment Trong Postman

Vào **Environments** → **New Environment** → Đặt tên `Car Booking DEV`:

| Variable           | Initial Value                    | Mô tả                     |
| ------------------ | -------------------------------- | --------------------------- |
| `BASE_URL`       | `http://localhost:8000`        | API Gateway                 |
| `CUSTOMER_TOKEN` | _(trống, sẽ tự động set)_ | JWT token khách hàng      |
| `DRIVER_TOKEN`   | _(trống, sẽ tự động set)_ | JWT token tài xế          |
| `ADMIN_TOKEN`    | _(trống, sẽ tự động set)_ | JWT token admin             |
| `REFRESH_TOKEN`  | _(trống)_                     | Refresh token               |
| `BOOKING_ID`     | _(trống)_                     | ID booking mới nhất       |
| `RIDE_ID`        | _(trống)_                     | ID ride mới nhất          |
| `DRIVER_ID`      | `d1`                           | ID tài xế mặc định     |
| `USER_ID`        | `u1`                           | ID khách hàng mặc định |

**Chọn environment "Car Booking DEV"** ở góc trên bên phải Postman.

---

## 4. Test Auth Service (Xác Thực)

### 4.1 Đăng ký khách hàng

```
POST {{BASE_URL}}/auth/register
```

**Headers:**

| Key          | Value            |
| ------------ | ---------------- |
| Content-Type | application/json |

**Body (raw JSON):**

```json
{
  "identifier": "customer1@test.com",
  "password": "Test@123456",
  "role": "USER",
  "userId": "u1"
}
```

**Response mong đợi (201):**

```json
{
  "account": {
    "id": "...",
    "identifier": "customer1@test.com",
    "role": "USER",
    "status": "ACTIVE"
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "expiresIn": 86400
}
```

**Auto-save token** — Vào tab **Tests** của request, paste script:

```javascript
if (pm.response.code === 201) {
    var json = pm.response.json();
    pm.environment.set("CUSTOMER_TOKEN", json.accessToken);
    pm.environment.set("REFRESH_TOKEN", json.refreshToken);
}
```

---

### 4.2 Đăng ký tài xế

```
POST {{BASE_URL}}/auth/register
```

**Body:**

```json
{
  "identifier": "driver1@test.com",
  "password": "Test@123456",
  "role": "DRIVER",
  "driverId": "d1"
}
```

**Tests script:**

```javascript
if (pm.response.code === 201) {
    var json = pm.response.json();
    pm.environment.set("DRIVER_TOKEN", json.accessToken);
}
```

---

### 4.3 Đăng ký Admin

```
POST {{BASE_URL}}/auth/register
```

**Body:**

```json
{
  "identifier": "admin@test.com",
  "password": "Admin@123456",
  "role": "ADMIN"
}
```

**Tests script:**

```javascript
if (pm.response.code === 201) {
    var json = pm.response.json();
    pm.environment.set("ADMIN_TOKEN", json.accessToken);
}
```

---

### 4.4 Đăng nhập

```
POST {{BASE_URL}}/auth/login
```

**Body:**

```json
{
  "identifier": "customer1@test.com",
  "password": "Test@123456",
  "userId": "u1"
}
```

**Response (200):**

```json
{
  "account": { "id": "...", "identifier": "customer1@test.com", "role": "USER" },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "expiresIn": 86400
}
```

**Tests script:**

```javascript
if (pm.response.code === 200) {
    var json = pm.response.json();
    pm.environment.set("CUSTOMER_TOKEN", json.accessToken);
    pm.environment.set("REFRESH_TOKEN", json.refreshToken);
}
```

---

### 4.5 Refresh Token

```
POST {{BASE_URL}}/auth/refresh
```

**Body:**

```json
{
  "refreshToken": "{{REFRESH_TOKEN}}",
  "userId": "u1"
}
```

**Response (200):**

```json
{
  "accessToken": "new_jwt...",
  "refreshToken": "new_refresh...",
  "expiresIn": 86400
}
```

---

### 4.6 Xem thông tin tài khoản

```
GET {{BASE_URL}}/auth/me
```

**Headers:**

| Key           | Value                     |
| ------------- | ------------------------- |
| Authorization | Bearer {{CUSTOMER_TOKEN}} |

**Response (200):**

```json
{
  "account": { "id": "...", "identifier": "customer1@test.com", "role": "USER" },
  "auth": { "userId": "u1", "driverId": null }
}
```

---

### 4.7 Xem profile

```
GET {{BASE_URL}}/auth/profile
```

**Headers:**

| Key           | Value                     |
| ------------- | ------------------------- |
| Authorization | Bearer {{CUSTOMER_TOKEN}} |

---

### 4.8 Cập nhật profile

```
PUT {{BASE_URL}}/auth/profile
```

**Headers:**

| Key           | Value                     |
| ------------- | ------------------------- |
| Authorization | Bearer {{CUSTOMER_TOKEN}} |
| Content-Type  | application/json          |

**Body:**

```json
{
  "fullName": "Nguyen Van A",
  "phone": "0901234567"
}
```

---

### 4.9 Admin — Danh sách users

```
GET {{BASE_URL}}/auth/admin/users
```

**Headers:**

| Key           | Value                  |
| ------------- | ---------------------- |
| Authorization | Bearer {{ADMIN_TOKEN}} |

**Response (200):**

```json
{
  "users": [
    { "id": "...", "identifier": "customer1@test.com", "role": "USER", "full_name": "Nguyen Van A" }
  ]
}
```

---

### 4.10 Test lỗi — Đăng ký trùng

```
POST {{BASE_URL}}/auth/register
```

**Body:** (gửi lại body đăng ký customer giống lần đầu)

**Response mong đợi (409):**

```json
{
  "error": "Account already exists"
}
```

---

### 4.11 Test lỗi — Sai mật khẩu

```
POST {{BASE_URL}}/auth/login
```

**Body:**

```json
{
  "identifier": "customer1@test.com",
  "password": "wrong_password"
}
```

**Response mong đợi (401):**

```json
{
  "error": "Invalid credentials"
}
```

---

### 4.12 Test lỗi — Không có token

```
GET {{BASE_URL}}/auth/me
```

**Headers:** _(không gửi Authorization header)_

**Response mong đợi (401):**

```json
{
  "error": "Missing token"
}
```

---

### 4.13 Logout

```
POST {{BASE_URL}}/auth/logout
```

**Headers:**

| Key           | Value                     |
| ------------- | ------------------------- |
| Authorization | Bearer {{CUSTOMER_TOKEN}} |
| Content-Type  | application/json          |

**Body:**

```json
{
  "refreshToken": "{{REFRESH_TOKEN}}"
}
```

---

## 5. Test Booking Service (Đặt Xe)

> **Yêu cầu**: Đã đăng nhập lấy `CUSTOMER_TOKEN`.

### 5.1 Tạo booking mới

```
POST {{BASE_URL}}/bookings
```

**Headers:**

| Key               | Value                                      |
| ----------------- | ------------------------------------------ |
| Authorization     | Bearer {{CUSTOMER_TOKEN}}                  |
| Content-Type      | application/json                           |
| X-Idempotency-Key | _(tùy chọn, ví dụ: `booking-001`)_ |

**Body:**

```json
{
  "userId": "u1",
  "pickup": {
    "lat": 10.7769,
    "lng": 106.7009,
    "address": "Ben Thanh Market, District 1, HCMC"
  },
  "dropoff": {
    "lat": 10.8231,
    "lng": 106.6297,
    "address": "Tan Son Nhat Airport, Tan Binh, HCMC"
  },
  "vehicleType": "CAR_4",
  "paymentMethod": "CASH",
  "pricingSnapshot": {
    "fare": 150000,
    "distanceM": 8500,
    "durationS": 1200,
    "currency": "VND"
  }
}
```

**Response (200):**

```json
{
  "bookingId": "bk_abc123...",
  "status": "REQUESTED",
  "deduplicated": false
}
```

**Tests script (auto-save bookingId):**

```javascript
if (pm.response.code === 200) {
    var json = pm.response.json();
    pm.environment.set("BOOKING_ID", json.bookingId);
}
```

---

### 5.2 Xem booking theo ID

```
GET {{BASE_URL}}/bookings/{{BOOKING_ID}}
```

**Response (200):**

```json
{
  "id": "bk_abc123...",
  "user_id": "u1",
  "status": "REQUESTED",
  "payment_method": "CASH",
  "pickup_lat": 10.7769,
  "pickup_lng": 106.7009,
  "dropoff_lat": 10.8231,
  "dropoff_lng": 106.6297,
  "vehicle_type": "CAR_4",
  "fare": 150000,
  "currency": "VND"
}
```

---

### 5.3 Xem booking đang hoạt động

```
GET {{BASE_URL}}/bookings/me/active
```

**Headers:**

| Key           | Value                     |
| ------------- | ------------------------- |
| Authorization | Bearer {{CUSTOMER_TOKEN}} |

---

### 5.4 Xem lịch sử đặt xe

```
GET {{BASE_URL}}/bookings/me/history?limit=10
```

**Headers:**

| Key           | Value                     |
| ------------- | ------------------------- |
| Authorization | Bearer {{CUSTOMER_TOKEN}} |

---

### 5.5 Hủy booking

```
POST {{BASE_URL}}/bookings/{{BOOKING_ID}}/cancel
```

**Headers:**

| Key           | Value                     |
| ------------- | ------------------------- |
| Authorization | Bearer {{CUSTOMER_TOKEN}} |

---

### 5.6 Test lỗi — Thiếu trường bắt buộc

```
POST {{BASE_URL}}/bookings
```

**Body:**

```json
{
  "userId": "u1"
}
```

**Response mong đợi (400):**

```json
{
  "error": "pickup.lat is required"
}
```

---

### 5.7 Test lỗi — Tọa độ sai kiểu

```
POST {{BASE_URL}}/bookings
```

**Body:**

```json
{
  "userId": "u1",
  "pickup": { "lat": "abc", "lng": 106.70 },
  "dropoff": { "lat": 10.78, "lng": 106.71 },
  "vehicleType": "CAR_4",
  "paymentMethod": "CASH"
}
```

**Response mong đợi (422):**

```json
{
  "error": "pickup.lat must be a number"
}
```

---

### 5.8 Test lỗi — Payment method không hợp lệ

```
POST {{BASE_URL}}/bookings
```

**Body:**

```json
{
  "userId": "u1",
  "pickup": { "lat": 10.77, "lng": 106.70 },
  "dropoff": { "lat": 10.78, "lng": 106.71 },
  "vehicleType": "CAR_4",
  "paymentMethod": "BITCOIN"
}
```

**Response mong đợi (400):**

```json
{
  "error": "Invalid paymentMethod. Must be one of: CASH, VNPAY"
}
```

---

## 6. Test Driver Service (Tài Xế)

> **Yêu cầu**: Đã đăng nhập tài xế lấy `DRIVER_TOKEN`.

### 6.1 Cập nhật trạng thái ONLINE

```
POST {{BASE_URL}}/drivers/me/status
```

**Headers:**

| Key           | Value                   |
| ------------- | ----------------------- |
| Authorization | Bearer {{DRIVER_TOKEN}} |
| Content-Type  | application/json        |

**Body:**

```json
{
  "status": "ONLINE",
  "vehicleType": "CAR_4",
  "lat": 10.7769,
  "lng": 106.7009
}
```

**Response (200):**

```json
{
  "driverId": "d1",
  "status": "ONLINE",
  "vehicleType": "CAR_4",
  "ttlSec": 1800
}
```

---

### 6.2 Cập nhật vị trí GPS

```
POST {{BASE_URL}}/drivers/me/location
```

**Headers:**

| Key           | Value                   |
| ------------- | ----------------------- |
| Authorization | Bearer {{DRIVER_TOKEN}} |
| Content-Type  | application/json        |

**Body:**

```json
{
  "lat": 10.7785,
  "lng": 106.6990,
  "accuracyM": 5
}
```

**Response (200):**

```json
{
  "ok": true,
  "driverId": "d1",
  "vehicleType": "CAR_4",
  "state": "ONLINE",
  "stored": { "lat": 10.7785, "lng": 106.6990, "accuracyM": 5 }
}
```

---

### 6.3 Xem thông tin tài xế

```
GET {{BASE_URL}}/drivers/me
```

**Headers:**

| Key           | Value                   |
| ------------- | ----------------------- |
| Authorization | Bearer {{DRIVER_TOKEN}} |

---

### 6.4 Tìm tài xế gần đây

```
GET {{BASE_URL}}/drivers/nearby?lat=10.7769&lng=106.7009&radiusM=5000&vehicleType=CAR_4&limit=10
```

**Response (200):**

```json
{
  "drivers": [
    { "driverId": "d1", "distanceM": 200 }
  ]
}
```

---

### 6.5 Heartbeat (giữ trạng thái online)

```
POST {{BASE_URL}}/drivers/me/status
```

**Body:**

```json
{
  "status": "ONLINE"
}
```

> Gửi mỗi 30 giây để tài xế không bị timeout.

---

### 6.6 Chuyển sang OFFLINE

```
POST {{BASE_URL}}/drivers/me/status
```

**Body:**

```json
{
  "status": "OFFLINE"
}
```

---

## 7. Test Ride Service (Chuyến Đi)

> **Yêu cầu**: Tài xế đã ONLINE, khách đã tạo booking.

### 7.1 Xem chuyến đi hiện tại (khách)

```
GET {{BASE_URL}}/users/me/rides/current
```

**Headers:**

| Key           | Value                     |
| ------------- | ------------------------- |
| Authorization | Bearer {{CUSTOMER_TOKEN}} |

**Response (200):**

```json
{
  "type": "searching",
  "ride": {
    "id": "ride_123",
    "booking_id": "bk_abc...",
    "status": "OFFERING",
    "driver_id": "d1"
  }
}
```

**Tests script (auto-save rideId):**

```javascript
if (pm.response.code === 200) {
    var json = pm.response.json();
    if (json.ride && json.ride.id) {
        pm.environment.set("RIDE_ID", json.ride.id);
    }
}
```

---

### 7.2 Xem offer hiện tại (tài xế)

```
GET {{BASE_URL}}/drivers/me/rides/current
```

**Headers:**

| Key           | Value                   |
| ------------- | ----------------------- |
| Authorization | Bearer {{DRIVER_TOKEN}} |

**Response (200):**

```json
{
  "type": "offered",
  "ride": {
    "id": "ride_123",
    "status": "OFFERING",
    "pickup": { "lat": 10.7769, "lng": 106.7009 },
    "dropoff": { "lat": 10.8231, "lng": 106.6297 }
  }
}
```

---

### 7.3 Tài xế CHẤP NHẬN chuyến

```
POST {{BASE_URL}}/rides/{{RIDE_ID}}/driver/accept
```

**Headers:**

| Key           | Value                   |
| ------------- | ----------------------- |
| Authorization | Bearer {{DRIVER_TOKEN}} |

**Response (200):**

```json
{
  "ok": true,
  "rideId": "ride_123",
  "status": "DRIVER_ASSIGNED"
}
```

---

### 7.4 Tài xế TỪ CHỐI chuyến

```
POST {{BASE_URL}}/rides/{{RIDE_ID}}/driver/reject
```

**Headers:**

| Key           | Value                   |
| ------------- | ----------------------- |
| Authorization | Bearer {{DRIVER_TOKEN}} |

**Response (200):**

```json
{
  "ok": true
}
```

> Hệ thống sẽ tự động tìm tài xế khác.

---

### 7.5 Tài xế ĐÓN KHÁCH (Pickup)

```
POST {{BASE_URL}}/rides/{{RIDE_ID}}/driver/pickup
```

**Headers:**

| Key           | Value                   |
| ------------- | ----------------------- |
| Authorization | Bearer {{DRIVER_TOKEN}} |

**Response (200):**

```json
{
  "ok": true,
  "alreadyPickedUp": false
}
```

---

### 7.6 HOÀN THÀNH chuyến đi

```
POST {{BASE_URL}}/rides/{{RIDE_ID}}/complete
```

**Headers:**

| Key           | Value                   |
| ------------- | ----------------------- |
| Authorization | Bearer {{DRIVER_TOKEN}} |

**Response (200):**

```json
{
  "ok": true,
  "alreadyCompleted": false
}
```

---

### 7.7 Khách HỦY chuyến

```
POST {{BASE_URL}}/rides/{{RIDE_ID}}/user/cancel
```

**Headers:**

| Key           | Value                     |
| ------------- | ------------------------- |
| Authorization | Bearer {{CUSTOMER_TOKEN}} |

---

### 7.8 Lịch sử chuyến (tài xế)

```
GET {{BASE_URL}}/drivers/me/rides/history?limit=20
```

**Headers:**

| Key           | Value                   |
| ------------- | ----------------------- |
| Authorization | Bearer {{DRIVER_TOKEN}} |

---

## 8. Test Pricing Service (Tính Giá)

### 8.1 Tính giá chuyến đi

```
POST {{BASE_URL}}/pricing/estimate
```

**Headers:**

| Key          | Value            |
| ------------ | ---------------- |
| Content-Type | application/json |

**Body:**

```json
{
  "pickup": { "lat": 10.7769, "lng": 106.7009 },
  "dropoff": { "lat": 10.8231, "lng": 106.6297 },
  "vehicleType": "CAR_4"
}
```

**Response (200):**

```json
{
  "distanceM": 8500,
  "durationS": 1200,
  "fare": 150000,
  "currency": "VND",
  "breakdown": {
    "base": 12000,
    "perKm": 8000,
    "perMin": 0,
    "minFare": 25000,
    "surge": 1.0
  },
  "routeSource": "osrm",
  "surge_multiplier": 1.0
}
```

---

### 8.2 Cập nhật surge pricing

```
POST {{BASE_URL}}/pricing/surge
```

**Body:**

```json
{
  "zone": "district1",
  "demand_index": 2.0,
  "supply_index": 0.5
}
```

**Response (200):**

```json
{
  "zone": "district1",
  "surge_multiplier": 4.0,
  "demand_index": 2.0,
  "supply_index": 0.5
}
```

---

### 8.3 Xem surge hiện tại

```
GET {{BASE_URL}}/pricing/surge?zone=district1
```

---

## 9. Test Geo Service (Địa Lý)

### 9.1 Tìm kiếm địa chỉ (Autocomplete)

```
GET {{BASE_URL}}/geo/autocomplete?q=Ben Thanh&lat=10.77&lng=106.70
```

**Response (200):**

```json
{
  "suggestions": [
    {
      "placeId": "place_123...",
      "text": "Ben Thanh Market, District 1, Ho Chi Minh City",
      "location": { "lat": 10.7725, "lng": 106.6980 }
    }
  ]
}
```

---

### 9.2 Reverse Geocoding (Tọa độ → Địa chỉ)

```
GET {{BASE_URL}}/geo/reverse?lat=10.7769&lng=106.7009
```

**Response (200):**

```json
{
  "name": "Ben Thanh Market",
  "formattedAddress": "Le Loi, Ben Thanh, District 1, Ho Chi Minh City",
  "location": { "lat": 10.7769, "lng": 106.7009 }
}
```

---

### 9.3 Chi tiết địa điểm

```
GET {{BASE_URL}}/geo/place/{placeId}
```

---

## 10. Test ETA Service (Dự Đoán Thời Gian)

### 10.1 Dự đoán ETA

```
POST {{BASE_URL}}/eta/predict
```

**Headers:**

| Key          | Value            |
| ------------ | ---------------- |
| Content-Type | application/json |

**Body:**

```json
{
  "distance_km": 8.5,
  "traffic_level": 0.6,
  "pickup": { "lat": 10.7769, "lng": 106.7009 },
  "dropoff": { "lat": 10.8231, "lng": 106.6297 }
}
```

**Response (200):**

```json
{
  "eta": 18.5,
  "eta_seconds": 1110,
  "confidence": 0.82,
  "distance_km": 8.5,
  "model_version": "1.0.0-rule-based",
  "latency_ms": 12
}
```

---

### 10.2 Xem thông tin model

```
GET {{BASE_URL}}/eta/model-info
```

**Response (200):**

```json
{
  "model_version": "1.0.0-rule-based",
  "model_type": "rule-based",
  "features": ["distance_km", "traffic_level", "hour_of_day"],
  "fallback": "haversine"
}
```

---

### 10.3 Kiểm tra drift detection

```
GET {{BASE_URL}}/eta/drift
```

**Response (200):**

```json
{
  "drifted": false,
  "z_score": 0.25,
  "threshold": 2.0,
  "samples": 50
}
```

---

### 10.4 Forecast

```
GET {{BASE_URL}}/eta/forecast?zone=default&hour=18
```

---

### 10.5 Prometheus metrics

```
GET {{BASE_URL}}/eta/metrics
```

---

## 11. Test Fraud Service (Phát Hiện Gian Lận)

### 11.1 Kiểm tra gian lận

```
POST {{BASE_URL}}/fraud/check
```

**Body:**

```json
{
  "user_id": "u1",
  "driver_id": "d1",
  "booking_id": "bk_test1",
  "amount": 150000,
  "location": { "lat": 10.7769, "lng": 106.7009 },
  "device_fingerprint": "abc123xyz"
}
```

**Response (200):**

```json
{
  "fraud_score": 0.15,
  "flagged": false,
  "reasons": [],
  "threshold": 0.7,
  "booking_id": "bk_test1"
}
```

---

### 11.2 Test case gian lận (số tiền cao bất thường)

```
POST {{BASE_URL}}/fraud/check
```

**Body:**

```json
{
  "user_id": "u1",
  "driver_id": "d1",
  "booking_id": "bk_fraud_test",
  "amount": 99999999,
  "location": { "lat": 10.7769, "lng": 106.7009 }
}
```

> `fraud_score` sẽ cao hơn vì `amount` bất thường và thiếu `device_fingerprint`.

---

### 11.3 Xem fraud stats

```
GET {{BASE_URL}}/fraud/stats
```

---

## 12. Test Agent Service (AI Agent)

### 12.1 AI chọn tài xế

```
POST {{BASE_URL}}/agent/select-driver
```

**Body:**

```json
{
  "pickup": { "lat": 10.7769, "lng": 106.7009 },
  "dropoff": { "lat": 10.8231, "lng": 106.6297 },
  "vehicleType": "CAR_4",
  "bookingId": "bk_test",
  "userId": "u1"
}
```

**Response (200):**

```json
{
  "selected_driver": {
    "driver_id": "d1",
    "distance": 500,
    "rating": 4.5,
    "total_score": 0.85
  },
  "reason": "Driver selected via AI scoring",
  "context": {
    "available_drivers": [...],
    "tools_called": [
      { "tool": "driver_service", "success": true, "latency_ms": 25 },
      { "tool": "eta_service", "success": true, "latency_ms": 15 }
    ],
    "model_version": "agent-v1.2.0"
  }
}
```

> **Lưu ý**: Cần có ít nhất 1 tài xế ONLINE gần vị trí pickup.

---

### 12.2 Gọi tool trực tiếp

```
POST {{BASE_URL}}/agent/call-tool
```

**Body:**

```json
{
  "tool": "eta_service",
  "params": {
    "distance_km": 5.0,
    "traffic_level": 0.5
  }
}
```

---

### 12.3 Xem MCP context

```
GET {{BASE_URL}}/agent/context
```

---

### 12.4 Xem lịch sử quyết định

```
GET {{BASE_URL}}/agent/decisions
```

---

### 12.5 Xem model info

```
GET {{BASE_URL}}/agent/model-info
```

---

## 13. Test Review Service (Đánh Giá)

### 13.1 Tạo đánh giá

```
POST {{BASE_URL}}/reviews
```

**Body:**

```json
{
  "ride_id": "{{RIDE_ID}}",
  "reviewer_id": "u1",
  "reviewer_role": "USER",
  "reviewee_id": "d1",
  "rating": 5,
  "comment": "Tài xế lịch sự, đúng giờ!",
  "tip_amount": 20000
}
```

**Response (201):**

```json
{
  "review": {
    "id": 1,
    "ride_id": "ride_123",
    "rating": 5,
    "comment": "Tài xế lịch sự, đúng giờ!",
    "tip_amount": 20000
  }
}
```

---

### 13.2 Xem đánh giá theo user

```
GET {{BASE_URL}}/reviews/user/u1
```

---

### 13.3 Xem đánh giá theo ride

```
GET {{BASE_URL}}/reviews/ride/{{RIDE_ID}}
```

---

### 13.4 Xem rating trung bình tài xế

```
GET {{BASE_URL}}/reviews/driver/d1/average
```

**Response (200):**

```json
{
  "driver_id": "d1",
  "average_rating": 4.5,
  "total_reviews": 3
}
```

---

## 14. Test Payment Service (Thanh Toán VNPay)

### 14.1 Tạo link thanh toán VNPay

```
POST {{BASE_URL}}/payment/order/create_payment_url
```

**Body:**

```json
{
  "amount": 150000,
  "bankCode": "NCB",
  "orderDescription": "Thanh toan chuyen di taxi",
  "orderType": "other",
  "language": "vn"
}
```

**Response (200):**

```json
{
  "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...",
  "orderId": "08201500",
  "amount": 150000
}
```

> **Mở URL `paymentUrl` trong trình duyệt** để thanh toán sandbox.

---

### 14.2 Thẻ test VNPay Sandbox

| Thông tin                | Giá trị               |
| ------------------------- | ----------------------- |
| **Số thẻ**        | `9704198526191432198` |
| **Tên chủ thẻ**  | `NGUYEN VAN A`        |
| **Ngày hết hạn** | `07/15`               |
| **OTP**             | `123456`              |

---

### 14.3 Query kết quả thanh toán

```
POST {{BASE_URL}}/payment/order/querydr
```

**Body:**

```json
{
  "orderId": "{{BOOKING_ID}}",
  "transDate": "20260408"
}
```

---

### 14.4 Refund

```
POST {{BASE_URL}}/payment/order/refund
```

**Body:**

```json
{
  "orderId": "{{BOOKING_ID}}",
  "transDate": "20260408",
  "createDate": "20260408"
}
```

---

## 15. Test Notification Service (SSE)

> **Lưu ý**: SSE (Server-Sent Events) không test được trực tiếp bằng Postman thông thường. Dùng **cURL** hoặc **mở tab mới trong trình duyệt**.

### Cách 1: Dùng cURL (Terminal)

```bash
# Lắng nghe events cho khách hàng
curl -N "http://localhost:8000/notifications/stream?token=CUSTOMER_TOKEN_HERE"

# Lắng nghe events cho tài xế
curl -N "http://localhost:8000/notifications/stream?token=DRIVER_TOKEN_HERE"

# Legacy method (không cần JWT)
curl -N "http://localhost:8000/notifications/stream?role=USER&userId=u1"
curl -N "http://localhost:8000/notifications/stream?role=DRIVER&driverId=d1"
```

### Cách 2: Dùng trình duyệt

Mở URL sau trong trình duyệt:

```
http://localhost:8000/notifications/stream?role=USER&userId=u1
```

### Cách 3: Dùng Postman (chỉ xem response đầu tiên)

```
GET {{BASE_URL}}/notifications/stream?role=USER&userId=u1
```

> Postman sẽ hiển thị event `hello` ban đầu.

### Debug SSE connections

```
GET {{BASE_URL}}/notifications/debug
```

**Response (200):**

```json
{
  "users": { "u1": 1 },
  "drivers": { "d1": 1 }
}
```

---

## 16. Test Full Flow (End-to-End)

Thực hiện theo đúng thứ tự các bước dưới đây để test trọn vẹn một chuyến đi:

### Chuẩn bị

```
Bước 0a: Mở terminal, lắng nghe SSE cho khách:
  curl -N "http://localhost:8000/notifications/stream?role=USER&userId=u1"

Bước 0b: Mở terminal khác, lắng nghe SSE cho tài xế:
  curl -N "http://localhost:8000/notifications/stream?role=DRIVER&driverId=d1"
```

### Flow chính (trên Postman)

| Bước       | Request                                 | Mô tả                                      |
| ------------ | --------------------------------------- | -------------------------------------------- |
| **1**  | `POST /auth/register` (role: USER)    | Đăng ký khách → lưu `CUSTOMER_TOKEN` |
| **2**  | `POST /auth/register` (role: DRIVER)  | Đăng ký tài xế → lưu `DRIVER_TOKEN` |
| **3**  | `POST /drivers/me/status` (ONLINE)    | Tài xế lên tuyến                         |
| **4**  | `POST /drivers/me/location`           | Cập nhật GPS tài xế                      |
| **5**  | `POST /pricing/estimate`              | Khách tính giá trước                    |
| **6**  | `POST /bookings`                      | Khách đặt xe → lưu `BOOKING_ID`       |
| **7**  | _(đợi 2-3s)_                        | Hệ thống tìm tài xế, tạo ride          |
| **8**  | `GET /drivers/me/rides/current`       | Tài xế xem offer → lưu `RIDE_ID`       |
| **9**  | `POST /rides/{RIDE_ID}/driver/accept` | Tài xế nhận chuyến                       |
| **10** | `GET /users/me/rides/current`         | Khách xem trạng thái (DRIVER_ASSIGNED)    |
| **11** | `POST /rides/{RIDE_ID}/driver/pickup` | Tài xế đón khách                        |
| **12** | `POST /rides/{RIDE_ID}/complete`      | Tài xế hoàn thành chuyến                |
| **13** | `POST /reviews`                       | Khách đánh giá tài xế ⭐⭐⭐⭐⭐       |
| **14** | `GET /bookings/me/history`            | Khách xem lịch sử                         |
| **15** | `GET /drivers/me/rides/history`       | Tài xế xem lịch sử                       |

### Kiểm tra trên SSE

Trong terminal SSE của khách, bạn sẽ thấy các events:

```
data: {"eventType":"RIDE_OFFERED_TO_DRIVER","ride_id":"..."}
data: {"eventType":"RIDE_ACCEPTED","ride_id":"..."}
data: {"eventType":"PASSENGER_PICKED_UP","ride_id":"..."}
data: {"eventType":"RIDE_COMPLETED","ride_id":"...","fare":150000}
```

---

## 17. Bảng Tổng Hợp Tất Cả Endpoints

### Auth Service

| Method | Endpoint              | Auth     | Mô tả                |
| ------ | --------------------- | -------- | ---------------------- |
| POST   | `/auth/register`    | ❌       | Đăng ký tài khoản |
| POST   | `/auth/login`       | ❌       | Đăng nhập           |
| POST   | `/auth/refresh`     | ❌       | Refresh token          |
| POST   | `/auth/logout`      | ✅       | Đăng xuất           |
| GET    | `/auth/me`          | ✅       | Thông tin tài khoản |
| GET    | `/auth/profile`     | ✅       | Xem profile            |
| PUT    | `/auth/profile`     | ✅       | Cập nhật profile     |
| GET    | `/auth/admin/users` | ✅ ADMIN | Danh sách all users   |

### Booking Service

| Method | Endpoint                 | Auth | Mô tả                    |
| ------ | ------------------------ | ---- | -------------------------- |
| POST   | `/bookings`            | ✅   | Tạo booking               |
| GET    | `/bookings/:id`        | ❌   | Xem booking                |
| GET    | `/bookings/me/active`  | ✅   | Booking đang hoạt động |
| GET    | `/bookings/me/history` | ✅   | Lịch sử booking          |
| POST   | `/bookings/:id/cancel` | ✅   | Hủy booking               |

### Driver Service

| Method | Endpoint                 | Auth      | Mô tả                 |
| ------ | ------------------------ | --------- | ----------------------- |
| GET    | `/drivers/me`          | ✅ DRIVER | Thông tin tài xế     |
| POST   | `/drivers/me/status`   | ✅ DRIVER | Cập nhật trạng thái |
| POST   | `/drivers/me/location` | ✅ DRIVER | Cập nhật GPS          |
| GET    | `/drivers/nearby`      | ❌        | Tìm tài xế gần      |

### Ride Service

| Method | Endpoint                      | Auth      | Mô tả                       |
| ------ | ----------------------------- | --------- | ----------------------------- |
| GET    | `/users/me/rides/current`   | ✅ USER   | Chuyến hiện tại (khách)   |
| GET    | `/drivers/me/rides/current` | ✅ DRIVER | Chuyến hiện tại (tài xế) |
| GET    | `/drivers/me/rides/history` | ✅ DRIVER | Lịch sử chuyến             |
| POST   | `/rides/:id/driver/accept`  | ✅ DRIVER | Nhận chuyến                 |
| POST   | `/rides/:id/driver/reject`  | ✅ DRIVER | Từ chối chuyến             |
| POST   | `/rides/:id/driver/pickup`  | ✅ DRIVER | Đón khách                  |
| POST   | `/rides/:id/complete`       | ✅ DRIVER | Hoàn thành                  |
| POST   | `/rides/:id/user/cancel`    | ✅ USER   | Hủy chuyến                  |

### Pricing Service

| Method | Endpoint              | Auth | Mô tả    |
| ------ | --------------------- | ---- | ---------- |
| POST   | `/pricing/estimate` | ❌   | Tính giá |
| POST   | `/pricing/surge`    | ❌   | Set surge  |
| GET    | `/pricing/surge`    | ❌   | Xem surge  |

### Geo Service

| Method | Endpoint                         | Auth | Mô tả                 |
| ------ | -------------------------------- | ---- | ----------------------- |
| GET    | `/geo/autocomplete?q=...`      | ❌   | Tìm địa chỉ         |
| GET    | `/geo/reverse?lat=...&lng=...` | ❌   | Tọa độ → Địa chỉ |
| GET    | `/geo/place/:placeId`          | ❌   | Chi tiết địa điểm  |

### ETA Service

| Method | Endpoint            | Auth | Mô tả            |
| ------ | ------------------- | ---- | ------------------ |
| POST   | `/eta/predict`    | ❌   | Dự đoán ETA     |
| GET    | `/eta/forecast`   | ❌   | Forecast           |
| GET    | `/eta/model-info` | ❌   | Thông tin model   |
| GET    | `/eta/drift`      | ❌   | Drift detection    |
| GET    | `/eta/metrics`    | ❌   | Prometheus metrics |

### Fraud Service

| Method | Endpoint         | Auth | Mô tả             |
| ------ | ---------------- | ---- | ------------------- |
| POST   | `/fraud/check` | ❌   | Kiểm tra gian lận |
| GET    | `/fraud/stats` | ❌   | Thống kê          |

### Agent Service

| Method | Endpoint                 | Auth | Mô tả                 |
| ------ | ------------------------ | ---- | ----------------------- |
| POST   | `/agent/select-driver` | ❌   | AI chọn tài xế       |
| POST   | `/agent/call-tool`     | ❌   | Gọi tool               |
| GET    | `/agent/context`       | ❌   | MCP context             |
| GET    | `/agent/decisions`     | ❌   | Lịch sử quyết định |
| GET    | `/agent/model-info`    | ❌   | Model info              |

### Review Service

| Method | Endpoint                        | Auth | Mô tả               |
| ------ | ------------------------------- | ---- | --------------------- |
| POST   | `/reviews`                    | ❌   | Tạo đánh giá      |
| GET    | `/reviews/user/:userId`       | ❌   | Đánh giá theo user |
| GET    | `/reviews/ride/:rideId`       | ❌   | Đánh giá theo ride |
| GET    | `/reviews/driver/:id/average` | ❌   | Rating TB tài xế    |

### Payment Service (qua Gateway: `/payment/...`)

| Method | Endpoint                              | Auth | Mô tả                  |
| ------ | ------------------------------------- | ---- | ------------------------ |
| POST   | `/payment/order/create_payment_url` | ❌   | Tạo link VNPay          |
| GET    | `/payment/order/vnpay_return`       | ❌   | VNPay callback (browser) |
| GET    | `/payment/order/vnpay_ipn`          | ❌   | VNPay IPN (server)       |
| POST   | `/payment/order/querydr`            | ❌   | Query thanh toán        |
| POST   | `/payment/order/refund`             | ❌   | Hoàn tiền              |

### Notification Service

| Method | Endpoint                  | Auth                  | Mô tả           |
| ------ | ------------------------- | --------------------- | ----------------- |
| GET    | `/notifications/stream` | ✅ hoặc query params | SSE stream        |
| GET    | `/notifications/debug`  | ❌                    | Debug connections |

### System Endpoints

| Method | Endpoint     | Mô tả            |
| ------ | ------------ | ------------------ |
| GET    | `/health`  | API Gateway health |
| GET    | `/metrics` | Prometheus metrics |

---

> **Tip**: Import file này vào Postman bằng cách tạo từng request theo hướng dẫn trên, hoặc dùng **Postman Collection Runner** để chạy Full Flow (Bước 1-15) tự động.
