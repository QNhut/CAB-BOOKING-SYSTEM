# 🚖 Car Booking System — Hướng Dẫn Cài Đặt & Chạy Hoàn Chỉnh

> **Hệ thống đặt xe taxi theo kiến trúc Microservices** sử dụng Node.js, Kafka, PostgreSQL, Redis, React + Vite, Docker Compose, Kubernetes, Prometheus & Grafana.

---

## 📑 Mục Lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Yêu cầu hệ thống](#2-yêu-cầu-hệ-thống)
3. [Lấy API Keys (bắt buộc)](#3-lấy-api-keys-bắt-buộc)
4. [Cài đặt &amp; chạy bằng Docker Compose (Dev)](#4-cài-đặt--chạy-bằng-docker-compose-dev)
5. [Chạy Frontend riêng (không qua Docker)](#5-chạy-frontend-riêng-không-qua-docker)
6. [Bảng Port dịch vụ](#6-bảng-port-dịch-vụ)
7. [Cấu hình biến môi trường](#7-cấu-hình-biến-môi-trường)
8. [Hướng dẫn sử dụng (User Flow)](#8-hướng-dẫn-sử-dụng-user-flow)
9. [Công cụ quản trị](#9-công-cụ-quản-trị)
10. [Observability (Prometheus + Grafana)](#10-observability-prometheus--grafana)
11. [Chạy Load Test (k6)](#11-chạy-load-test-k6)
12. [Deploy lên Kubernetes (Production)](#12-deploy-lên-kubernetes-production)
13. [Cấu trúc thư mục dự án](#13-cấu-trúc-thư-mục-dự-án)
14. [Xử lý sự cố (Troubleshooting)](#14-xử-lý-sự-cố-troubleshooting)
15. [Danh sách Test Cases (121 TC)](#15-danh-sách-test-cases-121-tc)

---

## 1. Tổng Quan Kiến Trúc

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                 │
│                       Port 5173                             │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP
┌─────────────────────▼───────────────────────────────────────┐
│               API GATEWAY (Express) — Port 8000             │
│   Rate Limiting • Helmet • Prometheus • Tracing • Routing   │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬────────┘
   │      │      │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
│ Auth ││Booking││Driver││ Ride ││Pricing││ Geo  ││ ETA  ││Agent │
│ 8001 ││ 8003 ││ 8004 ││ 8005 ││ 8002 ││ 8007 ││ 8009 ││ 8012 │
└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──────┘└──────┘
   │       │       │       │       │       │
   ▼       ▼       ▼       ▼       ▼       ▼
┌──────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                       │
│  PostgreSQL 16 (5432)  •  Redis 7 (6379)  •  Kafka (9092)   │
└──────────────────────────────────────────────────────────────┘
```

**14 Microservices:**

| Service                        | Port | Mô tả                                                     |
| ------------------------------ | ---- | ----------------------------------------------------------- |
| **api-gateway**          | 8000 | Reverse proxy, rate limiting, routing, Prometheus metrics   |
| **auth-service**         | 8001 | Đăng ký, đăng nhập, JWT, RBAC (USER/DRIVER/ADMIN)     |
| **pricing-service**      | 8002 | Tính giá động (surge pricing), OSRM route distance      |
| **booking-service**      | 8003 | Tạo booking, outbox pattern, idempotency key               |
| **driver-service**       | 8004 | Quản lý vị trí GPS, trạng thái tài xế, heartbeat    |
| **ride-service**         | 8005 | Điều phối chuyến đi, multi-driver offers, timeout      |
| **notification-service** | 8006 | SSE (Server-Sent Events) realtime cho client                |
| **geo-service**          | 8007 | Geocoding, reverse geocoding (Geoapify API)                 |
| **payment-service**      | 8888 | Thanh toán VNPay sandbox                                   |
| **eta-service**          | 8009 | Dự đoán thời gian đến (ML), drift detection           |
| **fraud-service**        | 8010 | Phát hiện gian lận (ML scoring)                          |
| **review-service**       | 8011 | Đánh giá & rating chuyến đi                            |
| **agent-service**        | 8012 | AI Agent chọn tài xế đa tiêu chí (MCP)                |
| **driver-client**        | —   | Simulator tài xế (test)                                   |

---

## 2. Yêu Cầu Hệ Thống

### Phần mềm cần cài đặt

| Phần mềm               | Phiên bản tối thiểu | Cài đặt                                                             |
| ------------------------ | ----------------------- | ---------------------------------------------------------------------- |
| **Docker**         | 20.10+                  | [docker.com/get-docker](https://docs.docker.com/get-docker/)              |
| **Docker Compose** | v2.0+                   | Đi kèm Docker Desktop                                                |
| **Node.js**        | 20.x LTS                | [nodejs.org](https://nodejs.org/) (chỉ cần nếu chạy FE ngoài Docker) |
| **npm**            | 10.x+                   | Đi kèm Node.js                                                       |
| **k6**             | 0.50+                   | `brew install k6` (macOS) — chỉ cần cho load test                 |
| **Git**            | 2.30+                   | `brew install git` hoặc [git-scm.com](https://git-scm.com/)            |

### Tài nguyên phần cứng (khuyến nghị)

- **RAM**: ≥ 8 GB (Docker chạy 14 container)
- **CPU**: ≥ 4 cores
- **Disk**: ≥ 5 GB trống
- **OS**: macOS, Linux, hoặc Windows (WSL2)

### Kiểm tra Docker đã cài đặt

```bash
docker --version        # Docker version 24.x+
docker compose version  # Docker Compose version v2.x+
```

---

## 3. Lấy API Keys (Bắt Buộc)

### 3.1 Geoapify API Key (Dịch vụ Geocoding)

> **Dùng cho**: `geo-service` — tìm kiếm địa chỉ, autocomplete, reverse geocode.

**Bước 1**: Truy cập [https://myprojects.geoapify.com/register](https://myprojects.geoapify.com/register)

**Bước 2**: Đăng ký tài khoản miễn phí (3,000 requests/ngày)

**Bước 3**: Tạo project mới → Copy **API Key**

**Bước 4**: Mở file `docker-compose.dev.yml`, tìm service `geo-service`:

```yaml
geo-service:
  environment:
    GEOAPIFY_API_KEY: "PASTE_YOUR_KEY_HERE"  # ← Thay key vào đây
```

> ℹ️ **Mặc định trong project đã có sẵn key dev**: `67d9d41e69eb4504a3aa7bd282861b5b`. Key này có thể hết quota, bạn nên tạo key riêng.

---

### 3.2 VNPay Sandbox (Thanh toán)

> **Dùng cho**: `payment-service` — xử lý thanh toán online.

VNPay sandbox **đã được cấu hình sẵn** trong file `services/payment-service/config/default.json`:

```json
{
  "vnp_TmnCode": "ONU4TMSW",
  "vnp_HashSecret": "7M3UL3O186UKCKA9B390YJ5TIBB858NF",
  "vnp_Url": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  "vnp_Api": "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
  "vnp_ReturnUrl": "http://localhost:5173"
}
```

**Nếu muốn tạo tài khoản sandbox riêng:**

1. Truy cập [https://sandbox.vnpayment.vn/merchantv2/](https://sandbox.vnpayment.vn/merchantv2/)
2. Đăng ký tài khoản merchant sandbox
3. Lấy `TmnCode` và `HashSecret` → cập nhật vào `services/payment-service/config/default.json`

**Thẻ test VNPay Sandbox:**

| Thông tin      | Giá trị               |
| --------------- | ----------------------- |
| Số thẻ        | `9704198526191432198` |
| Tên chủ thẻ  | `NGUYEN VAN A`        |
| Ngày hết hạn | `07/15`               |
| OTP             | `123456`              |

---

### 3.3 OSRM (Tính khoảng cách đường đi)

> **Dùng cho**: `pricing-service` — tính khoảng cách thực tế trên bản đồ.

**Không cần API key!** Project sử dụng OSRM public API (miễn phí): `https://router.project-osrm.org`

Nếu public API chậm hoặc bị rate limit, có thể tự host OSRM:

```bash
docker pull osrm/osrm-backend
```

---

## 4. Cài Đặt & Chạy Bằng Docker Compose (Dev)

### Bước 1: Clone dự án

```bash
git clone <your-repo-url> Car-booking-backend-main
cd Car-booking-backend-main
```

### Bước 2: Khởi động toàn bộ hệ thống

```bash
# Khởi động tất cả 14+ container
docker compose -f docker-compose.dev.yml up -d
```

> ⏳ Lần đầu chạy sẽ mất ~3-5 phút để pull images (node:20-alpine, postgres:16-alpine, redis:7-alpine, kafka:4.1.1) và install dependencies.

### Bước 3: Kiểm tra trạng thái

```bash
# Xem log tất cả services
docker compose -f docker-compose.dev.yml logs -f

# Kiểm tra health
curl http://localhost:8000/health

# Xem trạng thái container
docker compose -f docker-compose.dev.yml ps
```

### Bước 4: Kiểm tra từng service

> **Lưu ý**: Kiểm tra trực tiếp từng service (không qua gateway) để xác nhận chúng hoạt động.

```bash
# Tất cả service đều có endpoint /health
for port in 8001 8002 8003 8004 8005 8006 8007 8009 8010 8011 8012; do
  echo "Port $port: $(curl -s http://localhost:$port/health)"
done

# API Gateway
curl http://localhost:8000/health
# → {"ok":true,"service":"api-gateway","upstreams":{...}}

# Payment service (VNPay) — không có /health, kiểm tra bằng:
curl http://localhost:8888/order/create_payment_url
# → Trả HTML form tạo thanh toán
```

### Bước 5: Dừng hệ thống

```bash
# Dừng tất cả
docker compose -f docker-compose.dev.yml down

# Dừng và xóa dữ liệu (volumes)
docker compose -f docker-compose.dev.yml down -v
```

---

## 5. Chạy Frontend Riêng (Không Qua Docker)

Nếu bạn muốn phát triển frontend với hot-reload nhanh hơn:

### Bước 1: Cài dependencies

```bash
cd taxi-fe
npm install
```

### Bước 2: Chạy dev server

```bash
npm run dev
```

Frontend sẽ chạy tại: **http://localhost:5173**

### Bước 3: Build production

```bash
npm run build    # Output: taxi-fe/dist/
npm run preview  # Preview bản build
```

### Cấu hình kết nối API

Frontend kết nối API Gateway qua biến môi trường. Tạo file `taxi-fe/.env`:

```env
VITE_AUTH_URL=http://localhost:8000
VITE_BOOKING_URL=http://localhost:8000
VITE_PRICING_URL=http://localhost:8000
VITE_DRIVER_URL=http://localhost:8000
VITE_RIDE_URL=http://localhost:8000
VITE_NOTIFICATION_URL=http://localhost:8000
VITE_GEO_URL=http://localhost:8000
VITE_PAYMENT_URL=http://localhost:8000
```

> Tất cả request đều đi qua API Gateway (port 8000), gateway sẽ route tới service tương ứng.

---

## 6. Bảng Port Dịch Vụ

### Application Services

| Port     | Dịch vụ            | URL truy cập         | Ghi chú                      |
| -------- | -------------------- | --------------------- | ----------------------------- |
| `5173` | Frontend (React)     | http://localhost:5173 | Giao diện người dùng      |
| `8000` | API Gateway          | http://localhost:8000 | Entry point cho mọi API call |
| `8001` | Auth Service         | http://localhost:8001 | Xác thực & phân quyền     |
| `8002` | Pricing Service      | http://localhost:8002 | Tính giá                    |
| `8003` | Booking Service      | http://localhost:8003 | Quản lý đặt xe            |
| `8004` | Driver Service       | http://localhost:8004 | Quản lý tài xế            |
| `8005` | Ride Service         | http://localhost:8005 | Điều phối chuyến đi      |
| `8006` | Notification Service | http://localhost:8006 | SSE notifications             |
| `8007` | Geo Service          | http://localhost:8007 | Geocoding                     |
| `8009` | ETA Service          | http://localhost:8009 | Dự đoán thời gian         |
| `8010` | Fraud Service        | http://localhost:8010 | Phát hiện gian lận         |
| `8011` | Review Service       | http://localhost:8011 | Đánh giá                   |
| `8012` | Agent Service        | http://localhost:8012 | AI Agent                      |
| `8888` | Payment Service      | http://localhost:8888 | Thanh toán VNPay             |

### Infrastructure Services

| Port     | Dịch vụ    | URL truy cập         | Ghi chú                                   |
| -------- | ------------ | --------------------- | ------------------------------------------ |
| `5432` | PostgreSQL   | `localhost:5432`    | User:`taxi` / Pass: `taxi_pass`        |
| `6379` | Redis        | `localhost:6379`    | Không password (dev)                      |
| `9094` | Kafka (host) | `localhost:9094`    | Broker từ host machine                    |
| `5050` | PgAdmin      | http://localhost:5050 | Email:`admin@taxi.com` / Pass: `admin` |
| `8080` | Kafka UI     | http://localhost:8080 | Xem topics, messages, consumers            |

---

## 7. Cấu Hình Biến Môi Trường

> Tất cả biến môi trường đã được cấu hình sẵn trong `docker-compose.dev.yml`. Chỉ cần thay đổi khi cần thiết.

### Biến môi trường quan trọng cần thay đổi cho Production

| Biến                 | Mặc định (Dev)                          | Mô tả                                                    | Nơi cấu hình               |
| --------------------- | ------------------------------------------ | ---------------------------------------------------------- | ----------------------------- |
| `JWT_SECRET`        | `dev-secret-change-in-production-please` | Khóa bí mật JWT —**BẮT BUỘC đổi khi deploy** | docker-compose.yml hoặc .env |
| `GEOAPIFY_API_KEY`  | `67d9d41e69eb4504a3aa7bd282861b5b`       | API key Geoapify                                           | geo-service environment       |
| `POSTGRES_PASSWORD` | `taxi_pass`                              | Mật khẩu PostgreSQL                                      | postgres environment          |
| `FRAUD_THRESHOLD`   | `0.7`                                    | Ngưỡng phát hiện gian lận (0.0-1.0)                   | fraud-service environment     |
| `OFFER_TIMEOUT_SEC` | `10`                                     | Thời gian chờ tài xế phản hồi (giây)                | ride-service environment      |
| `HB_TTL_SEC`        | `60`                                     | Heartbeat timeout tài xế (giây)                         | driver-service environment    |

### Cấu hình Database

```bash
# Connection string cho từng service
AUTH_DATABASE_URL=postgres://taxi:taxi_pass@postgres:5432/auth_db
BOOKING_DATABASE_URL=postgres://taxi:taxi_pass@postgres:5432/taxi_main
RIDE_DATABASE_URL=postgres://taxi:taxi_pass@postgres:5432/ride_db
```

### Cấu hình Kafka

```bash
KAFKA_BROKERS=kafka:9092                    # Broker address (trong Docker)
KAFKA_BROKERS=localhost:9094                # Broker address (ngoài Docker)
KAFKA_BOOKING_TOPIC=taxi.bookings           # Topic đặt xe
KAFKA_RIDE_TOPIC=taxi.rides                 # Topic chuyến đi
KAFKA_PAYMENT_TOPIC=taxi.payments           # Topic thanh toán
```

---

## 8. Hướng Dẫn Sử Dụng (User Flow)

### 8.1 Đăng ký & Đăng nhập

```bash
# Đăng ký tài khoản khách hàng
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "customer1@test.com",
    "password": "123456",
    "role": "USER",
    "userId": "u1"
  }'

# Đăng ký tài khoản tài xế
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "driver1@test.com",
    "password": "123456",
    "role": "DRIVER",
    "driverId": "d1"
  }'

# Đăng nhập
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "customer1@test.com",
    "password": "123456",
    "userId": "u1"
  }'
# → Response: { "accessToken": "eyJhb...", "refreshToken": "...", "expiresIn": 86400 }
```

### 8.2 Tài xế lên tuyến (Go Online)

```bash
# Lưu token tài xế
DRIVER_TOKEN="eyJhb..."

# Cập nhật trạng thái ONLINE + vị trí
curl -X POST http://localhost:8000/drivers/me/status \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "ONLINE", "lat": 10.7769, "lng": 106.7009, "vehicleType": "CAR_4" }'

# Cập nhật vị trí GPS (khi di chuyển)
curl -X POST http://localhost:8000/drivers/me/location \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "lat": 10.7770, "lng": 106.7010, "accuracyM": 5 }'

# Heartbeat: gửi lại POST /drivers/me/status mỗi 30s để giữ ONLINE
```

### 8.3 Đặt xe

```bash
CUSTOMER_TOKEN="eyJhb..."

# Bước 1: Tính giá trước
curl -X POST http://localhost:8000/pricing/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "pickup": { "lat": 10.7769, "lng": 106.7009 },
    "dropoff": { "lat": 10.8231, "lng": 106.6297 },
    "vehicleType": "CAR_4"
  }'
# → Response: { "fare": 57000, "distanceM": 5681, "durationS": 377, "currency": "VND", ... }

# Bước 2: Đặt xe (cần gửi kèm pricingSnapshot)
curl -X POST http://localhost:8000/bookings \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: booking-001" \
  -d '{
    "userId": "u1",
    "pickup": { "lat": 10.7769, "lng": 106.7009 },
    "dropoff": { "lat": 10.8231, "lng": 106.6297 },
    "vehicleType": "CAR_4",
    "paymentMethod": "CASH",
    "pricingSnapshot": { "fare": 57000, "distanceM": 5681, "durationS": 377 }
  }'
# → Response: { "bookingId": "uuid-...", "status": "REQUESTED" }
```

### 8.4 Tài xế nhận/từ chối chuyến

```bash
# Tài xế nhận chuyến
curl -X POST http://localhost:8000/rides/<ride_id>/driver/accept \
  -H "Authorization: Bearer $DRIVER_TOKEN"
# → { "ok": true, "rideId": "...", "status": "DRIVER_ASSIGNED" }

# Tài xế từ chối → hệ thống tự đổi sang tài xế khác
curl -X POST http://localhost:8000/rides/<ride_id>/driver/reject \
  -H "Authorization: Bearer $DRIVER_TOKEN"
# → { "ok": true }

# Tài xế đón khách
curl -X POST http://localhost:8000/rides/<ride_id>/driver/pickup \
  -H "Authorization: Bearer $DRIVER_TOKEN"

# Hoàn thành chuyến đi
curl -X POST http://localhost:8000/rides/<ride_id>/complete \
  -H "Authorization: Bearer $DRIVER_TOKEN"
```

### 8.5 Lắng nghe SSE (Real-time Events)

```bash
# Mở SSE stream (dùng token JWT)
curl -N "http://localhost:8000/notifications/stream?token=$CUSTOMER_TOKEN"

# Hoặc legacy mode (cho test nhanh)
curl -N "http://localhost:8000/notifications/stream?role=user&userId=u1"

# Events nhận được:
# data: {"event":"ride_offer","rideId":"...","driverId":"..."}
# data: {"event":"ride_accepted","rideId":"..."}
# data: {"event":"passenger_picked_up","rideId":"..."}
# data: {"event":"ride_completed","rideId":"...","fare":57000}
# data: {"event":"payment","status":"COMPLETED"}
```

---

## 9. Công Cụ Quản Trị

### 9.1 PgAdmin (Quản lý Database)

- **URL**: http://localhost:5050
- **Email**: `admin@taxi.com`
- **Password**: `admin`

**Kết nối database:**

Server đã được cấu hình sẵn. Nếu cần thêm thủ công:

| Thuộc tính | Giá trị                                                |
| ------------ | -------------------------------------------------------- |
| Host         | `postgres` (trong Docker) hoặc `localhost`          |
| Port         | `5432`                                                 |
| Username     | `taxi`                                                 |
| Password     | `taxi_pass`                                            |
| Databases    | `auth_db`, `booking_db` (`taxi_main`), `ride_db` |

### 9.2 Kafka UI (Giám sát Message Queue)

- **URL**: http://localhost:8080

**Xem được:**

- Topics: `taxi.bookings`, `taxi.rides`, `taxi.payments`
- Consumer groups: `ride-service`, `booking-service`, `notification-service`, `driver-client`
- Messages: nội dung từng message trong topic
- Partitions: offset, lag

### 9.3 Admin API Endpoints

```bash
ADMIN_TOKEN="eyJhb..."  # Token có role ADMIN

# Danh sách tất cả users
curl http://localhost:8000/auth/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Prometheus metrics
curl http://localhost:8000/metrics
```

### 9.4 Tạo tài khoản Admin

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin@taxi.com",
    "password": "Admin@123456",
    "role": "ADMIN",
    "full_name": "System Admin",
    "phone": "0900000000"
  }'
```

---

## 10. Observability (Prometheus + Grafana)

### 10.1 Prometheus

- **Truy cập**: http://localhost:9090 (nếu expose trong compose)
- **Config**: `observability/prometheus/prometheus.yml`

**Các metric quan trọng:**

```promql
# Tổng số request theo service
http_requests_total{service="api-gateway"}

# Latency P95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])

# ETA drift detection
eta_drift_z_score
eta_drift_detected
```

**Alerts đã cấu hình** (`observability/prometheus/alerts.yml`):

| Alert         | Điều kiện                      | Severity |
| ------------- | --------------------------------- | -------- |
| HighErrorRate | Error rate > 5% trong 2 phút     | Critical |
| HighLatency   | P95 > 500ms trong 2 phút         | Warning  |
| ServiceDown   | Service không phản hồi 1 phút | Critical |

### 10.2 Grafana

- **Config**: `observability/grafana/provisioning/`
- **Dashboard JSON**: `observability/grafana/provisioning/dashboards/cab-booking.json`

**Dashboard panels:**

- Request Rate (req/s per service)
- P95 & P99 Latency
- Error Rate (%)
- Active Services
- CPU & Memory Usage
- ETA Drift Detection
- Service Health Table

### 10.3 Xem Metrics của từng service

```bash
# API Gateway metrics
curl http://localhost:8000/metrics

# ETA drift status
curl http://localhost:8009/eta/drift

# Agent decisions log
curl http://localhost:8012/agent/decisions

# Agent model info
curl http://localhost:8012/agent/model-info
```

---

## 11. Chạy Load Test (k6)

### Cài đặt k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows
choco install k6
```

### Chạy load test

```bash
# Chạy đầy đủ (3 scenarios: booking, eta, pricing spike)
k6 run test/load-test.js

# Chạy nhẹ (phát triển)
k6 run test/load-test.js --vus 10 --duration 30s

# Chạy nặng (stress test)
k6 run test/load-test.js --vus 200 --duration 120s
```

### Kết quả mong đợi

```
✓ P95 latency < 300ms
✓ Error rate < 1%
✓ ETA service P95 < 200ms
✓ Booking P95 < 500ms
```

---

## 12. Deploy Lên Kubernetes (Production)

### Bước 1: Build & Push Docker images

```bash
# Set registry
export IMAGE_REPO=ghcr.io/your-org
export IMAGE_TAG=v1.0.0

# Build tất cả services
for svc in auth-service booking-service driver-service ride-service \
           pricing-service geo-service notification-service payment-service \
           eta-service fraud-service review-service agent-service; do
  docker build -t $IMAGE_REPO/$svc:$IMAGE_TAG ./services/$svc
  docker push $IMAGE_REPO/$svc:$IMAGE_TAG
done

# Build API Gateway
docker build -t $IMAGE_REPO/api-gateway:$IMAGE_TAG ./api-gateway
docker push $IMAGE_REPO/api-gateway:$IMAGE_TAG
```

### Bước 2: Tạo Kubernetes secrets

```bash
kubectl create secret generic taxi-secrets \
  --from-literal=JWT_SECRET="your-strong-production-secret-here" \
  --from-literal=POSTGRES_PASSWORD="strong-db-password" \
  --from-literal=GEOAPIFY_API_KEY="your-geoapify-key" \
  --from-literal=VNP_HASH_SECRET="your-vnpay-secret"
```

### Bước 3: Apply K8s manifests

```bash
kubectl apply -f infra/k8s/api-gateway.yml
kubectl apply -f infra/k8s/microservices.yml
```

### K8s Features đã cấu hình

- **Rolling Updates**: maxSurge=1, maxUnavailable=0 (zero downtime)
- **HPA**: Auto-scale 2-10 replicas tại 70% CPU
- **Health Checks**: Liveness & Readiness probes trên `/health`
- **Resource Limits**: 100m-500m CPU, 128Mi-512Mi RAM

---

## 13. Cấu Trúc Thư Mục Dự Án

```
Car-booking-backend-main/
├── api-gateway/                 # API Gateway (port 8000)
│   └── src/index.js             #   Routing, rate-limit, tracing, metrics
│
├── services/
│   ├── auth-service/            # Xác thực (port 8001)
│   │   ├── index.js             #   Register, Login, JWT, Admin endpoints
│   │   ├── migrations/          #   0001_init.sql, 0002_profiles.sql
│   │   └── src/                 #   Middleware, routing helpers
│   │
│   ├── booking-service/         # Đặt xe (port 8003)
│   │   ├── index.js             #   REST API, validation, idempotency
│   │   ├── consumer.js          #   Kafka consumer (PAYMENT_FAILED handler)
│   │   ├── outbox-worker.js     #   Transactional outbox pattern
│   │   └── kafka.js             #   Kafka producer singleton
│   │
│   ├── driver-service/          # Tài xế (port 8004)
│   │   ├── index.js             #   Location, heartbeat, status
│   │   └── src/                 #   Redis driver state management
│   │
│   ├── ride-service/            # Chuyến đi (port 8005)
│   │   ├── index.js             #   Multi-driver offers, timeout, saga
│   │   └── migrations/          #   Ride tables
│   │
│   ├── pricing-service/         # Tính giá (port 8002)
│   │   └── index.js             #   Surge pricing, OSRM, distance calc
│   │
│   ├── geo-service/             # Địa lý (port 8007)
│   │   └── index.js             #   Geoapify integration
│   │
│   ├── notification-service/    # Thông báo (port 8006)
│   │   └── index.js             #   SSE streams, Kafka consumer
│   │
│   ├── payment-service/         # Thanh toán (port 8888)
│   │   ├── app.js               #   Express app, VNPay
│   │   └── config/default.json  #   VNPay credentials
│   │
│   ├── eta-service/             # ETA (port 8009)
│   │   └── index.js             #   ML prediction, drift detection
│   │
│   ├── fraud-service/           # Gian lận (port 8010)
│   │   └── index.js             #   ML fraud scoring
│   │
│   ├── review-service/          # Đánh giá (port 8011)
│   │   └── src/                 #   Review CRUD
│   │
│   ├── agent-service/           # AI Agent (port 8012)
│   │   └── index.js             #   Multi-criteria driver selection, MCP
│   │
│   └── driver-client/           # Simulator tài xế (test)
│       └── index.js             #   Auto-accept rides
│
├── shared/                      # Shared utilities
│   ├── auth-middleware.js       #   JWT middleware, RBAC
│   ├── circuit-breaker.js       #   Circuit breaker pattern
│   ├── metrics.js               #   Prometheus metrics
│   ├── logger.js                #   Structured JSON logging
│   ├── tracing.js               #   Distributed tracing (X-Trace-Id)
│   └── kafka-dlq.js             #   Dead Letter Queue
│
├── taxi-fe/                     # Frontend React
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── user/            #   UserDashboard, RideHistory, Rating
│   │   │   ├── driver/          #   DriverDashboard
│   │   │   └── admin/           #   AdminDashboard
│   │   ├── components/          #   Reusable UI components
│   │   ├── api/                 #   API client
│   │   ├── auth/                #   Auth context
│   │   ├── hooks/               #   Custom hooks
│   │   └── sse/                 #   SSE client
│   └── vite.config.ts           #   Vite + Tailwind CSS v4
│
├── observability/
│   ├── prometheus/
│   │   ├── prometheus.yml       #   Scrape config
│   │   └── alerts.yml           #   Alert rules
│   └── grafana/
│       └── provisioning/        #   Dashboard JSON, datasources
│
├── infra/
│   └── k8s/                     #   Kubernetes manifests
│       ├── api-gateway.yml      #   Deploy + Service + HPA
│       └── microservices.yml    #   All services
│
├── test/
│   ├── load-test.js             #   k6 load test script
│   └── README.md                #   Test documentation
│
├── scripts/                     #   Automation scripts
│
├── docker-compose.dev.yml       #   Development environment
├── docker-compose.yml           #   Production template
├── init-databases.sql           #   Create auth_db, booking_db, ride_db
└── init.sql                     #   Legacy schema
```

---

## 14. Xử Lý Sự Cố (Troubleshooting)

### Container không khởi động

```bash
# Xem log lỗi chi tiết
docker compose -f docker-compose.dev.yml logs <service-name>

# Ví dụ: xem log auth-service
docker compose -f docker-compose.dev.yml logs auth-service

# Restart một service cụ thể
docker compose -f docker-compose.dev.yml restart auth-service
```

### Kafka chưa sẵn sàng

```bash
# Kafka cần ~30s để khởi động. Nếu services lỗi "ECONNREFUSED kafka:9092":
docker compose -f docker-compose.dev.yml restart ride-service booking-service notification-service
```

### Database migration lỗi

```bash
# Kiểm tra database đã tạo chưa
docker exec -it <postgres-container> psql -U taxi -l

# Chạy lại migration thủ công
docker exec -it <postgres-container> psql -U taxi -d auth_db -f /docker-entrypoint-initdb.d/...
```

### Port bị chiếm

```bash
# Kiểm tra port đang dùng
lsof -i :8000   # macOS/Linux
netstat -ano | findstr :8000   # Windows

# Kill process chiếm port
kill -9 <PID>
```

### Frontend không kết nối API

1. Đảm bảo API Gateway đang chạy: `curl http://localhost:8000/health`
2. Kiểm tra CORS: API Gateway đã cấu hình `cors()` cho tất cả origins (dev mode)
3. Kiểm tra biến `.env` trong `taxi-fe/`

### Redis/Postgres connection refused

```bash
# Kiểm tra container đang chạy
docker ps | grep -E "redis|postgres"

# Nếu không thấy, restart
docker compose -f docker-compose.dev.yml up -d redis postgres
# Đợi 10s rồi restart các service phụ thuộc
docker compose -f docker-compose.dev.yml restart
```

### Xóa sạch và chạy lại từ đầu

```bash
# CẢNH BÁO: Xóa toàn bộ dữ liệu
docker compose -f docker-compose.dev.yml down -v
docker system prune -f
docker compose -f docker-compose.dev.yml up -d --build
```

---

## 15. Danh Sách Test Cases (121 TC)

### Level 1: Basic API (10 TC) ✅

| #  | Test Case       | Mô tả                                   |
| -- | --------------- | ----------------------------------------- |
| 1  | Health Check    | GET /health trả về 200                  |
| 2  | Register        | POST /auth/register tạo tài khoản mới |
| 3  | Login           | POST /auth/login trả về JWT             |
| 4  | Token Refresh   | POST /auth/refresh                        |
| 5  | Create Booking  | POST /bookings tạo booking mới          |
| 6  | Booking Status  | Status khởi tạo = REQUESTED             |
| 7  | Driver Location | POST /drivers/me/location cập nhật GPS |
| 8  | Driver Status   | POST /drivers/me/status ONLINE/OFFLINE   |
| 9  | Price Calculate | POST /pricing/estimate tính giá        |
| 10 | Ride Status     | GET /rides/:id trả về ride info         |

### Level 2: Validation & Error Handling (10 TC) ✅

| #  | Test Case           | Mô tả                                |
| -- | ------------------- | -------------------------------------- |
| 11 | Missing Fields      | 400 khi thiếu required fields         |
| 12 | Invalid Coordinates | 422 cho lat/lng sai kiểu              |
| 13 | Unauthorized        | 401 khi không có JWT                 |
| 14 | Invalid Payment     | 400 khi payment method không hợp lệ |
| 15 | Duplicate Register  | 409 khi email đã tồn tại           |
| 16 | Rate Limiting       | 429 khi vượt quá request limit      |
| 17 | Invalid Token       | 401 cho JWT sai/hết hạn              |
| 18 | Driver Not Found    | 404 cho driver không tồn tại        |
| 19 | Booking Not Found   | 404 cho booking không tồn tại       |
| 20 | Payload Too Large   | 413 cho request vượt 1 MB             |

### Level 3: Integration & Data Flow (10 TC)

| #  | Test Case        | Mô tả                                     |
| -- | ---------------- | ------------------------------------------- |
| 21 | Booking → Kafka | Booking event published khi tạo            |
| 22 | Kafka → Ride    | Ride-service consume booking event          |
| 23 | Multi-driver     | Offer gửi cho ≥2 tài xế                 |
| 24 | Driver Accept    | Tài xế nhận chuyến → status thay đổi |
| 25 | Driver Reject    | Tài xế từ chối → offer tiếp theo      |
| 26 | Ride Complete    | Hoàn thành chuyến → COMPLETED           |
| 27 | SSE Events       | Notification via SSE stream                 |
| 28 | Geocoding        | Geo-service trả về địa chỉ             |
| 29 | Payment Flow     | VNPay payment URL + callback                |
| 30 | Review Submit    | POST /reviews tạo đánh giá              |

### Level 4: Transaction & Saga (9 TC)

| #  | Test Case          | Mô tả                                    |
| -- | ------------------ | ------------------------------------------ |
| 31 | Outbox Pattern     | Event published via transactional outbox   |
| 32 | Idempotency        | Duplicate request trả về cùng kết quả |
| 33 | Payment Failed     | PAYMENT_FAILED → booking cancelled        |
| 34 | Driver Timeout     | Offer timeout → next driver               |
| 35 | Saga Compensation  | Lỗi → rollback across services           |
| 36 | Booking Cancel     | Cancel booking → notify driver            |
| 37 | Payment Callback   | VNPay callback → update status            |
| 38 | Concurrent Booking | Race condition handling                    |
| 39 | Dead Letter Queue  | Failed Kafka messages → DLQ               |

### Level 5: AI Services (10 TC)

| #  | Test Case       | Mô tả                              |
| -- | --------------- | ------------------------------------ |
| 41 | ETA Predict     | POST /eta/predict trả về ETA       |
| 42 | ETA Accuracy    | Dự đoán accuracy > 80%            |
| 43 | Fraud Check     | POST /fraud/check scoring            |
| 44 | Fraud Block     | Score > threshold → block           |
| 45 | Surge Pricing   | Dynamic multiplier dựa trên demand |
| 46 | Surge Cap       | Multiplier không vượt quá max    |
| 47 | Feature Store   | ML features cached trong Redis       |
| 48 | Drift Detection | ETA drift z-score monitoring         |
| 49 | Model Version   | GET /eta/model-info version info     |
| 50 | A/B Testing     | Model comparison support             |

### Level 6: AI Agent / MCP (10 TC)

| #  | Test Case       | Mô tả                                 |
| -- | --------------- | --------------------------------------- |
| 51 | Agent Select    | POST /agent/select-driver               |
| 52 | Multi-criteria  | Distance + Rating + ETA + Price scoring |
| 53 | Tool Calling    | POST /agent/call-tool dispatch          |
| 54 | MCP Context     | GET /agent/context                      |
| 55 | Decision Log    | GET /agent/decisions                    |
| 56 | Fallback        | Rule-based khi AI fail                  |
| 57 | Retry Logic     | Exponential backoff                     |
| 58 | Model Info      | GET /agent/model-info                   |
| 59 | Scoring Weights | Configurable W values                   |
| 60 | Agent Health    | GET /agent/health                       |

### Level 7: Performance (4 TC)

| #  | Test Case   | Mô tả                    |
| -- | ----------- | -------------------------- |
| 61 | P95 Latency | < 300ms cho booking API    |
| 62 | Throughput  | ≥ 100 req/s sustained     |
| 63 | Spike       | Handle 3x traffic spike    |
| 64 | Memory      | No memory leaks under load |

### Level 8: Resilience (4 TC)

| #  | Test Case       | Mô tả                      |
| -- | --------------- | ---------------------------- |
| 71 | Circuit Breaker | Open circuit on failures     |
| 72 | Retry           | Retry with backoff           |
| 73 | DLQ             | Dead Letter Queue processing |
| 74 | Data Encryption | Sensitive data encrypted     |

### Level 9: Security (7 TC)

| #  | Test Case      | Mô tả                           |
| -- | -------------- | --------------------------------- |
| 75 | JWT Auth       | Token-based authentication        |
| 76 | RBAC           | Role-based access control         |
| 77 | Rate Limit     | API rate limiting                 |
| 78 | Service Auth   | Service-to-service authentication |
| 79 | Admin Only     | Admin-only endpoints              |
| 80 | Input Sanitize | SQL injection prevention          |
| 81 | CORS           | CORS configuration                |

### Level 10: Zero Trust (9 TC)

| #     | Test Case  | Mô tả                                              |
| ----- | ---------- | ---------------------------------------------------- |
| 82-90 | Zero Trust | Verify identity, least privilege, micro-segmentation |

### Level 11: Deployment (8 TC) ✅

| #  | Test Case      | Mô tả                     |
| -- | -------------- | --------------------------- |
| 91 | Docker Build   | Multi-stage Dockerfile      |
| 92 | Docker Compose | Full stack compose          |
| 93 | K8s Deploy     | Kubernetes manifests        |
| 94 | HPA            | Horizontal Pod Autoscaling  |
| 95 | Rolling Update | Zero-downtime deployment    |
| 96 | Health Check   | Liveness & Readiness probes |
| 97 | Resource Limit | CPU/Memory limits           |
| 98 | Secrets        | K8s secrets management      |

### Level 12: Monitoring & Observability (7 TC) ✅

| #   | Test Case      | Mô tả                          |
| --- | -------------- | -------------------------------- |
| 111 | Metrics        | Prometheus metrics exposed       |
| 112 | Logging        | Structured JSON logging          |
| 113 | Dashboard      | Grafana dashboard provisioned    |
| 114 | Alerting       | Prometheus alert rules           |
| 115 | Tracing        | Distributed tracing (X-Trace-Id) |
| 116 | Error Tracking | Error rate monitoring            |
| 117 | SLA Monitor    | P95/P99 latency tracking         |

---

## Tóm Tắt Nhanh

```bash
# 1. Clone project
git clone <repo-url> && cd Car-booking-backend-main

# 2. (Tùy chọn) Đổi Geoapify key trong docker-compose.dev.yml

# 3. Khởi động
docker compose -f docker-compose.dev.yml up -d

# 4. Đợi ~60s rồi kiểm tra
curl http://localhost:8000/health

# 5. Mở trình duyệt
# Frontend:  http://localhost:5173
# PgAdmin:   http://localhost:5050
# Kafka UI:  http://localhost:8080

# 6. Đăng ký tài khoản trên giao diện và sử dụng!
```

---

> **Tài liệu tham khảo thêm:**
>
> - `report/README.md` — Feature showcase & architecture diagrams
> - `report/QUICK_START_AUTH.md` — Auth service quick start
> - `report/TESTING.md` — Comprehensive testing guide
> - `report/TROUBLESHOOTING.md` — Common issues & fixes
> - `test/CHEAT_SHEET.md` — Quick curl command reference
> - `FIX_DRIVER_MATCH.md` — Driver matching algorithm documentation
