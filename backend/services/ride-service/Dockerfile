# ---- Build stage (cài deps gọn) ----
FROM node:22-alpine AS deps
RUN apk upgrade --no-cache
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---- Runtime stage ----
FROM node:22-alpine
RUN apk upgrade --no-cache
WORKDIR /app

ENV NODE_ENV=production

# Copy node_modules từ stage deps
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# App port
EXPOSE 8005

# Start
CMD ["node", "app.js"]