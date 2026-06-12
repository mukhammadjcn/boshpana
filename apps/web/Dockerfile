# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app

# Persisted yarn cache (survives layer-cache misses) — speeds up installs.
ENV YARN_CACHE_FOLDER=/root/.yarn-cache

# Public URLs are inlined into the Next.js client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
ARG NEXT_PUBLIC_TELEGRAM_WEB_APP_NAME
ARG NEXT_PUBLIC_ENABLE_DEV_AUTH
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
ENV NEXT_PUBLIC_TELEGRAM_WEB_APP_NAME=$NEXT_PUBLIC_TELEGRAM_WEB_APP_NAME
ENV NEXT_PUBLIC_ENABLE_DEV_AUTH=$NEXT_PUBLIC_ENABLE_DEV_AUTH

COPY package.json yarn.lock tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN --mount=type=cache,target=/root/.yarn-cache,sharing=locked \
    yarn install --frozen-lockfile

COPY . .
# Persist Next.js' incremental compile cache so only changed files recompile
# (cold build ~176s → seconds-to-tens-of-seconds on small diffs).
RUN --mount=type=cache,target=/app/apps/web/.next/cache \
    yarn workspace web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
