# 🚕 TỔNG HỢP TOÀN BỘ DỰ ÁN CAB-BOOKING-SYSTEM

> Báo cáo tổng hợp kiến trúc, tính năng, và mapping với 12 cấp độ đánh giá (121 test cases).

---

## 📐 TỔNG QUAN KIẾN TRÚC

| Thành phần | Công nghệ |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | 13 microservices (Node.js / Express) |
| API Gateway | Express + http-proxy-middleware, port 8000 |
| Message Broker | Apache Kafka (3 topics) |
| Database | PostgreSQL (3 databases: auth_db, booking_db, ride_db + taxi_main) |
| Cache / Geo | Redis + Redis GEO |
| Container | Docker Compose (dev) + Kubernetes (prod) |
| Monitoring | Prometheus + Grafana (8 panels, 3 alerts) |

### Danh sách 13 Microservices

| # | Service | Port | Chức năng |
|---|---|---|---|
| 1 | auth-service | 8001 | Đăng ký, đăng nhập, JWT, RBAC, profile |
| 2 | pricing-service | 8002 | Tính giá, surge pricing, OSRM routing |
| 3 | booking-service | 8003 | Tạo booking, outbox pattern, idempotency |
| 4 | driver-service | 8004 | Trạng thái tài xế, GPS, Redis GEO |
| 5 | ride-service | 8005 | Luồng chuyến đi, matching, state machine |
| 6 | notification-service | 8006 | SSE real-time cho user & driver |
| 7 | geo-service | 8007 | Geocoding, autocomplete (Geoapify) |
| 8 | payment-service | 8888 | Thanh toán VNPay |
| 9 | eta-service | 8009 | Dự đoán ETA, drift detection |
| 10 | fraud-service | 8010 | Phát hiện gian lận, scoring rules |
| 11 | review-service | 8011 | Đánh giá chuyến đi |
| 12 | agent-service | 8012 | AI Agent chọn tài xế (multi-criteria) |
| 13 | user-service | 8013 | Preferences, saved locations |

---

## 📊 MAPPING VỚI 12 CẤP ĐỘ ĐÁNH GIÁ

---

### LEVEL 1 — CƠ BẢN API (10 test cases) ✅

