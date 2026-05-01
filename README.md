# CAB-BOOKING-SYSTEM
<<<<<<< HEAD
=======
<<<<<<< HEAD

## 📁 Cấu trúc thư mục

```
CAB-BOOKING-SYSTEM/
├── docs/                           # Tài liệu đồ án & thiết kế
│
├── src/                            # Source code chính
│   ├── apps/                       # Frontend layer
│   │   ├── web-client/             # App cho người dùng (React)
│   │   └── admin-client/           # App cho admin / quản trị (React)
│   │
│   ├── gateway/                    # API Gateway
│   │   └── src/
│   │       ├── routes/
│   │       ├── middlewares/
│   │       ├── config/
│   │       └── index.js
│   │
│   ├── services/                   # Backend Microservices
│   │   ├── auth-service/           # Login, JWT, phân quyền
│   │   ├── user-service/           # Người dùng
│   │   ├── core-service/           # Nghiệp vụ chính
│   │   ├── ai-service/             # AI (Python / FastAPI)
│   │   └── notification-service/   # Thông báo
│   │
│   ├── infrastructure/             # Hạ tầng
│   │   ├── docker/                 # Dockerfile cho từng service
│   │   ├── databases/              # Postgres, Redis
│   │   └── message-broker/         # Kafka / Redis pubsub
│   │
│   └── scripts/                    # Script hỗ trợ
│
├── tests/                          # Test
├── docker-compose.yml              # Điều phối toàn hệ thống
├── .gitignore
└── README.md
```

## Cài đặt

```bash
# Clone repository
git clone <repository-url>

# Chạy toàn bộ hệ thống với Docker Compose
docker-compose up -d
```

## Tài liệu

Chi tiết tài liệu thiết kế và hướng dẫn sử dụng xem trong thư mục `docs/`

## Quy trình làm việc nhóm với Git

### Khởi tạo dự án

```bash
# Clone repository về máy
git clone https://github.com/your-repo/CAB-BOOKING-SYSTEM.git

# Kiểm tra cấu hình Git
git config --list
```

### Quy trình làm việc hàng ngày

1. **Cập nhật code mới nhất từ server**
```bash
git pull
```

2. **Tạo nhánh làm việc cho tính năng mới**
```bash
# Tạo và chuyển sang nhánh mới
git checkout -b feature/ten-tinh-nang

# Hoặc cho bug fix
git checkout -b fix/ten-bug
```

3. **Làm việc và commit thay đổi**
```bash
# Thêm file đã thay đổi
git add .

# Commit với message theo chuẩn
git commit -m "feat: add booking feature"

# Kiểm tra trạng thái
git status
```

4. **Đẩy code lên server**
```bash
# Lần đầu tiên đẩy nhánh mới
git push --set-upstream origin feature/ten-tinh-nang

# Các lần sau
git push
```

5. **Xử lý conflict (nếu có)**
```bash
# Lưu tạm thay đổi hiện tại
git stash

# Cập nhật code mới nhất
git pull --rebase

# Lấy lại thay đổi đã lưu
git stash pop
```

### Git Commit Convention

Sử dụng prefix chuẩn cho commit message:

| Prefix | Mục đích | Ví dụ |
|--------|----------|-------|
| `feat:` | Tính năng mới | `feat: add user authentication module` |
| `fix:` | Sửa lỗi | `fix: incorrect email validation` |
| `enhance:` | Cải thiện (UI/UX/performance) | `enhance: optimize image loading speed` |

### Lệnh Git thường dùng

```bash
# Xem danh sách nhánh
git branch

# Xem log commit (nhấn q để thoát)
git log

# Xem thay đổi từ server
git fetch

# Xóa nhánh local
git branch -d ten-nhanh
```
=======
>>>>>>> e7901b3 (Initial commit - remove submodule)
>>>>>>> feature/Booking
