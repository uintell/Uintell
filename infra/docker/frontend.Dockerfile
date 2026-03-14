FROM node:24-bookworm-slim AS builder

WORKDIR /app
COPY apps/frontend/package.json apps/frontend/package-lock.json* ./
RUN npm install
COPY apps/frontend .
RUN npm run build

FROM node:24-bookworm-slim

WORKDIR /app
COPY --from=builder /app ./
ENV NODE_ENV=production
CMD ["npm", "run", "start"]
