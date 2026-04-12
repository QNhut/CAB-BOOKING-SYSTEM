# Taxi Booking Platform - Microservices Architecture

Event-driven microservices platform for taxi booking with real-time driver matching, multi-driver offers, and comprehensive observability.

## 🚀 Features

- ✅ **Real-time Booking**: SSE-based live updates for users and drivers
- ✅ **Smart Driver Matching**: Proximity-based driver selection with configurable radius
- ✅ **Multi-Driver Offers**: Sequential offer system with reject/timeout handling
- ✅ **JWT Authentication**: Secure access & refresh token management with role-based access control
- ✅ **Event-Driven Architecture**: Kafka-based event streaming with Transactional Outbox pattern
- ✅ **Payment Integration**: VNPay payment gateway integration
- ✅ **Observability**: Centralized logging, metrics, and distributed tracing

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          API Gateway (8000)                          │
│                   Route management & Load balancing                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│ Auth Service   │  │ User Service    │  │ Driver Service │
│ (8001)         │  │ (8005)          │  │ (8004)         │
│ JWT, RBAC      │  │ User profiles   │  │ Driver status  │
└────────────────┘  └─────────────────┘  └────────────────┘

┌────────────────┐  ┌─────────────────┐  ┌────────────────┐
│ Booking Svc    │  │ Ride Service    │  │ Pricing Svc    │
│ (8003)         │  │ (8006)          │  │ (8002)         │
│ Create booking │  │ Ride lifecycle  │  │ Price calc     │
└───────┬────────┘  └────────┬────────┘  └────────────────┘
        │                    │
        └──────────┬─────────┘
                   │ Kafka Events
        ┌──────────▼─────────────┐
        │ Notification Service    │
        │ (8007)                  │
        │ SSE + Event consumers   │
        └─────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│               Infrastructure Services                     │
├──────────────┬──────────────┬──────────────┬─────────────┤
│ PostgreSQL   │ Redis        │ Kafka        │ Zookeeper   │
│ (5432)       │ (6379)       │ (9092)       │ (2181)      │
│ Multi-DB     │ Cache/Geo    │ Event Stream │ Coordination│
└──────────────┴──────────────┴──────────────┴─────────────┘
```

## 📁 Project Structure

```
car-booking/
├── services/                       # Microservices
│   ├── auth-service/              # Authentication & Authorization
│   │   ├── index.js               # JWT, bcrypt, refresh tokens
│   │   ├── migrations/            # Database schema
│   │   └── README.md              # API docs
│   ├── booking-service/           # Booking management
│   │   ├── index.js              
│   │   ├── kafka.js               # Event producer
│   │   ├── outbox-worker.js       # Transactional outbox
│   │   └── migrations/
│   ├── driver-service/            # Driver management
│   ├── ride-service/              # Ride lifecycle
│   ├── pricing-service/           # Dynamic pricing
│   ├── user-service/              # User profiles
│   ├── notification-service/      # SSE + Push notifications
│   ├── payment-service/           # VNPay integration
│   └── review-service/            # Reviews & ratings
│
├── api-gateway/                   # Routing & load balancing
│   └── src/
│       └── index.js
│
├── frontend/                      # Test UIs
│   ├── testbooking.html          # User booking interface
│   └── driver.html               # Driver app interface
│
├── shared/                        # Shared libraries
│   ├── auth-middleware.js        # JWT verification middleware
│   └── libs/
│
├── test/                          # Test scripts
│   ├── test-auth-service.ps1     # Auth end-to-end tests
│   ├── test-multi-driver-*.ps1   # Multi-driver scenarios
│   └── debug-driver.ps1          # Driver matching debug
│
├── scripts/                       # DevOps scripts
│   ├── setup.sh
│   ├── deploy.sh
│   └── init-kafka-topics.sh
│
├── infra/                         # Infrastructure as Code
│   └── k8s/                      # Kubernetes manifests
│
├── observability/                 # Monitoring stack
│   ├── grafana/
│   ├── prometheus/
│   └── loki/
│
├── docker-compose.dev.yml         # Development stack
├── init-databases.sql             # Multi-database initialization
├── QUICK_START_AUTH.md           # Auth integration guide
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Docker Desktop (Windows/Mac) or Docker + Docker Compose (Linux)
- PowerShell 5.1+ (Windows) or Bash (Linux/Mac)
- 8GB+ RAM (for all services)

