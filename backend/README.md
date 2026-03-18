# Backend

Standalone Express + TypeScript backend for the fitness app.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## Prisma + Supabase

1. Copy `backend/.env.example` to `backend/.env`
2. Fill in `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`
3. Validate the Prisma setup:

```bash
npm run prisma:validate
```

5. Generate Prisma client:

```bash
npm run prisma:generate
```

6. Push the schema to Supabase Postgres:

```bash
npm run prisma:push
```

Useful commands:

```bash
npm run prisma:migrate
npm run prisma:studio
```

## Default API

- `GET /`
- `GET /api`
- `GET /api/health`
- `GET /api/health/database`
- `GET /api/health/supabase`

## Auth Email Delivery

- Signup confirmation and forgot-password emails are sent by Supabase.
- If you need custom SMTP, configure it in your Supabase project instead of this backend.
