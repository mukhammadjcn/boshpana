# Bunker Online

Docker-first monorepo for the Bunker Online MVP.

## Apps

- `apps/web` — Next.js public game UI + admin panel
- `apps/api` — Fastify API, Socket.IO server, Prisma, PostgreSQL

## Local setup

1. Copy `.env.example` to `.env`
2. Run `docker compose up --build`

## Default admin login

- Email: value from `ADMIN_EMAIL`
- Password: value from `ADMIN_PASSWORD`
# boshpana
