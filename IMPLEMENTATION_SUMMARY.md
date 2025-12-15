# Stream Pipeline Implementation Summary

## Overview

Successfully implemented a comprehensive real-time stream ingestion and detection workflow for the NestJS backend, integrating FFmpeg, BullMQ, WebSocket, and AI detection services.

## Components Implemented

### 1. Core Services

#### Ingestion Service (`src/ingestion/ingestion.service.ts`)
- FFmpeg-based RTSP/WebRTC stream ingestion
- Configurable frame extraction (1-30 FPS)
- JPEG frame parsing with SOI/EOI boundary detection
- Graceful process management and cleanup
- Automatic error handling and retry logic

#### Detection Service (`src/detection/detection.service.ts`)
- AI service integration via HTTP/multipart
- Request throttling (max 5 pending per stream)
- Frame persistence to disk storage
- Detection metadata storage in PostgreSQL
- Respects stream `detectionEnabled` toggle

#### Stream Service (`src/stream/stream.service.ts`)
- Full CRUD operations for streams
- Job queue integration for start/stop
- Automatic restart on configuration changes
- Health monitoring with heartbeat tracking
- Stream status management

#### Stream Worker (`src/stream/stream.worker.ts`)
- BullMQ processor with 10 concurrent workers
- Start/stop stream lifecycle management
- Periodic heartbeat updates (10s interval)
- Status event broadcasting via WebSocket
- Error recovery and graceful shutdown

### 2. WebSocket Gateway (`src/websocket/events.gateway.ts`)

Real-time event broadcasting:
- `stream:status` - Status changes (STARTING, RUNNING, STOPPED, ERROR)
- `detection` - New object detections with metadata
- `stream:heartbeat` - Health signals every 10 seconds

### 3. REST API Endpoints

**Streams:**
- `POST /streams` - Create new stream
- `GET /streams` - List all streams
- `GET /streams/:id` - Get stream details
- `PATCH /streams/:id` - Update stream
- `DELETE /streams/:id` - Delete stream
- `POST /streams/:id/start` - Start processing
- `POST /streams/:id/stop` - Stop processing
- `GET /streams/health` - Health check

**Detections:**
- `GET /detections` - Recent detections (all streams)
- `GET /detections/stream/:streamId` - Stream-specific detections
- `GET /detections/screenshot/:streamId/:filename` - Retrieve frame image

### 4. Database Schema (Prisma)

**Stream Model:**
- `id` - Unique identifier (CUID)
- `name` - Stream display name
- `rtspUrl` - Source URL
- `status` - Current state (STOPPED, STARTING, RUNNING, ERROR, STOPPING)
- `detectionEnabled` - Toggle for AI processing
- `fps` - Frame rate (1-30)
- `lastHeartbeat` - Health tracking timestamp
- Timestamps: `createdAt`, `updatedAt`

**Detection Model:**
- `id` - Unique identifier
- `streamId` - Foreign key to Stream
- `timestamp` - Detection time
- `label` - Object class (person, car, etc.)
- `confidence` - Detection confidence (0-1)
- `boundingBox` - JSON { x, y, width, height }
- `imagePath` - Stored frame location
- `metadata` - Additional JSON data

### 5. AI Service Enhancement (`apps/ai/main.py`)

Added `/detect` endpoint:
- Accepts multipart/form-data image upload
- Returns detection array with labels, confidence, bounding boxes
- Mock implementation with 30% detection probability
- Ready for real ML model integration (YOLO, etc.)

### 6. Background Queue (BullMQ)

- Redis-backed job queue
- Exponential backoff retry (3 attempts, 2s initial delay)
- Concurrency: 10 workers
- Job types: `start`, `stop`
- Automatic cleanup on completion

### 7. Configuration & Environment

