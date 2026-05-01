# Stage 1: Build bước trung gian
FROM node:22-alpine AS build

# Tạo thư mục làm việc
WORKDIR /app

# Chỉ copy file package trước để tận dụng Docker Cache (giúp build nhanh hơn)
COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Copy toàn bộ code còn lại
COPY . .

# Nếu bạn dùng TypeScript hoặc cần build (Next.js, NestJS), hãy chạy lệnh build
# RUN npm run build

# Stage 2: Runner - Stage cuối cùng để chạy ứng dụng
FROM node:22-alpine AS runner

WORKDIR /app

# Chỉ copy những thứ cần thiết từ stage build
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/. . 

# Thiết lập biến môi trường
ENV NODE_ENV=production

# Mở port cho ứng dụng
EXPOSE 3000

# Chạy ứng dụng
CMD ["npm", "start"]