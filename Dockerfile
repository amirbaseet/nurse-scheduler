# ═══════════════════════════════════════════
# Stage 1: Install dependencies
# ═══════════════════════════════════════════
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ═══════════════════════════════════════════
# Stage 2: Build the application
# ═══════════════════════════════════════════
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Use .env.seed if present, otherwise fall back to .env.seed.example (committed to repo)
RUN test -f .env.seed || cp .env.seed.example .env.seed

# Generate Prisma client for linux-musl (Alpine)
RUN pnpm prisma generate

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ═══════════════════════════════════════════
# Stage 3: Production runner
# ═══════════════════════════════════════════
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy full node_modules (needed for prisma migrate deploy + optional seed)
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema + migrations + seed config + seed PINs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.env.seed.example ./.env.seed.example
RUN cp .env.seed.example .env.seed

# Copy learning models (probability matrices used by algorithm at runtime)
COPY --from=builder /app/data/models ./data/models

# Copy entrypoint script
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./entrypoint.sh"]