### 1. Clone & Start

```powershell
# Clone repository
git clone <repository-url>
cd car-booking

# Start all services
docker compose -f docker-compose.dev.yml up -d

# Check service health
docker compose -f docker-compose.dev.yml ps
```

### 2. Initialize Kafka Topics

```powershell
# Windows
.\scripts\init-kafka-topics.ps1

# Linux/Mac
bash scripts/init-kafka-topics.sh
```

### 3. Test Auth Service

```powershell
.\test\test-auth-service.ps1
```

### 4. Access UIs

- **User Booking**: http://localhost/testbooking.html
- **Driver App**: http://localhost/driver.html
- **API Gateway**: http://localhost:8000

## 📡 Service Ports

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 8000 | Main entry point |
| Auth Service | 8001 | JWT authentication |
| Pricing Service | 8002 | Price calculation |
| Booking Service | 8003 | Booking management |
| Driver Service | 8004 | Driver status & location |
| User Service | 8005 | User profiles |
| Ride Service | 8006 | Ride lifecycle |
| Notification Service | 8007 | SSE streams |
| Payment Service | 8008 | VNPay integration |
| Review Service | 8009 | Reviews & ratings |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache & geospatial |
| Kafka | 9092 | Event streaming |

## 🔑 Authentication Flow

The platform uses JWT-based authentication with refresh token rotation:

```
1. Register/Login → Get access token (15min) + refresh token (30 days)
2. Use access token in Authorization: Bearer <token>
3. Before token expires → Call /auth/refresh with refresh token
4. Get new access + refresh tokens (old refresh token revoked)
5. On logout → Revoke refresh token
```

**User Registration:**
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8001/auth/register" `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"identifier":"user@test.com","password":"pass123","role":"USER","userId":"u1"}'
```

**Driver Registration:**
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8001/auth/register" `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"identifier":"driver@test.com","password":"pass123","role":"DRIVER","driverId":"d1"}'
```

**Login:**
```powershell
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:8001/auth/login" `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"identifier":"user@test.com","password":"pass123","userId":"u1"}'

$token = $login.accessToken
```

See [services/auth-service/README.md](services/auth-service/README.md) for full API documentation.

## 🎯 Key Workflows

### 1. User Books Ride

```
User (testbooking.html) → POST /bookings → Booking Service
  → Calculate price (Pricing Service)
  → Find nearby drivers (Redis GEORADIUS)
  → Emit BookingCreated event (Kafka)
  → Notification Service sends offer to Driver #1 (SSE)
```

### 2. Driver Rejects → Next Driver Offered

```
Driver #1 → POST /bookings/{id}/reject → Booking Service
  → Emit OfferRejected event (Kafka)
  → Notification Service sends offer to Driver #2 (SSE)
```

### 3. Driver Accepts → Ride Starts

```
Driver #2 → POST /bookings/{id}/accept → Booking Service
  → Create ride (Ride Service)
  → Emit BookingAccepted + RideCreated events
  → Notify user "Driver accepted" (SSE)
```

### 4. Complete Ride → Payment

```
Driver → POST /rides/{id}/complete → Ride Service
  → Calculate final price
  → Update ride status
  → Emit RideCompleted event
  → Payment Service processes payment
```

## 🧪 Testing

### Automated Tests

```powershell
# Auth service end-to-end
.\test\test-auth-service.ps1

# Multi-driver offer scenarios
.\test\test-multi-driver-case-a.ps1  # Case 17.1 & 17.2
.\test\test-multi-driver-case-b.ps1  # Case 17.3 & 17.4
.\test\test-multi-driver-case-c.ps1  # Case 17.5
```

### Manual Testing

**Scenario: Book ride with 2 drivers**

1. **Setup Driver #1:**
   - Open http://localhost/driver.html
   - Set Driver ID: `d1`
   - Click "Go Online" (lat: 10.762622, lng: 106.660172)

2. **Setup Driver #2:**
   - Open http://localhost/driver.html (incognito)
   - Set Driver ID: `d2`
   - Click "Go Online" (lat: 10.764, lng: 106.661)

3. **Create Booking (User):**
   - Open http://localhost/testbooking.html
   - User ID: `u1`
   - Pickup: Same as Driver #1
   - Click "Create Booking"
   - Driver #1 receives offer (SSE event)

4. **Test Reject Flow:**
   - Driver #1 clicks "Reject"
   - Driver #2 receives offer (SSE event)

5. **Test Accept Flow:**
   - Driver #2 clicks "Accept"
   - User sees "Driver accepted" status

### Debug Tools

```powershell
# Check driver locations in Redis
.\test\debug-driver.ps1

