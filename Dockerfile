# Build stage
FROM --platform=linux/amd64 node:18-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Production stage
FROM --platform=linux/amd64 node:18-slim
WORKDIR /app
COPY --from=builder /app /app

ENV PORT=80
EXPOSE 80

CMD ["node", "server.js"]