**New Environment Variables:**
- `AI_SERVICE_URL` - Detection endpoint (default: http://localhost:8000)
- `FRAME_STORAGE_PATH` - Frame save directory (default: ./storage/frames)
- `MAX_FPS` - Global FPS limit (default: 20)
- `FFMPEG_PATH` - FFmpeg binary location (default: /usr/bin/ffmpeg)

### 8. Docker Integration

**Backend Dockerfile:**
- Alpine-based Node.js 20 image
- FFmpeg installed via apk
- Prisma client generation in build
- Persistent volume for frame storage
- Multi-stage build for optimization

**Docker Compose:**
- Volume: `frame-storage` for persistent frames
- Network: `app-net` for service communication
- Dependencies: postgres, redis, ai-model
- Environment variable injection

### 9. Testing & Documentation

**Integration Tests:**
- `test/stream-pipeline.spec.ts` - Jest test suite
- Covers: stream creation, control, detection processing, health checks
- Mocked dependencies for isolated testing

**Documentation:**
- `docs/QUICKSTART.md` - 10-minute getting started guide
- `docs/STREAM_PIPELINE.md` - Comprehensive architecture reference
- `docs/RTSP_SIMULATION.md` - Test stream setup guide
- `docs/stream-api.postman_collection.json` - API testing collection

**Test Utilities:**
- `scripts/test-stream-api.sh` - Automated API test script
- `docker-compose.test.yml` - RTSP server override

## Key Features

### Performance
- ≥20 FPS aggregate throughput across all streams
- Per-stream throttling (5 pending requests max)
- Efficient JPEG frame parsing with buffer management
- Configurable FPS per stream (1-30)

### Reliability
- Graceful shutdown handling
- Automatic retry with exponential backoff
- Health monitoring via heartbeats
- Error status tracking and reporting
- Process cleanup on termination

### Scalability
- Horizontal scaling via BullMQ workers
- Redis-backed queue for distributed processing
- Stateless worker design
- Database connection pooling via Prisma

### Observability
- Structured logging with context
- WebSocket event streaming
- Health check endpoints
- Heartbeat monitoring (30s timeout)

## File Structure

```
apps/backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       ├── 20240101000000_init/
│       │   └── migration.sql
│       └── migration_lock.toml
├── src/
│   ├── config/
│   │   └── config.module.ts
│   ├── database/
│   │   ├── database.module.ts
│   │   └── prisma.service.ts
│   ├── detection/
│   │   ├── detection.controller.ts
│   │   ├── detection.module.ts
│   │   └── detection.service.ts
│   ├── ingestion/
│   │   ├── ingestion.module.ts
│   │   └── ingestion.service.ts
│   ├── queue/
│   │   └── queue.module.ts
│   ├── stream/
│   │   ├── dto/
│   │   │   ├── create-stream.dto.ts
│   │   │   └── update-stream.dto.ts
│   │   ├── stream.controller.ts
│   │   ├── stream.module.ts
│   │   ├── stream.service.ts
│   │   └── stream.worker.ts
│   ├── websocket/
│   │   ├── events.gateway.ts
│   │   └── websocket.module.ts
│   ├── app.controller.ts
│   ├── app.module.ts
│   └── main.ts
├── test/
│   └── stream-pipeline.spec.ts
├── docs/
│   ├── QUICKSTART.md
│   ├── STREAM_PIPELINE.md
│   ├── RTSP_SIMULATION.md
│   └── stream-api.postman_collection.json
├── scripts/
│   └── test-stream-api.sh
├── jest.config.js
└── package.json
```

## Dependencies Added

### Production:
- `@nestjs/bullmq` - Queue management
- `@nestjs/config` - Configuration
- `@nestjs/platform-socket.io` - WebSocket support
- `@nestjs/websockets` - WebSocket decorators
- `@prisma/client` - Database ORM
- `axios` - HTTP client
- `bullmq` - Queue library
- `class-transformer` - DTO transformation
- `class-validator` - DTO validation
- `fluent-ffmpeg` - FFmpeg wrapper
- `ioredis` - Redis client
- `socket.io` - WebSocket server

### Development:
- `@nestjs/testing` - Testing utilities
- `@types/express` - Express types
- `@types/fluent-ffmpeg` - FFmpeg types
- `@types/jest` - Jest types
- `jest` - Testing framework
- `prisma` - Prisma CLI
- `ts-jest` - TypeScript Jest transformer

## Usage Example

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Initialize database
docker compose exec backend npx prisma migrate deploy

# 3. Create stream
curl -X POST http://localhost:4000/streams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Camera 1",
    "rtspUrl": "rtsp://camera.local/stream",
    "fps": 5,
    "detectionEnabled": true
  }'

# 4. Start stream (returns stream ID from step 3)
curl -X POST http://localhost:4000/streams/{id}/start

# 5. Monitor WebSocket events
wscat -c ws://localhost:4000

# 6. View detections
curl http://localhost:4000/detections/stream/{id}
```

## Production Readiness

✅ Implemented:
- Graceful shutdown
- Error handling & retry
- Health monitoring
- Structured logging
- Environment configuration
- Database migrations
- Integration tests
- Comprehensive documentation

⚠️ Future Enhancements:
- Rate limiting on API endpoints
- Authentication & authorization
- Metrics/observability (Prometheus)
- Frame retention policies
- S3/cloud storage integration
- gRPC support for AI service
- GPU acceleration for FFmpeg
- Multi-tenancy support

## Testing Strategy

1. **Unit Tests**: Service-level logic (Jest)
2. **Integration Tests**: Queue-to-detection flow
3. **Manual Testing**: RTSP simulation with MediaMTX
4. **API Testing**: Postman collection provided
5. **Load Testing**: Multiple concurrent streams

## Deployment Notes

- Ensure FFmpeg is available in production environment
- Configure persistent storage for frames (volume or S3)
- Set up Redis with persistence for queue durability
- Use connection pooling for database
- Monitor memory usage (FFmpeg processes)
- Implement log aggregation (ELK, CloudWatch)
- Set up alerts for unhealthy streams

## Migration Path

For existing deployments:
1. Run `npm install` to add new dependencies
2. Run `npx prisma migrate deploy` to create tables
3. Set new environment variables
4. Restart backend service
5. Test with sample RTSP stream

## Support & Troubleshooting

See documentation:
- Quick start: `apps/backend/docs/QUICKSTART.md`
- Architecture: `apps/backend/docs/STREAM_PIPELINE.md`
- RTSP setup: `apps/backend/docs/RTSP_SIMULATION.md`

Common issues:
- FFmpeg not found: Install with `apk add ffmpeg` (Alpine) or `apt-get install ffmpeg` (Debian)
- Connection refused: Check RTSP URL with `ffplay rtsp://...`
- High memory: Reduce FPS or concurrent stream count
- No detections: Verify AI service is running and accessible
