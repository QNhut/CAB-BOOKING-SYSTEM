# Auth Service

Complete authentication & authorization service for taxi platform.

## Features

✅ **User Registration & Login** (email/phone + password)  
✅ **JWT Access Tokens** (15 min TTL, short-lived)  
✅ **Refresh Tokens** (30 days TTL, rotation on refresh)  
✅ **Role-Based Access Control** (USER, DRIVER, ADMIN)  
✅ **Password Security** (bcrypt hashing, cost 10)  
✅ **Token Revocation** (logout invalidates refresh tokens)  
✅ **Login Audit Trail** (track login attempts, IP, device)  
✅ **Account Management** (active/disabled status)  

## Database: auth_db

### Tables

**accounts**
- `id` UUID (PK)
- `identifier` TEXT UNIQUE (email or phone)
- `password_hash` TEXT
- `role` ENUM (USER, DRIVER, ADMIN)
- `status` ENUM (ACTIVE, DISABLED)
- `created_at`, `updated_at`

**refresh_tokens**
- `id` UUID (PK)
- `account_id` UUID (FK → accounts)
- `token_hash` TEXT UNIQUE (SHA-256)
- `expires_at` TIMESTAMPTZ
- `revoked_at` TIMESTAMPTZ
- `device_id`, `ip`, `user_agent`
- `created_at`

**login_audit**
- `id` UUID (PK)
- `account_id` UUID (FK)
- `identifier` TEXT
- `success` BOOLEAN
- `ip`, `user_agent`, `failure_reason`
- `created_at`

## API Endpoints

### Public Endpoints

#### POST /auth/register
Register new account.

**Request:**
```json
{
  "identifier": "user@example.com",
  "password": "password123",
  "role": "USER",
  "userId": "u1"  // Optional, for USER role
}
```

**Response:**
```json
{
  "account": {
    "id": "uuid",
    "identifier": "user@example.com",
    "role": "USER",
    "status": "ACTIVE"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "abc123...",
  "expiresIn": 900
}
```

#### POST /auth/login
Login with credentials.

**Request:**
```json
{
  "identifier": "user@example.com",
  "password": "password123",
  "userId": "u1"  // Optional, for USER role
}
```

**Response:**
```json
{
  "account": {
    "id": "uuid",
    "identifier": "user@example.com",
    "role": "USER",
    "status": "ACTIVE"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "abc123...",
  "expiresIn": 900
}
```

#### POST /auth/refresh
Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "abc123..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "xyz789...",  // New refresh token (rotation)
  "expiresIn": 900
}
```

#### POST /auth/logout
Logout and revoke refresh token.

**Request:**
```json
{
  "refreshToken": "abc123..."
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Logged out successfully"
}
```

### Protected Endpoints

#### GET /auth/me
Get current authenticated user info.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "account": {
    "id": "uuid",
    "identifier": "user@example.com",
    "role": "USER",
    "status": "ACTIVE",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "auth": {
    "userId": "u1",
    "driverId": null
  }
}
```

### Internal Endpoints

#### POST /internal/verify
Verify JWT token (optional, services can verify themselves).

**Request:**
```json
{
  "token": "eyJhbGc..."
}
```

**Response:**
```json
{
  "valid": true,
  "accountId": "uuid",
  "role": "USER",
  "userId": "u1",
  "driverId": null
}
```

### Health Check

#### GET /health
```json
{
  "ok": true,
  "service": "auth-service"
}
```

## JWT Token Structure

### Access Token (JWT)

**Claims:**
```json
{
  "iss": "taxi-auth-service",
  "aud": "taxi-platform",
  "sub": "account-uuid",
  "role": "USER",
  "userId": "u1",      // If role is USER
  "driverId": "d1",    // If role is DRIVER
  "iat": 1234567890,
  "exp": 1234568790
}
```

**TTL:** 15 minutes (900 seconds)

### Refresh Token

**Format:** Random 128-character hex string  
**Storage:** SHA-256 hash in database  
**TTL:** 30 days (2592000 seconds)  
**Rotation:** New token issued on each refresh, old token revoked  

## Environment Variables

```env
PORT=8001
DATABASE_URL=postgres://taxi:taxi_pass@postgres:5432/auth_db
JWT_SECRET=your-secret-key-change-in-production
JWT_ACCESS_TTL=900          # 15 minutes
JWT_REFRESH_TTL=2592000     # 30 days
BCRYPT_ROUNDS=10            # bcrypt cost factor
```

## Integration with Other Services

### 1. Add JWT Middleware

Use shared middleware in other services:

```javascript
import { authMiddleware, requireRole } from "../../shared/auth-middleware.js";

// Require authentication
app.post("/api/bookings", authMiddleware, async (req, res) => {
  const userId = req.auth.userId;  // From JWT
  // ...
});

// Require specific role
app.post("/drivers/me/location", authMiddleware, requireRole("DRIVER"), async (req, res) => {
  const driverId = req.auth.driverId;  // From JWT
  // ...
});
```

### 2. SSE with Token

