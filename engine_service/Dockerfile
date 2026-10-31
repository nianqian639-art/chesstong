FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y stockfish && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8081/health || exit 1
CMD ["npm", "start"]
