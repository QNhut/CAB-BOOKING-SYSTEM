# Quick Start: Auth Service Integration

## 1. Start Auth Service

```powershell
# Start all services (including auth)
docker compose -f docker-compose.dev.yml up -d

# Verify auth service is running
docker logs taxi_auth_dev

# Check health
curl http://localhost:8001/health
```

## 2. Test Auth Service

```powershell
# Run automated tests
.\test\test-auth-service.ps1
```

## 3. Manual Testing

### Register User

```powershell
$user = Invoke-RestMethod -Method Post -Uri "http://localhost:8001/auth/register" `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"identifier":"user@test.com","password":"pass123","role":"USER","userId":"u1"}'

$accessToken = $user.accessToken
$refreshToken = $user.refreshToken
```

### Register Driver

```powershell
$driver = Invoke-RestMethod -Method Post -Uri "http://localhost:8001/auth/register" `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"identifier":"driver@test.com","password":"pass123","role":"DRIVER","driverId":"d1"}'

$driverToken = $driver.accessToken
```

### Use Token in API Calls

```powershell
# Get user info
Invoke-RestMethod -Uri "http://localhost:8001/auth/me" `
  -Headers @{"Authorization"="Bearer $accessToken"}

# Call other services with token (after integration)
Invoke-RestMethod -Method Post -Uri "http://localhost:8003/bookings" `
  -Headers @{
    "Authorization"="Bearer $accessToken"
    "Content-Type"="application/json"
  } `
  -Body '{"pickup":{"lat":10.77,"lng":106.70},"dropoff":{"lat":10.78,"lng":106.71},"vehicleType":"CAR_4"}'
```

## 4. Database Setup (First Time Only)

If databases don't exist:

```powershell
# Stop containers
docker compose -f docker-compose.dev.yml down

# Remove postgres volume to trigger init script
docker volume rm car-booking_postgres_data

# Start again (will run init-databases.sql)
docker compose -f docker-compose.dev.yml up -d postgres

# Wait for postgres to be ready
Start-Sleep -Seconds 10

# Verify databases created
docker exec -i taxi_postgres psql -U taxi -l
```

Should see:

- `auth_db` ✅
- `booking_db` ✅
- `ride_db` ✅
- `taxi_main` ✅

## 5. Integration Steps

### Step 1: Add Middleware to Services

**booking-service/index.js:**

```javascript
import { authMiddleware, requireRole } from "../../shared/auth-middleware.js";

// Before (MVP)
app.post("/bookings", (req, res) => {
  const userId = req.header("x-user-id");  // ❌ Insecure
  // ...
});

// After (Auth)
app.post("/bookings", authMiddleware, requireRole("USER"), (req, res) => {
  const userId = req.auth.userId;  // ✅ From verified JWT
  // ...
});
```

**driver-service/src/index.js:**

```javascript
import { authMiddleware, requireRole } from "../../../shared/auth-middleware.js";

app.post("/drivers/me/status", authMiddleware, requireRole("DRIVER"), (req, res) => {
  const driverId = req.auth.driverId;  // ✅ From JWT
  // ...
});
```

**ride-service/index.js:**

```javascript
import { authMiddleware, requireRole } from "../../shared/auth-middleware.js";

app.post("/rides/:rideId/driver/accept", authMiddleware, requireRole("DRIVER"), (req, res) => {
  const driverId = req.auth.driverId;  // ✅ From JWT
  // ...
});
```

**notification-service/src/index.js:**

```javascript
import { authMiddleware } from "../../../shared/auth-middleware.js";

// SSE endpoint with token in query
app.get("/notifications/stream", authMiddleware, (req, res) => {
  const { userId, driverId, role } = req.auth;
  
  // Auto-subscribe based on role
  if (role === "USER" && userId) {
    userClients.set(userId, res);
  } else if (role === "DRIVER" && driverId) {
    driverClients.set(driverId, res);
  }
});
```

### Step 2: Update Frontend

**Create login.html:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Login - Taxi App</title>
</head>
<body>
  <h1>Login</h1>
  
  <form id="loginForm">
    <input type="email" id="identifier" placeholder="Email" required>
    <input type="password" id="password" placeholder="Password" required>
    <select id="role">
      <option value="USER">User</option>
      <option value="DRIVER">Driver</option>
    </select>
    <button type="submit">Login</button>
  </form>
  
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
    
      const identifier = document.getElementById('identifier').value;
      const password = document.getElementById('password').value;
      const role = document.getElementById('role').value;
    
      try {
        const res = await fetch('http://localhost:8001/auth/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            identifier,
            password,
            userId: role === 'USER' ? 'u1' : undefined,
            driverId: role === 'DRIVER' ? 'd1' : undefined
          })
        });
      
        const data = await res.json();
      
        if (res.ok) {
          // Store tokens
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          localStorage.setItem('role', data.account.role);
        
          // Redirect
          if (role === 'USER') {
            window.location.href = 'testbooking.html';
          } else {
            window.location.href = 'driver.html';
          }
        } else {
          alert('Login failed: ' + data.error);
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  </script>
</body>
</html>
```