For Server-Sent Events (EventSource doesn't support Authorization header):

```javascript
// Client-side
const token = localStorage.getItem("accessToken");
const eventSource = new EventSource(`/notifications/stream?token=${token}`);

// Server-side
app.get("/notifications/stream", authMiddleware, (req, res) => {
  const { userId, driverId, role } = req.auth;
  // Subscribe to correct channel based on role
});
```

### 3. Remove Legacy Headers

After auth integration, remove:
- ❌ `x-user-id`
- ❌ `x-driver-id`

Use JWT claims instead:
- ✅ `req.auth.userId`
- ✅ `req.auth.driverId`

## Security Best Practices

### Implemented ✅

- Password hashing with bcrypt (cost 10)
- Refresh token stored as hash (not plain text)
- Token rotation on refresh
- Login audit trail
- JWT with issuer/audience claims
- Role-based access control
- Account status (active/disabled)

### Recommended for Production 🔒

- HTTPS only (TLS/SSL)
- Rate limiting on /auth/login (prevent brute force)
- CORS whitelist (not `*`)
- Password complexity requirements (min 8 chars, uppercase, numbers, symbols)
- Email/SMS verification
- Two-factor authentication (2FA)
- IP whitelisting for admin
- Session management (concurrent login limits)
- Token blacklist (for immediate revocation)
- Key rotation schedule
- Use RS256 instead of HS256 (public/private key pair)

## Testing

### Manual Test Script

```powershell
# 1. Register User
$register = Invoke-RestMethod -Method Post -Uri "http://localhost:8001/auth/register" `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"identifier":"user1@test.com","password":"pass123","role":"USER","userId":"u1"}'

$accessToken = $register.accessToken
$refreshToken = $register.refreshToken

# 2. Get current user
Invoke-RestMethod -Uri "http://localhost:8001/auth/me" `
  -Headers @{"Authorization"="Bearer $accessToken"}

# 3. Refresh token
$refreshed = Invoke-RestMethod -Method Post -Uri "http://localhost:8001/auth/refresh" `
  -Headers @{"Content-Type"="application/json"} `
  -Body "{`"refreshToken`":`"$refreshToken`"}"

$newAccessToken = $refreshed.accessToken
$newRefreshToken = $refreshed.refreshToken

# 4. Logout
Invoke-RestMethod -Method Post -Uri "http://localhost:8001/auth/logout" `
  -Headers @{"Content-Type"="application/json"} `
  -Body "{`"refreshToken`":`"$newRefreshToken`"}"

# 5. Health check
Invoke-RestMethod -Uri "http://localhost:8001/health"
```

### Register Driver

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8001/auth/register" `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"identifier":"driver1@test.com","password":"pass123","role":"DRIVER","driverId":"d1"}'
```

## Migration Guide

### Before (MVP with headers)

```javascript
// Old way - trusting client-provided ID
app.post("/bookings", (req, res) => {
  const userId = req.header("x-user-id");  // ❌ Not secure
  // ...
});
```

### After (Auth with JWT)

```javascript
import { authMiddleware } from "../../shared/auth-middleware.js";

// New way - JWT verified by middleware
app.post("/bookings", authMiddleware, (req, res) => {
  const userId = req.auth.userId;  // ✅ From verified JWT
  const role = req.auth.role;      // ✅ Cannot be spoofed
  // ...
});
```

## Database Queries

### Check accounts
```sql
SELECT id, identifier, role, status, created_at 
FROM accounts 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check refresh tokens
```sql
SELECT rt.id, a.identifier, rt.expires_at, rt.revoked_at, rt.created_at
FROM refresh_tokens rt
JOIN accounts a ON rt.account_id = a.id
ORDER BY rt.created_at DESC
LIMIT 10;
```

### Check login attempts
```sql
SELECT identifier, success, ip, failure_reason, created_at
FROM login_audit
ORDER BY created_at DESC
LIMIT 20;
```

### Revoke all user's tokens
```sql
UPDATE refresh_tokens 
SET revoked_at = now()
WHERE account_id = '<account-id>'
AND revoked_at IS NULL;
```

## Architecture

```
┌─────────────┐
│   Client    │
│ (Browser/   │
│  Mobile)    │
└──────┬──────┘
       │ POST /auth/login
       │ {identifier, password}
       ▼
┌─────────────┐
│ Auth Service│
│ Port 8001   │
└──────┬──────┘
       │ 1. Verify password (bcrypt)
       │ 2. Issue JWT + Refresh Token
       │ 3. Log audit trail
       ▼
┌─────────────┐
│  auth_db    │
│ (Postgres)  │
└─────────────┘

┌─────────────┐
│   Client    │
│ has token   │
└──────┬──────┘
       │ GET /bookings
       │ Authorization: Bearer <token>
       ▼
┌─────────────┐
│Booking Svc  │──────► Verify JWT locally
│ Port 8003   │        (no call to auth-service)
└──────┬──────┘
       │ req.auth = {userId, role}
       │ Create booking with verified userId
       ▼
```

## Checklist: Integration Steps

- [ ] Add auth-service to docker-compose
- [ ] Create auth_db database
- [ ] Run auth service migrations
- [ ] Test register/login endpoints
- [ ] Add authMiddleware to booking-service
- [ ] Add authMiddleware to driver-service
- [ ] Add authMiddleware to ride-service
- [ ] Add authMiddleware to notification-service (SSE)
- [ ] Update frontend: login page
- [ ] Update frontend: store tokens in localStorage
- [ ] Update frontend: add Authorization header to API calls
- [ ] Update frontend: SSE with ?token=... query
- [ ] Remove x-user-id and x-driver-id headers
- [ ] Test end-to-end flows
- [ ] Production: HTTPS, rate limiting, CORS whitelist

---

**Service Owner**: Auth Team  
**Port**: 8001  
**Database**: auth_db  
**Dependencies**: Postgres
