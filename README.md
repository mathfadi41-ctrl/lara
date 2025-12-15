# Monorepo

This repository is organized as a multi-service workspace that hosts:

- `apps/frontend`: Next.js (App Router) frontend
- `apps/backend`: NestJS backend API with **real-time stream ingestion and detection pipeline**
- `apps/ai`: Python (FastAPI) AI service for object detection
- `infra/docker`: Dockerfiles for each service
- `docker-compose.yml`: Local Docker orchestration (frontend + backend + ai-model + PostgreSQL + Redis)

## Features

### Stream Pipeline (Backend)

The backend includes a comprehensive real-time video stream processing pipeline:

- **RTSP/WebRTC Stream Ingestion**: FFmpeg-based frame extraction at configurable FPS
- **Background Processing**: BullMQ (Redis) worker queue for scalable stream handling
- **AI-Powered Detection**: Automatic object detection via FastAPI service
- **Real-time Events**: WebSocket notifications for stream status, detections, and heartbeats
- **Persistent Storage**: Detection metadata + bounding boxes in PostgreSQL, frames on disk
- **REST API**: Full CRUD operations for stream management
- **Health Monitoring**: Heartbeat tracking and automatic error recovery

**Quick Start Guide**: See [apps/backend/docs/QUICKSTART.md](apps/backend/docs/QUICKSTART.md)  
**Architecture Details**: See [apps/backend/docs/STREAM_PIPELINE.md](apps/backend/docs/STREAM_PIPELINE.md)  
**RTSP Testing**: See [apps/backend/docs/RTSP_SIMULATION.md](apps/backend/docs/RTSP_SIMULATION.md)

## Prerequisites

- Node.js 20+ and npm
- Docker + Docker Compose (recommended for running the full stack)
- Python 3.11+ (only required if running `apps/ai` locally outside Docker)

## Environment variables

Templates are provided for each service:

- Root: `.env.example`
- Frontend: `apps/frontend/.env.example`
- Backend: `apps/backend/.env.example`
- AI: `apps/ai/.env.example`

To create local `.env` files (if they don’t exist yet):

```bash
npm run env:init
```

## Database Setup

The backend uses Prisma ORM with PostgreSQL. Initialize the database:

```bash
cd apps/backend

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Optional: Open Prisma Studio
npm run prisma:studio
```

For Docker:

```bash
docker compose up -d postgres
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma generate
```

## Local development (without Docker)

Install Node dependencies:

```bash
npm install
```

Start services:

```bash
# Frontend (http://localhost:3000)
npm run dev:frontend

# Backend (http://localhost:4000/health)
npm run dev:backend

# AI (http://localhost:8000/health)
# (requires Python deps: pip install -r apps/ai/requirements.txt)
npm run dev:ai
```

If you need PostgreSQL/Redis locally, you can run only the datastores via Docker:

```bash
docker compose up -d postgres redis
```

## Docker development (full stack)

Bring everything up with Docker:

```bash
docker compose up --build
```

Services:

- Frontend: http://localhost:3000
- Backend: http://localhost:4000/health
- AI: http://localhost:8000/health
- Postgres: localhost:5432
- Redis: localhost:6379

Stop:

```bash
docker compose down --remove-orphans
```

## Production builds

Build the Node services:

```bash
npm run build
```

Start them:

```bash
npm -w backend run start
npm -w frontend run start
```

Or run the full stack in containers:

```bash
docker compose up --build -d
```

## Workspace commands

You can run workspace scripts from the repo root:

```bash
npm -w frontend run dev
npm -w backend run dev
```

Or use the included Makefile:

```bash
make dev-frontend
make dev-backend
make dev-ai
make docker-up
```