**Update testbooking.html:**

```javascript
// Add at top of script
const accessToken = localStorage.getItem('accessToken');
if (!accessToken) {
  window.location.href = 'login.html';
}

// Update API calls to include Authorization header
async function createBooking() {
  const res = await fetch('http://localhost:8003/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`  // ✅ Add token
      // Remove 'x-user-id': 'u1'  ❌
    },
    body: JSON.stringify({...})
  });
}

// Update SSE connection
const eventSource = new EventSource(
  `http://localhost:8007/notifications/stream?token=${accessToken}`
);
```

**Update driver.html:**

```javascript
// Add at top
const accessToken = localStorage.getItem('accessToken');
if (!accessToken) {
  window.location.href = 'login.html';
}

// Update API calls
async function setStatus() {
  const res = await fetch('http://localhost:8004/drivers/me/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`  // ✅
      // Remove 'x-driver-id': 'd1'  ❌
    },
    body: JSON.stringify({...})
  });
}

// Update SSE
const eventSource = new EventSource(
  `http://localhost:8007/notifications/stream?token=${accessToken}`
);
```

### Step 3: Add JWT_SECRET to All Services

Update **docker-compose.dev.yml**:

```yaml
services:
  booking-service:
    environment:
      JWT_SECRET: dev-secret-change-in-production-please  # Add this
    
  driver-service:
    environment:
      JWT_SECRET: dev-secret-change-in-production-please  # Add this
    
  ride-service:
    environment:
      JWT_SECRET: dev-secret-change-in-production-please  # Add this
    
  notification-service:
    environment:
      JWT_SECRET: dev-secret-change-in-production-please  # Add this
```

## 6. Verify Integration

```powershell
# 1. Login and get token
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:8001/auth/login" `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"identifier":"user@test.com","password":"pass123","userId":"u1"}'

$token = $login.accessToken

# 2. Use token to call booking service
Invoke-RestMethod -Method Post -Uri "http://localhost:8003/bookings" `
  -Headers @{
    "Authorization"="Bearer $token"
    "Content-Type"="application/json"
  } `
  -Body '{"pickup":{"lat":10.77,"lng":106.70},"dropoff":{"lat":10.78,"lng":106.71},"vehicleType":"CAR_4","estimatedPrice":50000}'
```

Should work without `x-user-id` header! ✅

## 7. Troubleshooting

### Issue: "auth_db does not exist"

```powershell
# Recreate databases
docker compose -f docker-compose.dev.yml down
docker volume rm car-booking_postgres_data
docker compose -f docker-compose.dev.yml up -d postgres
```

### Issue: "Invalid token"

Check JWT_SECRET is same across all services:

```powershell
docker exec taxi_auth_dev sh -c 'echo $JWT_SECRET'
docker exec taxi_booking_dev sh -c 'echo $JWT_SECRET'
```

Should be identical.

### Issue: "No token provided"

Make sure frontend sends:

- Header: `Authorization: Bearer <token>`
- Or Query: `?token=<token>` (for SSE)

### Issue: Service can't find auth-middleware

```powershell
# Check shared folder is mounted
docker exec taxi_booking_dev ls -la /app/../../../shared/
```

Should see `auth-middleware.js`.

## 8. Rollback to MVP (If Needed)

If something breaks, you can temporarily disable auth:

```javascript
// Comment out authMiddleware
// app.post("/bookings", authMiddleware, async (req, res) => {
app.post("/bookings", async (req, res) => {
  // Use old headers temporarily
  const userId = req.header("x-user-id");
  // ...
});
```

## 9. Production Checklist

Before going to production:

- [ ] Change JWT_SECRET to strong random value
- [ ] Set JWT_ACCESS_TTL to appropriate value (default 900s ok)
- [ ] Enable HTTPS/TLS
- [ ] Add rate limiting to /auth/login
- [ ] Set CORS whitelist (not `*`)
- [ ] Increase BCRYPT_ROUNDS to 12
- [ ] Add password complexity requirements
- [ ] Enable email/phone verification
- [ ] Add 2FA (optional)
- [ ] Monitor login_audit table
- [ ] Set up alerts for failed login spikes
- [ ] Regular token cleanup (delete revoked tokens > 7 days old)

---

**Quick Start Time**: 10-15 minutes
**Full Integration Time**: 1-2 hours