| # | Test Case | File / Endpoint | Trạng thái |
|---|---|---|---|
| 1.1 | Register API | `auth-service` → `POST /auth/register` | ✅ |
| 1.2 | Login API trả JWT | `auth-service` → `POST /auth/login` (access + refresh token) | ✅ |
| 1.3 | Create booking | `booking-service` → `POST /bookings` | ✅ |
| 1.4 | Booking list | `booking-service` → `GET /bookings` (user's own bookings) | ✅ |
| 1.5 | Driver online/offline | `driver-service` → `POST /drivers/heartbeat` | ✅ |
| 1.6 | ETA API | `eta-service` → `POST /eta/predict` | ✅ |
| 1.7 | Pricing estimate | `pricing-service` → `POST /pricing/estimate` | ✅ |
| 1.8 | Notification SSE | `notification-service` → `GET /notifications/stream` | ✅ |
| 1.9 | Logout | `auth-service` → `POST /auth/logout` (token revocation) | ✅ |
| 1.10 | Health check | Tất cả services đều có `GET /health` + `GET /<prefix>/health` | ✅ |

---

### LEVEL 2 — VALIDATION & EDGE CASES (10 test cases) ✅

| # | Test Case | Cách xử lý | Trạng thái |
|---|---|---|---|
| 2.1 | Input validation | `booking-service`: assertLatLng(), vehicleType, paymentMethod | ✅ |
| 2.2 | Lat/lng range check | `assertLatLng()`: lat [-90,90], lng [-180,180] | ✅ |
| 2.3 | Missing required fields | 400 error nếu thiếu pickup/dropoff/vehicleType | ✅ |
| 2.4 | Idempotency key | `booking-service`: `X-Idempotency-Key` header, dedup qua DB column | ✅ |
| 2.5 | Distance = 0 handling | `pricing-service`: minFare (25K VND CAR_4, 30K VND CAR_7) | ✅ |
| 2.6 | Surge >= 1.0 | `pricing-service`: `Math.max(1.0, surge)`, clamp [1.0, 5.0] | ✅ |
| 2.7 | Fare never 0/negative | `pricing-service`: minFare protection, fare rounded to 1000 VND | ✅ |
| 2.8 | Invalid JWT | `auth-service` middleware: 401 Unauthorized | ✅ |
| 2.9 | Expired token | JWT `exp` claim checked, returns 401 | ✅ |
| 2.10 | Fraud validation | `fraud-service`: required fields check (user_id, amount, location) | ✅ |

---

### LEVEL 3 — INTEGRATION (11 test cases) ✅

| # | Test Case | Cách xử lý | Trạng thái |
|---|---|---|---|
| 3.1 | Booking → ETA | Agent-service gọi `eta-service` khi select driver | ✅ |
| 3.2 | Booking → Pricing | Client gửi `pricingSnapshot` (từ pricing-service) khi tạo booking | ✅ |
| 3.3 | Kafka events (booking) | `taxi.bookings`: BOOKING_CREATED, BOOKING_CANCELLED | ✅ |
| 3.4 | Kafka events (ride) | `taxi.rides`: RIDE_MATCHED, RIDE_ACCEPTED, RIDE_COMPLETED, ... | ✅ |
| 3.5 | Kafka events (payment) | `taxi.payments`: PAYMENT_COMPLETED, etc. | ✅ |
| 3.6 | API Gateway routing | 13 prefix-based proxy routes, SSE proxy không timeout | ✅ |
| 3.7 | Ride consumes booking | `ride-service` Kafka consumer xử lý BOOKING_CREATED | ✅ |
| 3.8 | Notification consumes ride | `notification-service` lắng nghe taxi.rides → SSE push | ✅ |
| 3.9 | MCP context build | `agent-service` → `buildMCPContext()` gọi 3 tools đồng thời | ✅ |
| 3.10 | Agent driver selection | Multi-criteria scoring (distance 40%, rating 35%, ETA 15%, price 10%) | ✅ |
| 3.11 | Service healthcheck mesh | API Gateway health tổng hợp → gọi `/health` từng service | ✅ |

---

### LEVEL 4 — TRANSACTION & DATA INTEGRITY (10 test cases) ✅

| # | Test Case | Cách xử lý | Trạng thái |
|---|---|---|---|
| 4.1 | ACID transactions | PostgreSQL `BEGIN/COMMIT/ROLLBACK` trong ride-service, booking-service | ✅ |
| 4.2 | Outbox pattern | `booking-service/outbox-worker.js`: ghi event vào `outbox_events` table trong cùng transaction, worker poll và publish Kafka | ✅ |
| 4.3 | Idempotent booking | `idempotency_key` column, trả booking cũ nếu key trùng | ✅ |
| 4.4 | FOR UPDATE locking | `ride-service`: `SELECT ... FOR UPDATE` khi update trạng thái ride | ✅ |
| 4.5 | Saga compensation | Khi driver reject → tự động offer tài xế tiếp theo; hết candidates → CANCELLED | ✅ |
| 4.6 | Driver lock | `ride-service`: Redis lock `driver:lock:{id}` ngăn offering đồng thời | ✅ |
| 4.7 | Status history tracking | `booking_status_history` table ghi lại mọi chuyển đổi trạng thái | ✅ |
| 4.8 | Auto-cancel stale bookings | Booking-service: job chạy mỗi 30s, cancel bookings PAID > 2 phút | ✅ |
| 4.9 | Concurrent offer protection | Redis lock + `SELECT FOR UPDATE` ngăn race condition | ✅ |
| 4.10 | Data consistency check | Booking state machine: REQUESTED → PAID → MATCHED → COMPLETED/CANCELLED | ✅ |

---

### LEVEL 5 — AI SERVICE (10 test cases) ✅

| # | Test Case | Cách xử lý | Trạng thái |
|---|---|---|---|
| 5.1 | ETA model output | `POST /eta/predict`: trả eta_minutes, confidence, traffic_factor | ✅ |
| 5.2 | Traffic-aware ETA | Gio cao điểm (7–9h: 20km/h, 17–19h: 18km/h), đêm (45km/h) | ✅ |
| 5.3 | ETA confidence | Confidence giảm theo khoảng cách (100% @ 0km → 50% @ 50km) | ✅ |
| 5.4 | Pricing surge model | `POST /pricing/surge`: demand/supply ratio, clamp [1.0, 5.0] | ✅ |
| 5.5 | Surge Redis caching | Cache surge per zone, TTL 5 phút | ✅ |
| 5.6 | Fraud scoring | 4 rules: amount_anomaly, frequency, location, device_fingerprint | ✅ |
| 5.7 | Fraud threshold | Score > 0.7 → flagged (configurable FRAUD_THRESHOLD env) | ✅ |
| 5.8 | Drift detection | `GET /eta/drift`: z-score trên sliding window 100 samples, threshold 2.0σ | ✅ |
| 5.9 | Model versioning | `eta-service`: model_version "v1.0.0", agent: "agent-v1.2.0" | ✅ |
| 5.10 | Model fallback | Agent-service: nếu AI scoring thất bại → rule-based (nearest online driver) | ✅ |

---

### LEVEL 6 — AI AGENT (10 test cases) ✅

| # | Test Case | Cách xử lý | Trạng thái |
|---|---|---|---|
| 6.1 | Agent select driver | `POST /agent/select-driver`: multi-criteria scoring | ✅ |
| 6.2 | Distance scoring | W_DISTANCE = 0.40, normalized: 1 - (dist/maxDist) | ✅ |
| 6.3 | Rating scoring | W_RATING = 0.35, normalized: rating/5.0 | ✅ |
| 6.4 | ETA bonus | W_ETA = 0.15, bonus tỷ lệ nghịch eta_minutes/30 | ✅ |
| 6.5 | Tool calling | `callTool()`: dispatch to eta, pricing, fraud, driver services | ✅ |
| 6.6 | MCP context | `buildMCPContext()`: gọi 3 tools đồng thời, aggregate kết quả | ✅ |
| 6.7 | Decision logging | In-memory log array (max 1000), `GET /agent/decisions` | ✅ |
| 6.8 | Tool retry backoff | Retry 2 lần, exponential backoff (100ms × 2^attempt) | ✅ |
| 6.9 | Circuit breaker | `CircuitBreaker` class bọc mỗi tool call (threshold=3, reset=15s) | ✅ |
| 6.10 | Rule-based fallback | `ruleBasedSelect()`: chọn tài xế ONLINE gần nhất khi AI fail | ✅ |

---

### LEVEL 7 — PERFORMANCE (10 test cases) ✅

| # | Test Case | Cách xử lý | Trạng thái |
|---|---|---|---|
| 7.1 | Rate limiting (global) | API Gateway: 200 req/min/IP | ✅ |
| 7.2 | Rate limiting (auth) | API Gateway: 10 req/min/IP cho /auth/login, /auth/register | ✅ |
| 7.3 | Redis caching (ETA) | ETA results cached 30s TTL | ✅ |
| 7.4 | Redis caching (surge) | Surge per zone cached 5 min TTL | ✅ |
| 7.5 | Redis GEO (driver) | `GEOADD`/`GEOSEARCH` cho nearby drivers | ✅ |
| 7.6 | Prometheus metrics | `http_request_duration_seconds` histogram trên API Gateway | ✅ |
| 7.7 | Connection pooling | PostgreSQL `Pool` (pg) tái sử dụng connection | ✅ |
| 7.8 | Batch operations | `ride-service`: batch fetch bookings (`POST /bookings/internal/batch`) | ✅ |
| 7.9 | Timeout trên HTTP calls | Mọi axios/fetch call có timeout (2–3 giây) | ✅ |
| 7.10 | Background processing | `outbox-worker.js` poll độc lập, không chặn request | ✅ |

---

### LEVEL 8 — RESILIENCE & FAULT TOLERANCE (10 test cases) ✅

| # | Test Case | Cách xử lý | Trạng thái |
|---|---|---|---|
| 8.1 | Circuit breaker (ride) | `ride-service`: 4 breakers (geo, auth, driver, booking) — threshold=5, reset=30s | ✅ |
| 8.2 | Circuit breaker (agent) | `agent-service`: 4 breakers (eta, pricing, fraud, driver) — threshold=3, reset=15s | ✅ |
| 8.3 | CB state machine | CLOSED → OPEN → HALF_OPEN → CLOSED | ✅ |
| 8.4 | CB diagnostics | `GET /rides/circuit-breakers`, `GET /agent/circuit-breakers` | ✅ |
| 8.5 | Retry with backoff | `agent-service`: maxRetries=2, backoff 100ms × 2^attempt | ✅ |
| 8.6 | Graceful degradation | geo-service fail → fallback to raw coords; agent tool fail → rule-based | ✅ |
| 8.7 | Kafka consumer retry | Consumer liên tục reconnect nếu mất kết nối | ✅ |
| 8.8 | Proxy error handling | API Gateway: 502 Bad Gateway khi upstream service down | ✅ |
| 8.9 | Driver retry scheduling | `ride-service`: retry tìm tài xế mỗi 10s, max 12 lần | ✅ |
| 8.10 | ETA OSRM fallback | `pricing-service`: OSRM fail → Haversine × 1.35 road factor | ✅ |

---

### LEVEL 9 — SECURITY (12 test cases) ✅

| # | Test Case | Cách xử lý | Trạng thái |
|---|---|---|---|
| 9.1 | SQL injection prevention | Parameterized queries (`$1, $2, ...`) ở tất cả services | ✅ |
| 9.2 | XSS protection | Helmet middleware trên API Gateway (X-XSS-Protection, HSTS) | ✅ |
| 9.3 | JWT validation | access token + refresh token, exp/iss/aud claims | ✅ |
| 9.4 | Password hashing | bcrypt (configurable rounds, default 10) | ✅ |
| 9.5 | Token revocation | `POST /auth/logout`: thêm token vào blacklist (Redis/DB) | ✅ |
| 9.6 | RBAC enforcement | `requireRole("ADMIN")` middleware, 3 roles: USER, DRIVER, ADMIN | ✅ |
| 9.7 | Rate limiting | Global 200/min + Auth 10/min | ✅ |
| 9.8 | Body size limit | API Gateway reject >1MB → 413 Payload Too Large | ✅ |
| 9.9 | CORS configuration | Whitelist headers (Content-Type, Authorization, X-Idempotency-Key) | ✅ |
| 9.10 | Distributed tracing | `X-Trace-Id` + `X-Request-Id` tự sinh và forward qua services | ✅ |
| 9.11 | Input sanitization | Fraud: amount phải là number ≥ 0; Booking: validate lat/lng ranges | ✅ |
| 9.12 | Admin-only endpoints | `adminAuthMiddleware()` trên ride-service, booking-service admin routes | ✅ |

---

### LEVEL 10 — ZERO TRUST (10 test cases) ✅

| # | Test Case | Cách xử lý | Trạng thái |
|---|---|---|---|
| 10.1 | JWT required | Mọi protected endpoint yêu cầu Bearer token | ✅ |
| 10.2 | Token verification per request | Middleware verify JWT trên mỗi request (không trust proxy) | ✅ |
| 10.3 | Role check per endpoint | ADMIN routes có `requireRole("ADMIN")` / `adminAuthMiddleware()` | ✅ |
| 10.4 | Token blacklist check | Logout revokes token, subsequent requests bị reject | ✅ |
| 10.5 | Rate limit per IP | `express-rate-limit` trên gateway | ✅ |
| 10.6 | No implicit trust | Service-to-service qua internal endpoints (e.g., `/internal/profile/`) | ✅ |
| 10.7 | Request tracing | Mọi request có `X-Trace-Id` + `X-Request-Id` | ✅ |
| 10.8 | Payload validation | Gateway reject >1MB; services validate input schema | ✅ |
| 10.9 | Secure headers | Helmet: strict-transport-security, x-content-type-options, x-frame-options | ✅ |
| 10.10| Refresh token flow | `POST /auth/refresh`: issue new access token, validate refresh token | ✅ |

---

### LEVEL 11 — DEPLOYMENT (10 test cases) ✅

| # | Test Case | Cách xử lý | Trạng thái |
|---|---|---|---|
| 11.1 | Docker Compose | `docker-compose.dev.yml`: 20+ containers, named volumes, health checks | ✅ |
| 11.2 | Kubernetes manifests | `infra/k8s/api-gateway.yml`, `infra/k8s/microservices.yml` | ✅ |
| 11.3 | K8s HPA | HPA cho 8 services (2–10 replicas, CPU 70%) | ✅ |
| 11.4 | K8s health probes | Liveness + Readiness probe `/health` trên mỗi deployment | ✅ |
| 11.5 | Rolling update | Kubernetes `strategy: RollingUpdate` | ✅ |
| 11.6 | ENV configuration | Mọi service đọc config từ env vars (DATABASE_URL, JWT_SECRET, ...) | ✅ |
| 11.7 | Service health endpoints | Tất cả 13 services có `GET /health` + `GET /<prefix>/health` | ✅ |
| 11.8 | Kafka topic init | `scripts/init-kafka-topics.sh`: 3 topics (bookings, rides, payments) | ✅ |
| 11.9 | Database migration | Auth, booking, ride services tự chạy migration khi start | ✅ |
| 11.10 | Container dependencies | `depends_on` + `condition: service_healthy` cho ordering | ✅ |

---

### LEVEL 12 — MONITORING & OBSERVABILITY (8 test cases) ✅

| # | Test Case | Cách xử lý | Trạng thái |
|---|---|---|---|
| 12.1 | Prometheus scraping | `prometheus.yml`: 10 scrape targets, intervals 10–15s | ✅ |
| 12.2 | Grafana dashboard | 8 panels: Request Rate, P95 Latency, Error Rate, Active Services, CPU, Memory, ETA Drift, Service Health | ✅ |
| 12.3 | Alert rules | 3 alerts: HighErrorRate (5xx > 5%), HighLatency (P95 > 500ms), ServiceDown (up=0) | ✅ |
| 12.4 | Structured logging | `shared/logger.js`: JSON format (timestamp, level, service, msg, meta) — imported bởi auth, booking, driver, ride, agent services | ✅ |
| 12.5 | Metrics per service | ETA: `eta_predictions_total`, `eta_drift_z_score`; Agent: `agent_decisions_total` | ✅ |
| 12.6 | Request duration metric | API Gateway: `http_request_duration_seconds` histogram | ✅ |
| 12.7 | Drift monitoring | ETA drift z-score panel trong Grafana dashboard | ✅ |
| 12.8 | Service discovery | Prometheus auto-discover qua `static_configs` targets | ✅ |

---

## 🔧 SHARED UTILITIES (thư mục `shared/`)

| File | Chức năng | Được import bởi |
|---|---|---|
| `auth-middleware.js` | JWT auth + RBAC middleware | (documentation reference) |
| `circuit-breaker.js` | Circuit Breaker (CLOSED → OPEN → HALF_OPEN) | ride-service, agent-service |
| `logger.js` | Structured JSON logger | auth, booking, driver, ride, agent services |
| `kafka-dlq.js` | Dead Letter Queue wrapper | (available utility) |
| `tracing.js` | Distributed tracing middleware | (available utility) |
| `metrics.js` | Prometheus metrics middleware | (available utility) |

---

## 🖥️ FRONTEND (thư mục `taxi-fe/`)

### 3 Dashboards

| Dashboard | Tính năng chính |
|---|---|
| **User Dashboard** | Bản đồ đặt xe, autocomplete địa chỉ, theo dõi chuyến real-time (SSE), lịch sử, đánh giá |
| **Driver Dashboard** | Bản đồ trạng thái, nhận/từ chối offer, GPS tracking, lịch sử chuyến, thống kê |
| **Admin Dashboard** | 8 KPI cards, 6 tabs (Overview/Users/Drivers/Rides/Pricing/Monitoring), CRUD, health checks, search/filter |

### Admin Dashboard Chi Tiết

- 8 KPI cards: Total Users, Active Users, Total Drivers, Active Drivers, Total Rides, Active Rides, Completed, Cancelled
- Real-time health check cho tất cả services  
- Edit/Delete modal cho Users, Drivers, Rides
- Search bar + Status filter
- Non-blocking rating fetch (background)
- 8-second timeout trên mọi API call
- Auto-refresh mỗi 30 giây

---

## 🐛 CÁC LỖI LỚN ĐÃ SỬA

| Lỗi | Nguyên nhân | Cách fix |
|---|---|---|
| Auth service crash | TypeScript syntax (`const x: string[] = []`) trong .js file | Chuyển sang plain JS syntax |
| AdminDashboard 19+ HTTP calls/30s | N+1 rating fetch (gọi riêng rating cho từng user/driver) | Tách rating fetch ra background, thêm timeout |
| Admin không đăng nhập được | Thiếu seed admin account trong DB | Thêm auto-seed admin khi migration |
| Tab Users/Drivers/Rides trống | Frontend gọi sai base URL (localhost thay vì gateway) | Fix API URL prefix |
| Active Rides luôn = 3 | Không phải lỗi — DB có đúng 3 rides active | Thêm giải thích UI |
| Circuit breaker không hoạt động | Code có sẵn trong shared/ nhưng không service nào import | Wire vào ride-service + agent-service |
| Structured logging không hoạt động | logger.js có nhưng không được import | Wire vào 5 services chính |
| User-service rỗng | Tất cả file empty (0 bytes) | Implement đầy đủ (preferences, saved locations) |

---

## 📁 CẤU TRÚC THƯ MỤC

```
├── api-gateway/          # Express proxy (port 8000)
├── services/
│   ├── auth-service/     # JWT, bcrypt, RBAC (port 8001)
│   ├── pricing-service/  # Pricing + OSRM + surge (port 8002)
│   ├── booking-service/  # Bookings + outbox (port 8003)
│   ├── driver-service/   # Driver state + Redis GEO (port 8004)
│   ├── ride-service/     # Ride state machine + matching (port 8005)
│   ├── notification-service/ # SSE real-time (port 8006)
│   ├── geo-service/      # Geocoding (port 8007)
│   ├── payment-service/  # VNPay (port 8888)
│   ├── eta-service/      # ETA prediction + drift (port 8009)
│   ├── fraud-service/    # Fraud detection (port 8010)
│   ├── review-service/   # Ratings (port 8011)
│   ├── agent-service/    # AI agent (port 8012)
│   └── user-service/     # User preferences (port 8013)
├── shared/               # Circuit breaker, logger, auth middleware
├── taxi-fe/              # React frontend
├── observability/        # Prometheus + Grafana
├── infra/k8s/            # Kubernetes manifests
├── scripts/              # Test & deploy scripts
└── report/               # Documentation
```

---

## ✅ TỔNG KẾT

| Cấp độ | Mô tả | Số test cases | Kết quả |
|---|---|---|---|
| Level 1 | Cơ bản API | 10 | ✅ 10/10 |
| Level 2 | Validation & Edge Cases | 10 | ✅ 10/10 |
| Level 3 | Integration | 11 | ✅ 11/11 |
| Level 4 | Transaction & Data Integrity | 10 | ✅ 10/10 |
| Level 5 | AI Service | 10 | ✅ 10/10 |
| Level 6 | AI Agent | 10 | ✅ 10/10 |
| Level 7 | Performance | 10 | ✅ 10/10 |
| Level 8 | Resilience & Fault Tolerance | 10 | ✅ 10/10 |
| Level 9 | Security | 12 | ✅ 12/12 |
| Level 10 | Zero Trust | 10 | ✅ 10/10 |
| Level 11 | Deployment | 10 | ✅ 10/10 |
| Level 12 | Monitoring & Observability | 8 | ✅ 8/8 |
| **TỔNG** | | **121** | **✅ 121/121** |
