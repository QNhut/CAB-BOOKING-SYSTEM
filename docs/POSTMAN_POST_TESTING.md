# 📮 Hướng Dẫn Test Toàn Bộ POST Endpoints Trên Postman

> **Base URL**: `http://localhost:8000` (API Gateway)  
> **Tổng số POST endpoints**: 31 trên 9 services  
> **Ngày cập nhật**: 27-04-2026

---

## Mục Lục

1. [Chuẩn bị trước khi test](#1-chuẩn-bị-trước-khi-test)
2. [Auth Service — 5 POST](#2-auth-service--5-post)
3. [Booking Service — 3 POST](#3-booking-service--3-post)
4. [Pricing Service — 3 POST](#4-pricing-service--3-post)
5. [Fraud Service — 2 POST](#5-fraud-service--2-post)
6. [Driver Service — 3 POST](#6-driver-service--3-post)
7. [Ride Service — 5 POST](#7-ride-service--5-post)
8. [ETA Service — 3 POST](#8-eta-service--3-post)
9. [Agent Service — 5 POST](#9-agent-service--5-post)
10. [Review Service — 1 POST](#10-review-service--1-post)
11. [Thứ tự chạy End-to-End](#11-thứ-tự-chạy-end-to-end)

---

## 1. Chuẩn Bị Trước Khi Test

### 1.1 Khởi động hệ thống

```bash
cd DHHTTT18B-N31-cab-system
docker compose -f docker-compose.dev.yml up --build -d

# Kiểm tra hệ thống sẵn sàng (~60s)
curl http://localhost:8000/health
# → {"ok":true,"status":"ok","service":"api-gateway"}
```

### 1.2 Cấu hình Postman Environment

Vào **Environments → New** → đặt tên `CAB DEV`, thêm các biến:

| Variable          | Initial Value           | Mô tả                              |
|-------------------|-------------------------|------------------------------------|
| `baseUrl`         | `http://localhost:8000` | API Gateway                        |
| `token`           | _(trống)_               | JWT của user hiện tại (tự set)     |
| `driverToken`     | _(trống)_               | JWT của tài xế (tự set)            |
| `adminToken`      | _(trống)_               | JWT của admin (tự set)             |
| `bookingId`       | _(trống)_               | booking_id từ response (tự set)    |
| `rideId`          | _(trống)_               | ride_id từ response (tự set)       |
| `driverId`        | `DRV001`                | ID tài xế mặc định                 |
| `userId`          | `USR001`                | ID user mặc định                   |

Chọn environment **CAB DEV** ở góc trên phải Postman.

### 1.3 Thứ tự bắt buộc

```
1. POST /auth/register   → lấy token
2. POST /auth/login      → lấy token (nếu chưa register)
3. POST /bookings        → lấy bookingId
4. POST /rides/...       → dùng rideId
```

---

## 2. Auth Service — 5 POST

### 2.1 Đăng ký tài khoản

```
POST {{baseUrl}}/auth/register
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "email": "user01@test.com",
  "password": "Password@123",
  "role": "USER"
}
```

**Response 201:**
```json
{
  "access_token": "eyJhbGci...",
  "accessToken": "eyJhbGci...",
  "user_id": "acc_...",
  "refreshToken": "eyJhbGci..."
}
```

**Tests script — auto save token:**
```javascript
if (pm.response.code === 201) {
    const j = pm.response.json();
    pm.environment.set("token", j.access_token || j.accessToken);
    pm.environment.set("refreshToken", j.refreshToken);
    pm.environment.set("userId", j.user_id);
}
```

> **Đăng ký tài xế**: đổi `"role": "DRIVER"`, lưu token vào `driverToken`.  
> **Đăng ký admin**: đổi `"role": "ADMIN"`, lưu token vào `adminToken`.

---

### 2.2 Đăng nhập

```
POST {{baseUrl}}/auth/login
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "email": "user01@test.com",
  "password": "Password@123"
}
```

**Response 200:**
```json
{
  "access_token": "eyJhbGci...",
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

**Tests script:**
```javascript
if (pm.response.code === 200) {
    const j = pm.response.json();
    pm.environment.set("token", j.access_token || j.accessToken);
    pm.environment.set("refreshToken", j.refreshToken);
}
```

---

### 2.3 Refresh token

```
POST {{baseUrl}}/auth/refresh
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "refreshToken": "{{refreshToken}}"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGci...",
  "expiresIn": 86400
}
```

---

### 2.4 Đăng xuất

```
POST {{baseUrl}}/auth/logout
```

| Header        | Value                   |
|---------------|-------------------------|
| Authorization | Bearer {{token}}        |
| Content-Type  | application/json        |

**Body:** _(tuỳ chọn — có thể gửi rỗng `{}`)_
```json
{
  "refreshToken": "{{refreshToken}}"
}
```

**Response 200:**
```json
{
  "message": "Logged out successfully"
}
```

---

### 2.5 Xác minh token nội bộ

```
POST {{baseUrl}}/internal/verify
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "token": "{{token}}"
}
```

**Response 200:**
```json
{
  "valid": true,
  "payload": { "sub": "USR001", "role": "USER" }
}
```

> ⚠️ Endpoint này dùng nội bộ giữa các service, không cần test thường xuyên.

---

## 3. Booking Service — 3 POST

### 3.1 Tạo booking mới ⭐

```
POST {{baseUrl}}/bookings
```

| Header              | Value                    |
|---------------------|--------------------------|
| Authorization       | Bearer {{token}}         |
| Content-Type        | application/json         |
| Idempotency-Key     | `booking-{{$randomUUID}}` _(tuỳ chọn)_ |

**Body tối thiểu:**
```json
{
  "pickup": {
    "lat": 10.7769,
    "lng": 106.7009,
    "address": "Chợ Bến Thành, Quận 1, TP.HCM"
  },
  "drop": {
    "lat": 10.8231,
    "lng": 106.6297,
    "address": "Sân bay Tân Sơn Nhất"
  },
  "distance_km": 8.5
}
```

**Body đầy đủ (tuỳ chọn):**
```json
{
  "pickup": { "lat": 10.7769, "lng": 106.7009, "address": "Chợ Bến Thành" },
  "drop": { "lat": 10.8231, "lng": 106.6297, "address": "Sân bay TSN" },
  "distance_km": 8.5,
  "vehicleType": "CAR_4",
  "paymentMethod": "CASH"
}
```

**vehicleType**: `CAR_4` | `CAR_7` | `BIKE`  
**paymentMethod**: `CASH` | `CARD` | `MOMO` | `VNPAY`

**Response 200:**
```json
{
  "booking_id": "bk_abc123",
  "status": "REQUESTED",
  "created_at": "2026-04-27T10:00:00.000Z",
  "eta": 12,
  "price": 85000,
  "surge": 1.2
}
```

**Tests script — auto save bookingId:**
```javascript
if (pm.response.code === 200) {
    const j = pm.response.json();
    pm.environment.set("bookingId", j.booking_id);
    console.log("Booking created:", j.booking_id, "| Price:", j.price, "| ETA:", j.eta);
}
```

**Test case lỗi 400 — thiếu pickup:**
```json
{
  "drop": { "lat": 10.8231, "lng": 106.6297 },
  "distance_km": 5
}
```
→ Response 400: `{"message": "pickup is required"}`

**Test case lỗi 422 — distance_km âm:**
```json
{
  "pickup": { "lat": 10.7769, "lng": 106.7009 },
  "drop": { "lat": 10.8231, "lng": 106.6297 },
  "distance_km": -1
}
```
→ Response 422: `{"detail": "distance_km must be positive"}`

---

### 3.2 Tạo booking (batch nội bộ)

```
POST {{baseUrl}}/bookings/internal/batch
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "bookings": [
    {
      "userId": "USR001",
      "pickup": { "lat": 10.7769, "lng": 106.7009 },
      "dropoff": { "lat": 10.8231, "lng": 106.6297 }
    }
  ]
}
```

> ⚠️ Endpoint nội bộ, không đi qua auth middleware.

---

### 3.3 Hủy booking

```
POST {{baseUrl}}/bookings/{{bookingId}}/cancel
```

| Header        | Value            |
|---------------|------------------|
| Authorization | Bearer {{token}} |

**Response 200:**
```json
{
  "id": "bk_abc123",
  "status": "CANCELLED"
}
```

---

## 4. Pricing Service — 3 POST

### 4.1 Tính giá đơn giản ⭐

```
POST {{baseUrl}}/pricing
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "distance_km": 8.5,
  "demand_index": 1.2,
  "supply_index": 0.8
}
```

**Chỉ cần distance_km tối thiểu:**
```json
{
  "distance_km": 5
}
```

**Response 200:**
```json
{
  "price": 75000,
  "fare": 75000,
  "surge": 1.5,
  "surge_multiplier": 1.5
}
```

---

### 4.2 Ước tính giá (đầy đủ hơn)

```
POST {{baseUrl}}/pricing/estimate
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "pickup": { "lat": 10.7769, "lng": 106.7009 },
  "dropoff": { "lat": 10.8231, "lng": 106.6297 },
  "vehicleType": "CAR_4",
  "paymentMethod": "CASH"
}
```

**Response 200:**
```json
{
  "fare": 85000,
  "distanceM": 8500,
  "durationS": 1200,
  "currency": "VND",
  "surgeMultiplier": 1.2
}
```

---

### 4.3 Cập nhật surge multiplier

```
POST {{baseUrl}}/pricing/surge
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "area": "district_1",
  "multiplier": 1.8
}
```

**Response 200:**
```json
{
  "area": "district_1",
  "multiplier": 1.8,
  "updated_at": "2026-04-27T10:00:00.000Z"
}
```

---

## 5. Fraud Service — 2 POST

### 5.1 Kiểm tra gian lận (detect) ⭐

```
POST {{baseUrl}}/fraud/detect
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "userId": "USR001",
  "bookingId": "{{bookingId}}",
  "amount": 150000,
  "score": 0.95
}
```

**Response 200 — bình thường:**
```json
{
  "flagged": false,
  "risk_score": 0.2,
  "reason": "Normal activity"
}
```

**Response 200 — phát hiện gian lận (score >= 0.8):**
```json
{
  "flagged": true,
  "risk_score": 0.95,
  "reason": "High risk score detected"
}
```

**Test case lỗi 400 — thiếu trường:**
```json
{}
```
→ Response 400: `{"message": "Missing required fields: userId, bookingId, amount"}`

---

### 5.2 Kiểm tra gian lận (check — alias)

```
POST {{baseUrl}}/fraud/check
```

Body và response giống với `POST /fraud/detect`.

---

## 6. Driver Service — 3 POST

> **Lưu ý**: Các endpoint `/drivers/me/*` cần `driverToken`. Endpoint `/internal/*` không cần auth.

### 6.1 Cập nhật trạng thái bản thân (me)

```
POST {{baseUrl}}/drivers/me/status
```

| Header        | Value                  |
|---------------|------------------------|
| Authorization | Bearer {{driverToken}} |
| Content-Type  | application/json       |

**Body:**
```json
{
  "status": "ONLINE"
}
```

**status**: `ONLINE` | `OFFLINE` | `BUSY`

**Response 200:**
```json
{
  "driver_id": "DRV001",
  "status": "ONLINE"
}
```

---

### 6.2 Cập nhật vị trí tài xế

```
POST {{baseUrl}}/drivers/me/location
```

| Header        | Value                  |
|---------------|------------------------|
| Authorization | Bearer {{driverToken}} |
| Content-Type  | application/json       |

**Body:**
```json
{
  "lat": 10.7769,
  "lng": 106.7009,
  "heading": 90,
  "speed": 40
}
```

**Response 200:**
```json
{
  "updated": true,
  "driver_id": "DRV001",
  "location": { "lat": 10.7769, "lng": 106.7009 }
}
```

---

### 6.3 Cập nhật trạng thái tài xế cụ thể (nội bộ)

```
POST {{baseUrl}}/internal/drivers/{{driverId}}/state
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "state": "ASSIGNED",
  "bookingId": "{{bookingId}}"
}
```

**Response 200:**
```json
{
  "driver_id": "DRV001",
  "state": "ASSIGNED"
}
```

---

## 7. Ride Service — 5 POST

> Các endpoint ride đều đi qua API Gateway nhưng cần token tương ứng (user hoặc driver).

### 7.1 User hủy chuyến đi

```
POST {{baseUrl}}/rides/{{rideId}}/user/cancel
```

| Header        | Value            |
|---------------|------------------|
| Authorization | Bearer {{token}} |

**Response 200:**
```json
{
  "ride_id": "{{rideId}}",
  "status": "CANCELLED",
  "cancelled_by": "USER"
}
```

---

### 7.2 Tài xế chấp nhận chuyến ⭐

```
POST {{baseUrl}}/rides/{{rideId}}/driver/accept
```

| Header        | Value                  |
|---------------|------------------------|
| Authorization | Bearer {{driverToken}} |

**Response 200:**
```json
{
  "ride_id": "{{rideId}}",
  "status": "ACCEPTED",
  "driver_id": "DRV001"
}
```

---

### 7.3 Tài xế từ chối chuyến

```
POST {{baseUrl}}/rides/{{rideId}}/driver/reject
```

| Header        | Value                  |
|---------------|------------------------|
| Authorization | Bearer {{driverToken}} |

**Body (tuỳ chọn):**
```json
{
  "reason": "Too far"
}
```

**Response 200:**
```json
{
  "ride_id": "{{rideId}}",
  "status": "REJECTED"
}
```

---

### 7.4 Tài xế đón khách

```
POST {{baseUrl}}/rides/{{rideId}}/driver/pickup
```

| Header        | Value                  |
|---------------|------------------------|
| Authorization | Bearer {{driverToken}} |

**Response 200:**
```json
{
  "ride_id": "{{rideId}}",
  "status": "IN_PROGRESS",
  "picked_up_at": "2026-04-27T10:15:00.000Z"
}
```

---

### 7.5 Hoàn thành chuyến đi ⭐

```
POST {{baseUrl}}/rides/{{rideId}}/complete
```

| Header        | Value                  |
|---------------|------------------------|
| Authorization | Bearer {{driverToken}} |
| Content-Type  | application/json       |

**Body (tuỳ chọn):**
```json
{
  "actualDistanceM": 9200,
  "actualDurationS": 1350
}
```

**Response 200:**
```json
{
  "ride_id": "{{rideId}}",
  "status": "COMPLETED",
  "fare": 87400,
  "completed_at": "2026-04-27T10:40:00.000Z"
}
```

---

## 8. ETA Service — 3 POST

### 8.1 Dự đoán ETA cơ bản

```
POST {{baseUrl}}/eta/predict
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "pickup": { "lat": 10.7769, "lng": 106.7009 },
  "dropoff": { "lat": 10.8231, "lng": 106.6297 }
}
```

**Response 200:**
```json
{
  "eta_seconds": 1200,
  "eta_minutes": 20,
  "distance_m": 8500
}
```

---

### 8.2 Dự đoán ETA bằng AI ⭐

```
POST {{baseUrl}}/ai/eta
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "pickup": { "lat": 10.7769, "lng": 106.7009 },
  "dropoff": { "lat": 10.8231, "lng": 106.6297 },
  "distance_km": 8.5,
  "time_of_day": "morning_peak",
  "weather": "clear"
}
```

**Response 200 (luôn trả về, không bao giờ 500):**
```json
{
  "eta": 18,
  "eta_seconds": 1080,
  "model_version": "eta-v2",
  "source": "ai_model"
}
```

**Test simulate lỗi model (dùng fallback):**
```json
{
  "pickup": { "lat": 10.7769, "lng": 106.7009 },
  "dropoff": { "lat": 10.8231, "lng": 106.6297 },
  "distance_km": 8.5,
  "simulate_model_fail": true
}
```
→ Response 200: `{"eta": ..., "source": "fallback"}`

---

### 8.3 Dự báo nhu cầu AI ⭐

```
POST {{baseUrl}}/ai/forecast
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "area": "district_1",
  "time_window": "next_hour"
}
```

**Response 200:**
```json
{
  "area": "district_1",
  "time_window": "next_hour",
  "demand_forecast": 1.8,
  "timestamp": "2026-04-27T10:00:00.000Z",
  "model_version": "forecast-v1"
}
```

---

## 9. Agent Service — 5 POST

### 9.1 Gọi AI tool

```
POST {{baseUrl}}/agent/call-tool
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "tool": "get_eta",
  "params": {
    "pickup": { "lat": 10.7769, "lng": 106.7009 },
    "dropoff": { "lat": 10.8231, "lng": 106.6297 }
  }
}
```

---

### 9.2 AI chọn tài xế

```
POST {{baseUrl}}/agent/select-driver
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "bookingId": "{{bookingId}}",
  "pickup": { "lat": 10.7769, "lng": 106.7009 },
  "vehicleType": "CAR_4"
}
```

---

### 9.3 Gợi ý tài xế (Top 3) ⭐

```
POST {{baseUrl}}/ai/recommend-drivers
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "pickup": { "lat": 10.7769, "lng": 106.7009 },
  "vehicleType": "CAR_4",
  "maxDistance": 5
}
```

**Response 200:**
```json
{
  "drivers": [
    { "driver_id": "DRV001", "distance_km": 0.8, "rating": 4.9, "eta_minutes": 3 },
    { "driver_id": "DRV002", "distance_km": 1.2, "rating": 4.7, "eta_minutes": 5 },
    { "driver_id": "DRV003", "distance_km": 2.1, "rating": 4.5, "eta_minutes": 8 }
  ]
}
```

---

### 9.4 AI ghép tài xế cho booking ⭐

```
POST {{baseUrl}}/ai/agent/match-driver
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "booking_id": "{{bookingId}}",
  "pickup": { "lat": 10.7769, "lng": 106.7009 },
  "preference": "balanced"
}
```

**preference**: `nearest` | `highest_rating` | `balanced`

**Response 200:**
```json
{
  "driver_id": "DRV001",
  "score": 0.92,
  "reason": "Balanced: nearest + rating",
  "eta_minutes": 4
}
```

**Test simulate AI lỗi:**
```json
{
  "booking_id": "{{bookingId}}",
  "pickup": { "lat": 10.7769, "lng": 106.7009 },
  "simulate_ai_fail": true
}
```
→ Response 200 (fallback): `{"driver_id": "DRV_FALLBACK", "source": "fallback"}`

---

### 9.5 AI ra quyết định ⭐

```
POST {{baseUrl}}/ai/agent/decide
```

| Header       | Value            |
|--------------|------------------|
| Content-Type | application/json |

**Body:**
```json
{
  "booking_id": "{{bookingId}}",
  "task": "assign_driver",
  "context": {
    "available_drivers": 5,
    "surge": 1.3
  }
}
```

**task**: `assign_driver` | `calculate_eta` | `detect_fraud` | `estimate_price`

**Response 200:**
```json
{
  "decision": "assign_driver",
  "tool_called": "match_driver",
  "result": { "driver_id": "DRV001" },
  "booking_id": "{{bookingId}}"
}
```

---

## 10. Review Service — 1 POST

### 10.1 Gửi đánh giá ⭐

```
POST {{baseUrl}}/reviews
```

| Header        | Value            |
|---------------|------------------|
| Authorization | Bearer {{token}} |
| Content-Type  | application/json |

**Body:**
```json
{
  "booking_id": "{{bookingId}}",
  "driver_id": "{{driverId}}",
  "rating": 5,
  "comment": "Tài xế lịch sự, đúng giờ"
}
```

**rating**: `1` - `5`

**Response 201:**
```json
{
  "review_id": "rev_...",
  "booking_id": "{{bookingId}}",
  "rating": 5,
  "created_at": "2026-04-27T10:45:00.000Z"
}
```

---

## 11. Thứ Tự Chạy End-to-End

Chạy theo thứ tự sau để test toàn bộ luồng:

```
Bước 1:  POST /auth/register           → lưu token, userId
Bước 2:  POST /auth/register (DRIVER)  → lưu driverToken, driverId
Bước 3:  POST /pricing/estimate        → xem giá trước
Bước 4:  POST /bookings                → lưu bookingId
Bước 5:  POST /pricing                 → tính giá từ distance_km
Bước 6:  POST /fraud/detect            → kiểm tra gian lận
Bước 7:  POST /ai/eta                  → dự đoán thời gian
Bước 8:  POST /ai/agent/match-driver   → AI chọn tài xế
Bước 9:  POST /drivers/me/status       → tài xế ONLINE (dùng driverToken)
Bước 10: POST /drivers/me/location     → cập nhật vị trí
Bước 11: POST /rides/{id}/driver/accept→ tài xế nhận chuyến
Bước 12: POST /rides/{id}/driver/pickup→ đón khách
Bước 13: POST /rides/{id}/complete     → hoàn thành
Bước 14: POST /reviews                 → đánh giá (dùng token)
Bước 15: POST /auth/logout             → đăng xuất
```

### Chạy bằng Newman (CLI)

```bash
# Cài Newman
npm install -g newman newman-reporter-htmlextra

# Chạy Backend Tests
newman run Test-case/CAB_SYSTEM_Backend_Tests.postman_collection.json \
  --env-var "baseUrl=http://localhost:8000" \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export report-backend.html

# Chạy AI & Performance Tests
newman run Test-case/CAB_SYSTEM_AI_Perf_Monitor_Tests.postman_collection.json \
  --env-var "baseUrl=http://localhost:8000" \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export report-ai.html

# Chạy Frontend Tests
newman run Test-case/CAB_SYSTEM_Frontend_Tests.postman_collection.json \
  --env-var "baseUrl=http://localhost:8000" \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export report-frontend.html
```

---

## Bảng Tổng Hợp 31 POST Endpoints

| # | Endpoint | Auth | Mô tả |
|---|----------|------|-------|
| 1 | `POST /auth/register` | Public | Đăng ký tài khoản |
| 2 | `POST /auth/login` | Public | Đăng nhập |
| 3 | `POST /auth/refresh` | Public | Làm mới token |
| 4 | `POST /auth/logout` | User JWT | Đăng xuất |
| 5 | `POST /internal/verify` | Internal | Xác minh token |
| 6 | `POST /bookings` | User JWT | Tạo booking mới |
| 7 | `POST /bookings/internal/batch` | Internal | Tạo booking hàng loạt |
| 8 | `POST /bookings/:id/cancel` | User JWT | Hủy booking |
| 9 | `POST /pricing` | Public | Tính giá từ distance_km |
| 10 | `POST /pricing/estimate` | Public | Ước tính giá (đầy đủ) |
| 11 | `POST /pricing/surge` | Public | Cập nhật surge |
| 12 | `POST /fraud/detect` | Public | Phát hiện gian lận |
| 13 | `POST /fraud/check` | Public | Kiểm tra gian lận (alias) |
| 14 | `POST /drivers/me/status` | Driver JWT | Tài xế cập nhật trạng thái |
| 15 | `POST /drivers/me/location` | Driver JWT | Tài xế cập nhật vị trí |
| 16 | `POST /internal/drivers/:id/state` | Internal | Cập nhật trạng thái tài xế |
| 17 | `POST /rides/:id/user/cancel` | User JWT | User hủy chuyến |
| 18 | `POST /rides/:id/driver/accept` | Driver JWT | Tài xế nhận chuyến |
| 19 | `POST /rides/:id/driver/reject` | Driver JWT | Tài xế từ chối |
| 20 | `POST /rides/:id/driver/pickup` | Driver JWT | Đón khách |
| 21 | `POST /rides/:id/complete` | Driver JWT | Hoàn thành chuyến |
| 22 | `POST /eta/predict` | Public | Dự đoán ETA cơ bản |
| 23 | `POST /ai/eta` | Public | Dự đoán ETA bằng AI |
| 24 | `POST /ai/forecast` | Public | Dự báo nhu cầu AI |
| 25 | `POST /agent/call-tool` | Public | Gọi AI tool |
| 26 | `POST /agent/select-driver` | Public | AI chọn tài xế |
| 27 | `POST /ai/recommend-drivers` | Public | Gợi ý top 3 tài xế |
| 28 | `POST /ai/agent/match-driver` | Public | AI ghép tài xế |
| 29 | `POST /ai/agent/decide` | Public | AI ra quyết định |
| 30 | `POST /users/locations` | User JWT | Thêm địa điểm yêu thích |
| 31 | `POST /reviews` | User JWT | Gửi đánh giá |

---

> **Tip**: Dùng Postman **Collection Runner** (nút ▶ bên cạnh tên collection) để chạy toàn bộ theo thứ tự tự động với delay 500ms giữa mỗi request.
