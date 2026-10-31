# ──────────────────── Stage 1: Build ────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Install ALL dependencies (including dev) so TypeScript can compile
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src ./src
COPY public ./public
RUN npm run build

# ──────────────────── Stage 2: Production ────────────────────
FROM node:22-alpine

# Install stockfish from Alpine community repository
RUN apk add --no-cache stockfish \
    && ln -sf /usr/bin/stockfish /usr/local/bin/stockfish

WORKDIR /app

# Install production-only Node dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "dist/index.js"]
