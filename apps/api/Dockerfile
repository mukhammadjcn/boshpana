FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install

COPY . .
RUN npm run build --workspace api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json /app/tsconfig.base.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/data.md ./data.md
COPY --from=builder /app/apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["npm", "run", "start"]
