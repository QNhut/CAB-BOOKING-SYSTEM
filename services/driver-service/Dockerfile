# ---- Build stage (cài deps gọn) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---- Runtime stage ----
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

# Copy node_modules từ stage deps
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# App port
EXPOSE 8002

# Start
CMD ["node", "index.js"]