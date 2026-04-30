FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json yarn.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn workspace api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/yarn.lock /app/tsconfig.base.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/data.md ./data.md
COPY --from=builder /app/apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["yarn", "start"]
