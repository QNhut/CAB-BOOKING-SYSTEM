# 🌐 Hướng Dẫn Chạy Demo Trên Web

> Tài liệu hướng dẫn từng bước cách sử dụng giao diện web (frontend) của hệ thống đặt xe **GoRide** — bao gồm phía **khách hàng**, **tài xế** và **quản trị viên**.

---

## Mục Lục

1. [Khởi động hệ thống](#1-khởi-động-hệ-thống)
2. [Trang chủ &amp; Đăng ký tài khoản](#2-trang-chủ--đăng-ký-tài-khoản)
3. [Demo phía Khách hàng — Đặt xe](#3-demo-phía-khách-hàng--đặt-xe)
4. [Demo phía Tài xế — Nhận chuyến](#4-demo-phía-tài-xế--nhận-chuyến)
5. [Chạy Full Flow (Khách + Tài xế cùng lúc)](#5-chạy-full-flow-khách--tài-xế-cùng-lúc)
6. [Demo thanh toán VNPay](#6-demo-thanh-toán-vnpay)
7. [Demo Đánh giá &amp; Lịch sử](#7-demo-đánh-giá--lịch-sử)
8. [Demo trang Admin](#8-demo-trang-admin)
9. [Demo SSE Realtime Events](#9-demo-sse-realtime-events)
10. [Các trang &amp; đường dẫn URL](#10-các-trang--đường-dẫn-url)
11. [Mẹo khi demo](#11-mẹo-khi-demo)

---

## 1. Khởi Động Hệ Thống

### Bước 1 — Chạy backend (Docker Compose)

```bash
cd Car-booking-backend-main
docker compose -f docker-compose.dev.yml up -d
```

Đợi ~60 giây, kiểm tra:

```bash
curl http://localhost:8000/health
# → {"ok":true,"service":"api-gateway","upstreams":{...}}
```

### Bước 2 — Chạy frontend

```bash
cd taxi-fe
npm install     # lần đầu
npm run dev
```

### Bước 3 — Mở trình duyệt

```
http://localhost:5173
```

> **Tip demo**: Mở **2 cửa sổ trình duyệt** cạnh nhau (hoặc 1 Chrome + 1 Incognito) — một bên đăng nhập khách hàng, một bên đăng nhập tài xế.

---

## 2. Trang Chủ & Đăng Ký Tài Khoản

### 2.1 Trang Splash (Trang chủ)

Khi mở `http://localhost:5173`, bạn sẽ thấy trang chào mừng với 3 slides:

| Slide | Tiêu đề            | Mô tả                                  |
| ----- | --------------------- | ---------------------------------------- |
| 1     | 📱 Book a Ride        | Đặt xe chỉ trong vài giây           |
| 2     | 📍 Track in Real-time | Theo dõi trực tiếp trên bản đồ    |
| 3     | 💳 Easy Payment       | Thanh toán bằng tiền mặt hoặc VNPay |

**Nhấn nút:**

- **Get Started** → Đi tới trang đăng nhập
- **Sign Up** → Đi tới trang đăng ký

---

### 2.2 Đăng ký tài khoản Khách hàng

1. Truy cập `http://localhost:5173/register`
2. Chọn loại tài khoản: **🙋 Passenger**
3. Điền thông tin:

| Trường         | Giá trị mẫu      |
| ---------------- | ------------------- |
| Email/Phone      | `khach1@test.com` |
| Password         | `123456`          |
| Confirm Password | `123456`          |
| Full Name        | `Nguyen Van A`    |
| Phone            | `0901234567`      |

4. Nhấn **Create Account**
5. → Tự động chuyển tới dashboard khách hàng (`/user`)

---

### 2.3 Đăng ký tài khoản Tài xế

1. Mở cửa sổ trình duyệt **khác** (hoặc Incognito)
2. Truy cập `http://localhost:5173/register`
3. Chọn loại tài khoản: **🚗 Driver**
4. Điền thông tin:

| Trường         | Giá trị mẫu      |
| ---------------- | ------------------- |
| Email/Phone      | `taixe1@test.com` |
| Password         | `123456`          |
| Confirm Password | `123456`          |
| Full Name        | `Tran Van B`      |
| Phone            | `0907654321`      |
| Vehicle Type     | 🚗 4-seat Car       |
| License Plate    | `59A-12345`       |
| Driver License   | `DL00001`         |

5. Nhấn **Create Account**
6. → Tự động chuyển tới dashboard tài xế (`/driver`)

---

### 2.4 Đăng ký tài khoản Admin

Đăng ký bình thường nhưng role là ADMIN. Vì giao diện chỉ hiển thị USER/DRIVER, có thể dùng Postman hoặc curl:

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin@test.com",
    "password": "123456",
    "role": "ADMIN"
  }'
```

Sau đó đăng nhập trên web → tự chuyển tới `/admin`.

---

## 3. Demo Phía Khách Hàng — Đặt Xe

> **URL**: `http://localhost:5173/user`
> **Tài khoản**: đăng nhập với role **USER**

### Giao diện Dashboard Khách

```
┌─────────────────────────────────────────────────────────────────┐
│  🚖 Taxi Booking           u_abc12...  🟢 Online  👤  🚪       │
├──────────────────────┬──────────────────────────────────────────┤
│  [Booking Card]      │              [Map View]                  │
│                      │                                          │
│  💳 CASH | VNPAY     │         🗺️ Leaflet Map                  │
│  🚗 CAR_4 | CAR_7    │         🟢 Pickup pin                   │
│                      │         🔴 Dropoff pin                   │
│  📍 Pickup input     │         🔵 Driver pin (khi có)           │
│  📍 Dropoff input    │                                          │
│                      │                                          │
│  [Estimate]          │                                          │
│  💰 150,000₫         │                                          │
│  📏 8.5km • ⏱ 20min  │                                          │
│                      │                                          │
│  [🚖 Book Now]       │                                          │
├──────────────────────┴──────────────────────────────────────────┤
│  [Completed Rides]   [Events Timeline]                          │
└─────────────────────────────────────────────────────────────────┘
```

### Bước 1 — Chọn phương thức thanh toán

- Nhấn **CASH** (tiền mặt) hoặc **VNPAY** (thanh toán online)
- Chọn loại xe: **4-seat Car** hoặc **7-seat Car**

### Bước 2 — Nhập điểm đón

- Gõ vào ô **Pickup Location**, ví dụ: `Ben Thanh`
- → Hệ thống hiển thị gợi ý địa chỉ (autocomplete từ Geoapify)
- Chọn một gợi ý → pin 🟢 xuất hiện trên bản đồ
- Hoặc nhấn nút **📍 Get Location** để dùng GPS trình duyệt

### Bước 3 — Nhập điểm trả

- Gõ vào ô **Dropoff Location**, ví dụ: `Tan Son Nhat`
- Chọn gợi ý → pin 🔴 xuất hiện trên bản đồ

### Bước 4 — Ước tính giá

- Nhấn nút **Estimate**
- → Hiển thị: Giá (₫), Khoảng cách (km), Thời gian (phút)
- Ví dụ: `💰 150,000₫ • 📏 8.5 km • ⏱ 20 phút`

### Bước 5 — Đặt xe

- Nhấn nút **🚖 Book Now**
- → Hiển thị đồng hồ đếm ngược **120 giây** (thời gian chờ tài xế)
- → Nếu chọn VNPAY: tự mở tab mới link thanh toán VNPay sandbox
- Trạng thái: "Searching for driver..."

### Bước 6 — Chờ tài xế nhận chuyến

- Khi tài xế accept → hiển thị:
  - Tên tài xế, số điện thoại
  - Loại xe, biển số
  - Rating tài xế ⭐
  - Pin 🔵 trên bản đồ (vị trí tài xế)
- Timeline events cập nhật realtime:
  - ✅ `RIDE_ACCEPTED` — Tài xế đã nhận
  - ✅ `PASSENGER_PICKED_UP` — Đã đón khách
  - ✅ `RIDE_COMPLETED` — Hoàn thành

### Bước 7 — Chuyến đi hoàn thành

- Chuyến đi xuất hiện trong danh sách **Completed Rides** phía dưới
- Nhấn **Rate** → chuyển tới trang đánh giá

---

## 4. Demo Phía Tài Xế — Nhận Chuyến

> **URL**: `http://localhost:5173/driver`
> **Tài khoản**: đăng nhập với role **DRIVER**

### Giao diện Dashboard Tài Xế

```
┌─────────────────────────────────────────────────────────────────┐
│  🚗 Driver Dashboard    d_abc12...  🟢 Online  📡 Connected    │
├──────────────────────┬──────────────────────────────────────────┤
│  [Control Panel]     │              [Map View]                  │
│                      │                                          │
│  Vehicle: CAR_4  ▼   │         🗺️ Leaflet Map                  │
│                      │                                          │
│  [🟢 Online]         │                                          │
│  [🔴 Offline]        │                                          │
│                      │                                          │
│  📍 Lat: 10.7769     │                                          │
│  📍 Lng: 106.7009    │                                          │
│  [📍 GPS] [🔄 Update]│                                          │
│                      │                                          │
│  ┌───────────────┐   │                                          │
│  │ 🔔 NEW OFFER! │   │                                          │
│  │ Ride: ride_123│   │                                          │
│  │ Fare: 150,000₫│   │                                          │
│  │ ⏱ 25s left    │   │                                          │
│  │ [✅ Accept]   │   │                                          │
│  │ [❌ Reject]   │   │                                          │
│  └───────────────┘   │                                          │
├──────────────────────┴──────────────────────────────────────────┤
│  [Ride History]      [Events Timeline]                          │
└─────────────────────────────────────────────────────────────────┘
```

### Bước 1 — Lên tuyến (Go Online)

1. Chọn **Vehicle Type**: `4-seat Car` hoặc `7-seat Car`
2. Nhấn nút **🟢 Online**
3. → Badge trên header chuyển sang `🟢 Online`
4. → Vị trí mặc định (hoặc GPS trình duyệt) **tự động gửi** lên server → tài xế có thể nhận chuyến ngay

### Bước 2 — Cập nhật vị trí (tuỳ chọn)

> Khi nhấn Online, hệ thống tự gửi tọa độ hiện tại và cố gắng lấy GPS trình duyệt.
> Nếu muốn đổi vị trí thủ công:

- **Cách 1**: Nhấn nút **📍 GPS** → trình duyệt hỏi quyền vị trí → tự lấy tọa độ
- **Cách 2**: Nhập tọa độ thủ công (ví dụ `10.7769`, `106.7009`) → nhấn **🔄 Update Location**

### Bước 3 — Nhận offer chuyến đi

- Khi có khách đặt xe gần vị trí → popup **🔔 NEW OFFER!** xuất hiện
- Thông tin hiển thị:
  - Ride ID
  - Điểm đón & điểm trả
  - Giá cước, khoảng cách
  - Tên & SĐT khách (nếu có)
  - ⏱ Đồng hồ đếm ngược **30 giây**

### Bước 4 — Chấp nhận hoặc từ chối

| Hành động            | Nút         | Kết quả                                        |
| ----------------------- | ------------ | ------------------------------------------------ |
| ✅**Chấp nhận** | Accept Ride  | Chuyển sang Active Ride panel, status → BUSY   |
| ❌**Từ chối**   | Reject Ride  | Offer biến mất, hệ thống tìm tài xế khác |
| ⏱**Hết giờ**   | (tự động) | Offer tự hủy sau 30s, tìm tài xế khác      |

### Bước 5 — Quản lý chuyến đi (sau khi Accept)

Active Ride panel hiển thị: thông tin booking, tuyến đường, thông tin khách.

| Bước                         | Nút                  | Mô tả                                                  |
| ------------------------------ | --------------------- | -------------------------------------------------------- |
| **Đến đón khách**   | **📦 Pickup**   | Nhấn khi đã đến điểm đón → status: PICKED_UP   |
| **Hoàn thành chuyến** | **✅ Complete** | Nhấn khi đã đến điểm trả → chuyến hoàn thành |

### Bước 6 — Sau khi hoàn thành

- Status tự chuyển về **ONLINE**
- Chuyến vừa xong xuất hiện trong **Ride History**
- Sẵn sàng nhận chuyến tiếp theo

---

## 5. Chạy Full Flow (Khách + Tài Xế Cùng Lúc)

> Đây là cách demo ngoạn mục nhất — mở **2 cửa sổ trình duyệt** cạnh nhau.

### Chuẩn bị

```
Cửa sổ trái:  Chrome          → đăng nhập KHÁCH (khach1@test.com)
Cửa sổ phải:  Chrome Incognito → đăng nhập TÀI XẾ (taixe1@test.com)
```

### Kịch bản Demo

| Bước       | Bên        | Thao tác                                                                        | Điều xảy ra                            |
| ------------ | ----------- | -------------------------------------------------------------------------------- | ----------------------------------------- |
| **1**  | 🚗 Tài xế | Chọn CAR_4 → nhấn**Online**                                             | Status: 🟢 Online, vị trí tự gửi     |
| **2**  | 🚗 Tài xế | _(tuỳ chọn)_ Nhấn**📍 GPS** hoặc nhập tọa độ → **Update**     | Cập nhật vị trí chính xác hơn       |
| **3**  | 👤 Khách   | Chọn**CASH**, **CAR_4**                                             | Cấu hình booking                        |
| **4**  | 👤 Khách   | Gõ pickup:`Ben Thanh` → chọn gợi ý                                        | Pin 🟢 trên map                          |
| **5**  | 👤 Khách   | Gõ dropoff:`Tan Son Nhat` → chọn gợi ý                                    | Pin 🔴 trên map                          |
| **6**  | 👤 Khách   | Nhấn**Estimate**                                                          | Hiện giá: 150,000₫                     |
| **7**  | 👤 Khách   | Nhấn**🚖 Book Now**                                                       | Đếm ngược 120s bắt đầu             |
| **8**  | 🚗 Tài xế | _(đợi 2-3s)_ → **🔔 NEW OFFER** popup xuất hiện!                    | Thông tin chuyến hiển thị             |
| **9**  | 🚗 Tài xế | Nhấn**✅ Accept Ride**                                                    | Popup biến mất, Active Ride xuất hiện |
| **10** | 👤 Khách   | _(tự động)_ Đếm ngược dừng → hiển thị **thông tin tài xế** | Tên, SĐT, xe, biển số, ⭐             |
| **11** | 🚗 Tài xế | Nhấn**📦 Pickup**                                                         | Status: PICKED_UP                         |
| **12** | 👤 Khách   | _(tự động)_ Timeline cập nhật: "Passenger Picked Up"                      | Trạng thái thay đổi                   |
| **13** | 🚗 Tài xế | Nhấn**✅ Complete**                                                       | Chuyến hoàn thành                      |
| **14** | 👤 Khách   | _(tự động)_ Timeline: "Ride Completed"                                      | Nút "Rate" xuất hiện                   |
| **15** | 👤 Khách   | Nhấn**Rate** → chọn ⭐⭐⭐⭐⭐ → "Tuyệt vời!" → **Submit**    | Đánh giá thành công                  |

> 💡 Mọi thay đổi đều cập nhật **đồng thời** trên cả 2 màn hình nhờ SSE realtime!

---

## 6. Demo Thanh Toán VNPay

### Kịch bản

1. **Khách** chọn phương thức: **VNPAY** (thay vì CASH)
2. Nhấn **🚖 Book Now**
3. → Tự mở **tab mới** với trang thanh toán VNPay sandbox

### Trên trang VNPay Sandbox

4. Chọn ngân hàng: **NCB**
5. Nhập thông tin thẻ test:

| Trường                  | Giá trị               |
| ------------------------- | ----------------------- |
| **Số thẻ**        | `9704198526191432198` |
| **Tên chủ thẻ**  | `NGUYEN VAN A`        |
| **Ngày hết hạn** | `07/15`               |
| **OTP**             | `123456`              |

6. Nhấn **Thanh toán**
7. → Redirect về `http://localhost:5173/payment/return`
8. → Trang hiển thị kết quả: **Thanh toán thành công ✅**
9. Trên dashboard khách, SSE event `payment` xuất hiện

---

## 7. Demo Đánh Giá & Lịch Sử

### 7.1 Xem lịch sử chuyến đi

1. Trên dashboard khách, nhấn **History** (hoặc truy cập `/user/history`)
2. Danh sách hiển thị:

```
┌──────────────────────────────────────────────┐
│ 🟢 COMPLETED                     08/04/2026  │
│ 📍 Ben Thanh Market → Tan Son Nhat Airport   │
│ 🚗 4-seat Car                                │
│ 💰 150,000₫                                  │
│                              [⭐ Rate]        │
└──────────────────────────────────────────────┘
```

3. Mỗi chuyến có:
   - Badge trạng thái (🟢 COMPLETED, 🔴 CANCELLED, 🟡 PENDING)
   - Địa chỉ đón/trả
   - Loại xe & giá cước
   - Nút **Rate** nếu chưa đánh giá

### 7.2 Đánh giá chuyến đi

1. Nhấn **⭐ Rate** trên chuyến đã hoàn thành
2. → Chuyển tới `/user/rating/:rideId`

```
┌──────────────────────────────────────────┐
│          Rate Your Ride                  │
│                                          │
│     ☆  ☆  ☆  ☆  ☆                       │
│     (nhấn vào sao để chọn rating)        │
│                                          │
│  Comment:                                │
│  ┌──────────────────────────────────┐    │
│  │ Tài xế lịch sự, đúng giờ!      │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Tip for driver:                         │
│  [5,000₫] [10,000₫] [20,000₫]  [    ]  │
│                                          │
│  [⭐ Submit Review]                      │
└──────────────────────────────────────────┘
```

3. Chọn **5 sao** ⭐⭐⭐⭐⭐
4. Nhập comment: `Tài xế lịch sự, đúng giờ!`
5. Chọn tip: **10,000₫** (hoặc nhập số tùy ý)
6. Nhấn **Submit Review**
7. → Thông báo thành công → tự chuyển về History sau 1.5 giây

---

## 8. Demo Trang Admin

> **URL**: `http://localhost:5173/admin`
> **Tài khoản**: đăng nhập với role **ADMIN**

### Giao diện Admin

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │                                                      │
│ 📊 Overview │  [KPI Cards]                                     │
│ 👥 Users │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│ 🚗 Drivers│  │ Users   │ │ Drivers │ │ Rides   │ │ Revenue  │  │
│ 🚕 Rides │  │  25     │ │  12     │ │  158    │ │ 15.2M₫   │  │
│ 💰 Pricing│  └─────────┘ └─────────┘ └─────────┘ └──────────┘  │
│ 📡 Monitor│                                                     │
│          │  [System Health]                                     │
│          │  ✅ API Gateway    ✅ Auth Service                   │
│ [Logout] │  ✅ Booking        ✅ Driver Service                 │
│          │  ✅ Ride Service   ✅ Kafka                          │
└──────────┴──────────────────────────────────────────────────────┘
```

### Tab Overview (Tổng quan)

- **KPI Cards**: Tổng users, tổng tài xế, tổng chuyến, chuyến đang hoạt động, doanh thu, rating trung bình
- **System Health**: Trạng thái từng service (✅ Healthy / ❌ Down)
- **Quick Actions**: Nút tắt đến các tab khác

### Tab Users (Quản lý người dùng)

Bảng hiển thị:

| ID      | Email/Phone     | Name         | Phone      | Created    |
| ------- | --------------- | ------------ | ---------- | ---------- |
| acc_123 | khach1@test.com | Nguyen Van A | 0901234567 | 08/04/2026 |

### Tab Drivers (Quản lý tài xế)

Tương tự tab Users, lọc theo role DRIVER.

### Tab Rides (Quản lý chuyến đi)

Bảng hiển thị tất cả rides:

| Ride ID  | Booking | Driver | Status    | Pickup        | Dropoff       | Fare      |
| -------- | ------- | ------ | --------- | ------------- | ------------- | --------- |
| ride_123 | bk_456  | d1     | COMPLETED | 10.77, 106.70 | 10.82, 106.63 | 150,000₫ |

### Tab Pricing (Cấu hình surge)

1. Nhập **Zone**: `district1`
2. Nhập **Multiplier**: `2.0` (giá gấp đôi)
3. Nhấn **Apply Surge**
4. → Tất cả booking mới trong zone `district1` sẽ bị tính surge pricing

### Tab Monitoring

- Liên kết đến Prometheus UI và Grafana dashboard
- Thông tin metrics cơ bản

---

## 9. Demo SSE Realtime Events

### Xem Events Timeline trên giao diện

Cả dashboard khách và tài xế đều có phần **Events Timeline** ở phía dưới:

```
[Events Timeline]
├─ 10:05:32  ✅ RIDE_ACCEPTED      { rideId: "ride_123", driverId: "d1" }
├─ 10:07:15  📦 PASSENGER_PICKED_UP { rideId: "ride_123" }
├─ 10:15:42  🏁 RIDE_COMPLETED     { rideId: "ride_123", fare: 150000 }
└─ (nhấn vào event để xem JSON chi tiết)
```

### Badge kết nối SSE

- **🟢 Online** / **📡 Connected** — SSE đang hoạt động
- **🔴 Offline** / **⚠️ Reconnecting** — Mất kết nối (tự reconnect)

### Danh sách events theo role

**Events khách hàng nhận:**

| Event                   | Ý nghĩa                           | Hiển thị                      |
| ----------------------- | ----------------------------------- | ------------------------------- |
| `ride_accepted`       | Tài xế đã nhận chuyến         | Thông tin tài xế xuất hiện |
| `passenger_picked_up` | Đã đón khách                   | Status đổi thành PICKED_UP   |
| `ride_completed`      | Chuyến hoàn thành                | Chuyến vào Completed list     |
| `booking_cancelled`   | Hủy (hết giờ tìm tài xế)      | Thông báo lý do              |
| `ride_cancelled`      | Tài xế hủy                       | Thông báo                     |
| `payment`             | Thanh toán thành công/thất bại | Banner thông báo              |

**Events tài xế nhận:**

| Event                    | Ý nghĩa           | Hiển thị                         |
| ------------------------ | ------------------- | ---------------------------------- |
| `ride_offer`           | Có chuyến mới    | Popup 🔔 NEW OFFER (30s countdown) |
| `ride_offer_cancelled` | Offer hết hạn     | Popup tự đóng                   |
| `ride_accepted`        | Xác nhận accept   | Active Ride panel                  |
| `passenger_picked_up`  | Xác nhận pickup   | Status thay đổi                  |
| `ride_completed`       | Xác nhận complete | Reset về Online                   |
| `ride_cancelled`       | Khách hủy chuyến | Thông báo, reset                 |

---

## 10. Các Trang & Đường Dẫn URL

| URL                      | Trang            | Role   | Mô tả                                            |
| ------------------------ | ---------------- | ------ | -------------------------------------------------- |
| `/`                    | Splash Page      | All    | Trang chào mừng (carousel 3 slides)              |
| `/login`               | Login            | All    | Đăng nhập bằng email + password                |
| `/register`            | Register         | All    | Đăng ký (chọn Passenger hoặc Driver)          |
| `/user`                | User Dashboard   | USER   | Đặt xe, map, booking, realtime tracking          |
| `/user/history`        | Ride History     | USER   | Lịch sử chuyến đã đi                         |
| `/user/rating/:rideId` | Rating           | USER   | Đánh giá & tip cho tài xế                     |
| `/user/profile`        | Profile          | USER   | Chỉnh sửa tên, SĐT                             |
| `/driver`              | Driver Dashboard | DRIVER | Online/Offline, GPS, nhận chuyến, quản lý ride |
| `/admin`               | Admin Dashboard  | ADMIN  | Overview, Users, Drivers, Rides, Pricing, Monitor  |
| `/payment/return`      | Payment Return   | All    | Trang nhận callback từ VNPay                     |

---

## 11. Mẹo Khi Demo

### Bố trí màn hình

```
┌───────────────────────────┬───────────────────────────┐
│                           │                           │
│   Chrome (Khách hàng)     │   Incognito (Tài xế)     │
│   http://localhost:5173   │   http://localhost:5173   │
│   → Login: khach1@test    │   → Login: taixe1@test    │
│   → Dashboard /user       │   → Dashboard /driver     │
│                           │                           │
└───────────────────────────┴───────────────────────────┘
```

### Thứ tự thao tác quan trọng

```
1. Tài xế nhấn ONLINE (vị trí tự gửi kèm)
2. Khách đặt xe SAU
→ Khi nhấn Online, tọa độ mặc định và GPS tự gửi, tài xế có thể nhận chuyến ngay!
→ Nếu cần đổi vị trí: nhấn 📍 GPS hoặc nhập tọa độ mới.
```

### Tọa độ mẫu TP.HCM

| Địa điểm               | Lat         | Lng          |
| -------------------------- | ----------- | ------------ |
| Bến Thành                | `10.7725` | `106.6980` |
| Tân Sơn Nhất            | `10.8184` | `106.6588` |
| Quận 7 (Phú Mỹ Hưng)   | `10.7288` | `106.7218` |
| Quận 2 (Thủ Đức)       | `10.7866` | `106.7500` |
| Bình Thạnh (Landmark 81) | `10.7953` | `106.7219` |

> **Tip**: Nếu autocomplete Geoapify không hoạt động (hết quota API key), nhập tọa độ thủ công cho tài xế.

### Nếu không tìm thấy tài xế

1. Kiểm tra tài xế đã **Online** chưa (badge 🟢) — khi Online, vị trí tự gửi
2. Nếu cần đổi vị trí, nhấn **📍 GPS** hoặc nhập tọa độ → **Update**
3. Kiểm tra vị trí tài xế **gần điểm đón** (trong bán kính 5km)
4. Kiểm tra **vehicleType** trùng nhau (khách chọn CAR_4 → tài xế phải là CAR_4)
5. Kiểm tra tài xế **không đang BUSY** (đang có chuyến khác)

### Kiểm tra nhanh qua API

```bash
# Xem tài xế gần pickup
curl "http://localhost:8000/drivers/nearby?lat=10.7725&lng=106.6980&radiusM=5000&vehicleType=CAR_4"

# Xem trạng thái SSE connections
curl "http://localhost:8000/notifications/debug"
```

### Các công cụ hỗ trợ

| Tool       | URL                           | Chức năng                           |
| ---------- | ----------------------------- | ------------------------------------- |
| PgAdmin    | http://localhost:5050         | Xem database (admin@taxi.com / admin) |
| Kafka UI   | http://localhost:8080         | Xem Kafka messages, topics            |
| Prometheus | http://localhost:8000/metrics | Xem metrics realtime                  |

---

## Tóm Tắt Demo Nhanh (3 Phút)

```bash
# 1. Khởi động
docker compose -f docker-compose.dev.yml up -d
cd taxi-fe && npm run dev

# 2. Mở 2 trình duyệt → http://localhost:5173

# 3. Trình duyệt 1: Đăng ký DRIVER → Online → GPS → Update Location
# 4. Trình duyệt 2: Đăng ký USER → Nhập pickup/dropoff → Estimate → Book
# 5. Trình duyệt 1: Accept offer → Pickup → Complete
# 6. Trình duyệt 2: Xem realtime updates → Rate ⭐⭐⭐⭐⭐

# Xong! 🎉
```