# View Kafka events
docker exec -i taxi_kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic booking-events \
  --from-beginning

# Check database state
docker exec -i taxi_postgres psql -U taxi -d booking_db \
  -c "SELECT * FROM bookings ORDER BY created_at DESC LIMIT 5"
```

## 🗄️ Database Schema

The platform uses separate databases per service:

- **auth_db**: accounts, refresh_tokens, login_audit
- **booking_db**: bookings, outbox_events
- **ride_db**: rides
- **taxi_main**: users, drivers, payment_transactions, reviews

See `services/*/migrations/` for detailed schemas.

## 🔧 Environment Variables

Key configuration (see `docker-compose.dev.yml`):

```yaml
# Auth Service
JWT_SECRET: dev-secret-change-in-production-please
JWT_ACCESS_TTL: 900          # 15 minutes
JWT_REFRESH_TTL: 2592000     # 30 days
BCRYPT_ROUNDS: 10

# Booking Service
DRIVER_SEARCH_RADIUS: 3000   # meters
OFFER_TIMEOUT: 30000         # 30 seconds
MAX_OFFER_ATTEMPTS: 3

# Pricing Service
BASE_FARE: 10000             # VND
PER_KM_RATE: 5000            # VND
SURGE_MULTIPLIER: 1.0
```

## 📚 Documentation

- **Auth Service**: [services/auth-service/README.md](services/auth-service/README.md)
- **Quick Start**: [QUICK_START_AUTH.md](QUICK_START_AUTH.md)
- **Multi-Driver Tests**: [test/MULTI_DRIVER_TEST_GUIDE.md](test/MULTI_DRIVER_TEST_GUIDE.md)

## 🚀 Deployment

### Development

```powershell
# Start all services
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f booking-service

# Restart service after code change
docker compose -f docker-compose.dev.yml restart booking-service
```

### Production (Kubernetes)

```bash
# Apply K8s manifests
kubectl apply -f infra/k8s/

# Check pods
kubectl get pods -n taxi-platform

# View logs
kubectl logs -f deployment/booking-service -n taxi-platform
```

## 🔒 Security

**Implemented:**
- ✅ bcrypt password hashing (cost: 10)
- ✅ JWT with signature verification (HS256)
- ✅ Refresh token rotation (old tokens revoked)
- ✅ Token stored as SHA-256 hash (not plaintext)
- ✅ Role-based access control (USER/DRIVER/ADMIN)
- ✅ Login audit trail (IP, user agent, success/failure)

**Recommended for Production:**
- 🔒 Use RS256 instead of HS256 (public/private key pair)
- 🔒 Enable HTTPS/TLS
- 🔒 Add rate limiting to auth endpoints
- 🔒 Increase bcrypt rounds to 12
- 🔒 Implement password complexity requirements
- 🔒 Add email/phone verification
- 🔒 Enable 2FA (optional)
- 🔒 Set CORS whitelist (not `*`)

## 🐛 Troubleshooting

### "auth_db does not exist"

```powershell
docker compose -f docker-compose.dev.yml down
docker volume rm car-booking_postgres_data
docker compose -f docker-compose.dev.yml up -d postgres
Start-Sleep -Seconds 10
docker compose -f docker-compose.dev.yml up -d
```

### "Driver not matched"

Check coordinates match:
```powershell
.\test\debug-driver.ps1
```

Driver location must be within 3km of pickup location.

### "No SSE events received"

1. Check notification service logs:
   ```powershell
   docker logs taxi_notification_dev
   ```

2. Verify Kafka consumer connected:
   ```powershell
   docker logs taxi_notification_dev | Select-String "Consumer subscribed"
   ```

3. Check event produced:
   ```powershell
   docker exec taxi_kafka kafka-console-consumer.sh \
     --bootstrap-server localhost:9092 \
     --topic booking-events --from-beginning
   ```

## 📄 License

MIT

## 👥 Contributors

- Your Team

---

**Quick Start Time**: 10 minutes  
**Full Platform Setup**: 1-2 hours including auth integration
