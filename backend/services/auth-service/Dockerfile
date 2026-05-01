FROM node:22-alpine
RUN apk upgrade --no-cache

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 8001

CMD ["node", "app.js"]
