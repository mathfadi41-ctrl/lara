# Backend (NestJS)

NestJS API with Prisma (PostgreSQL), Redis connectivity, JWT auth (access + refresh), and Swagger docs.

## Requirements

- Node.js 20+
- PostgreSQL
- Redis (optional for now; module is wired but not yet used heavily)

## Environment variables

Copy `.env.example` to `.env` and adjust.

| Variable | Description |
| --- | --- |
| `PORT` | API port (default: 3001) |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `REDIS_URL` | Redis connection string (optional; falls back to host/port/password) |
| `JWT_ACCESS_SECRET` | Secret used for access tokens |
| `JWT_REFRESH_SECRET` | Secret used for refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | e.g. `15m` |
| `JWT_REFRESH_EXPIRES_IN` | e.g. `30d` |
| `ADMIN_EMAIL` | Seed admin email |
| `ADMIN_PASSWORD` | Seed admin password (min 8 chars) |

## Commands

From repository root (recommended if using npm workspaces):

```bash
npm run -w apps/backend start:dev
```

Or from `apps/backend`:

```bash
npm run start:dev
```

### Prisma

Generate client:

```bash
npm run prisma:generate
```

Run migrations in dev:

```bash
npm run prisma:migrate
```

Deploy migrations (CI/production style):

```bash
npm run prisma:deploy
```

Seed default admin:

```bash
npm run prisma:seed
```

### Swagger / OpenAPI

Once running:

- Swagger UI: `http://localhost:3001/docs`
- API base: `http://localhost:3001/api`

### Tests

```bash
npm run test
npm run test:e2e
```
