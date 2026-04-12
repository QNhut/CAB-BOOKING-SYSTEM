# ✅ Driver State Auto-Restore Feature

## Tính năng đã implement:

### Backend (Driver Service)
1. **TTL 30 phút**: State và location tồn tại 30 phút (1800 giây)
   - `STATE_TTL_SEC = 1800` 
   - `HB_TTL_SEC = 1800`

2. **API GET /drivers/me** - Lấy trạng thái hiện tại:
   ```json
   {
     "driverId": "xxx",
     "status": "ONLINE" | "OFFLINE" | "BUSY",
     "vehicleType": "CAR_4" | "CAR_7",
     "location": { "lat": 10.77, "lng": 106.7 },
     "isActive": true,
     "ttlSec": 1800
   }
   ```

3. **POST /drivers/me/status** - Cập nhật với TTL:
   - ONLINE/BUSY: Set state key với `EX: 1800` (30 phút)
   - OFFLINE: Xóa khỏi geo index và heartbeat

### Frontend (DriverDashboard)

1. **Auto-restore on mount**:
   ```tsx
   useEffect(() => {
     async function loadPreviousState() {
       const data = await getMyDriverState();
       // Restore status, vehicleType, location
     }
   }, [token]);
   ```

2. **Console log** để debug:
   ```
   📦 Restored driver state: { status: "ONLINE", vehicleType: "CAR_4", ... }
   ```

## Cách test:

### Test 1: State Persistence
1. Login driver dashboard
2. Set ONLINE + chọn xe CAR_4
3. Cập nhật vị trí GPS
4. **Refresh trang** (Ctrl+R)
5. ✅ Kiểm tra: Status vẫn là ONLINE, vehicleType vẫn là CAR_4, location vẫn hiển thị

### Test 2: TTL Expiration
1. Set driver ONLINE
2. Chờ 30 phút (hoặc set STATE_TTL_SEC=60 để test nhanh)
3. Refresh trang
4. ✅ Kiểm tra: State đã reset về OFFLINE

### Test 3: Manual OFFLINE
1. Set driver ONLINE
2. Click OFFLINE button
3. Refresh trang
4. ✅ Kiểm tra: Status vẫn là OFFLINE (không restore ONLINE)

## Browser Console Logs:

Khi refresh trang, bạn sẽ thấy:
```
📦 Restored driver state: {
  driverId: "d09b0673-f054-4d4a-bb3f-14aac5a0436a",
  status: "ONLINE",
  vehicleType: "CAR_4",
  location: { lat: 10.775, lng: 106.7 },
  isActive: true,
  ttlSec: 1800
}
```

## Redis Keys:

- `driver:state:{driverId}` - TTL 1800s
- `driver:vehicle:{driverId}` - Permanent
- `driver:hb:{driverId}` - TTL 1800s
- `geo:drivers:CAR_4` - Geo index (sorted set)

## Environment Variables:

```env
STATE_TTL_SEC=1800  # 30 minutes
HB_TTL_SEC=1800     # 30 minutes
```

Để test với thời gian ngắn hơn trong dev, thêm vào `.env`:
```env
STATE_TTL_SEC=120   # 2 minutes for testing
HB_TTL_SEC=120
```
