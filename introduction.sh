#!/bin/bash

OUTPUT_FILE="INTRODUCTION.md"

cat << 'EOF' > $OUTPUT_FILE
# 🚖 Ride Hailing Platform – Giải thích cấu trúc thư mục

Dự án được xây dựng theo kiến trúc **Microservices**, phục vụ hệ thống gọi xe
tương tự Grab/Uber.

---

## 📁 api-gateway/

API Gateway là **cửa ngõ duy nhất** cho client (Web/Mobile).

**Chức năng:**
- Định tuyến request tới các microservice
- Xác thực (JWT)
- Logging, rate limiting

---

## 📁 services/

Chứa các **microservice nghiệp vụ**, mỗi service chạy độc lập.

- **auth-service**: Đăng nhập, JWT
- **user-service**: Quản lý người dùng
- **booking-service**: Đặt và huỷ chuyến
- **ride-service**: Trạng thái chuyến xe
- **driver-service**: Quản lý tài xế
- **pricing-service**: Tính giá cước
- **payment-service**: Thanh toán
- **review-service**: Đánh giá
- **notification-service**: Gửi thông báo

---

## 📁 shared/

Mã nguồn **dùng chung** cho nhiều service.

- `libs/logger`: Logging
- `libs/auth`: Xác thực JWT
- `libs/utils`: Hàm tiện ích
- `proto`: Protobuf (gRPC)

---

## 📁 infra/

Hạ tầng triển khai (**Infrastructure as Code**).

- `k8s`: Kubernetes manifests
- `helm`: Helm charts
- `terraform`: Cloud infrastructure

---

## 📁 observability/

Giám sát hệ thống.

- Prometheus: Metrics
- Grafana: Dashboard
- Jaeger: Distributed tracing

---

## 📁 scripts/

Script hỗ trợ DevOps.

- `setup.sh`: Khởi tạo môi trường
- `deploy.sh`: Build & deploy

---

## 📄 File cấu hình gốc

- `.env.example`
- `docker-compose.yml`
- `package.json`
- `README.md`

---

## 🏗️ Kiến trúc tổng thể

Client  
→ API Gateway  
→ Microservices  
→ Database / Message Queue  

---

📌 File này được **tự động sinh bằng script Bash**.
EOF

echo "✅ Đã tạo file $OUTPUT_FILE thành công!"
