# Stream Pipeline Documentation

## Overview

The stream pipeline is a real-time video ingestion and object detection system built with NestJS, FFmpeg, BullMQ, and WebSocket. It supports multiple concurrent RTSP/WebRTC streams, performs object detection using an AI service, and provides real-time event notifications.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│ RTSP Source │─────▶│ FFmpeg       │─────▶│   BullMQ    │
└─────────────┘      │ Ingestion    │      │   Worker    │
                     └──────────────┘      └──────┬──────┘
                                                   │
                                                   ▼
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  WebSocket  │◀─────│  Detection   │◀─────│ AI Service  │
│   Clients   │      │   Service    │      │   (FastAPI) │
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  PostgreSQL  │
                     │  (Detections)│
                     └──────────────┘
```

## Components

### 1. Ingestion Service (`src/ingestion/ingestion.service.ts`)

Manages FFmpeg processes to extract frames from RTSP streams.

**Key Features:**
- Spawns FFmpeg processes with RTSP transport optimization
- Extracts JPEG frames at configurable FPS
- Buffers and parses JPEG boundaries (SOI/EOI markers)
- Provides frame callbacks for downstream processing
- Handles graceful shutdown and cleanup

**Configuration:**
- `fps`: Frames per second (1-30, default: 5)
- `FFMPEG_PATH`: Path to FFmpeg binary

### 2. Detection Service (`src/detection/detection.service.ts`)

Processes frames through the AI service and stores results.

**Key Features:**
- Forwards frames to AI detection endpoint
- Throttles requests per stream (max 5 pending)
- Stores detection results with bounding boxes
- Persists annotated frames to disk
- Respects stream's `detectionEnabled` flag

**Storage:**
- Frames stored at: `{FRAME_STORAGE_PATH}/{streamId}/{timestamp}.jpg`
- Detection metadata in PostgreSQL

### 3. Stream Worker (`src/stream/stream.worker.ts`)

BullMQ worker that handles stream lifecycle.

**Responsibilities:**
- Start/stop stream processing
- Update stream status in database
- Emit WebSocket status events
- Manage heartbeat intervals (10s)
- Handle errors and retries

**Job Types:**
- `start`: Initialize FFmpeg and begin frame processing
- `stop`: Terminate FFmpeg and cleanup resources

### 4. WebSocket Gateway (`src/websocket/events.gateway.ts`)

Broadcasts real-time events to connected clients.

**Events:**
- `stream:status`: Status changes (STARTING, RUNNING, STOPPED, ERROR)
- `detection`: New object detections
- `stream:heartbeat`: Periodic health signals

### 5. Stream Service (`src/stream/stream.service.ts`)

Business logic for stream management.

**API Methods:**
- `create(dto)`: Create new stream
- `findAll()`: List all streams
- `findOne(id)`: Get stream with recent detections
- `update(id, dto)`: Update stream (restarts if URL/FPS changed)
- `remove(id)`: Delete stream (stops if running)
- `start(id)`: Queue stream start job
- `stop(id)`: Queue stream stop job
- `getHealth()`: Check stream health status

## Database Schema

### Stream Model
```prisma
model Stream {
  id               String       @id @default(cuid())
  name             String
  rtspUrl          String
  status           StreamStatus @default(STOPPED)
  detectionEnabled Boolean      @default(true)
  fps              Int          @default(5)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  lastHeartbeat    DateTime?
  detections       Detection[]
}

enum StreamStatus {
  STOPPED
  STARTING
  RUNNING
  ERROR
  STOPPING
}
```

### Detection Model
```prisma
model Detection {
  id            String   @id @default(cuid())
  streamId      String
  stream        Stream   @relation(fields: [streamId], references: [id])
  timestamp     DateTime @default(now())
  confidence    Float
  label         String
  boundingBox   Json     // { x, y, width, height }
  imagePath     String
  metadata      Json?
  createdAt     DateTime @default(now())
}
```

## REST API

### Streams

#### Create Stream
```http
POST /streams
Content-Type: application/json

{
  "name": "Front Door Camera",
  "rtspUrl": "rtsp://camera.local/stream",
  "fps": 5,
  "detectionEnabled": true
}
```

#### List Streams
```http
GET /streams
```

#### Get Stream
```http
GET /streams/:id
```

#### Update Stream
```http
PATCH /streams/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "detectionEnabled": false
}
```

#### Delete Stream
```http
DELETE /streams/:id
```

#### Start Stream
```http
POST /streams/:id/start
```

#### Stop Stream
```http
POST /streams/:id/stop
```

#### Health Check
```http
GET /streams/health
```

### Detections

#### Get Recent Detections
```http
GET /detections?limit=100
```

#### Get Stream Detections
```http
GET /detections/stream/:streamId?limit=50
```

#### Get Screenshot
```http
GET /detections/screenshot/:streamId/:filename
```

## Environment Variables

```env
# Server
PORT=4000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_URL=redis://host:6379

# AI Service
AI_SERVICE_URL=http://ai-service:8000

# Storage
FRAME_STORAGE_PATH=./storage/frames

# Processing
MAX_FPS=20
FFMPEG_PATH=/usr/bin/ffmpeg
```

## Performance Tuning

### Frame Rate Optimization

The system maintains an aggregate throughput of ≥20 FPS across all streams:

- **Single stream**: Can run at up to 20 FPS
- **Multiple streams**: FPS divided among streams (e.g., 4 streams × 5 FPS)
- **Detection throttling**: Max 5 pending requests per stream

### Resource Management

**Memory:**
- Each FFmpeg process: ~50-100 MB
- Frame buffers: ~5-10 MB per stream
- Detection storage: Depends on retention policy

**CPU:**
- FFmpeg decoding: 1 core per 2-3 streams
- Detection processing: Depends on AI model
- BullMQ workers: Concurrency of 10

**Network:**
- RTSP ingestion: ~1-5 Mbps per stream
- AI requests: ~100-500 KB per frame
- WebSocket: ~1-10 KB per event

### Scaling Strategies

1. **Horizontal Scaling**: Run multiple backend instances
2. **Redis Clustering**: Scale BullMQ queue capacity
3. **Database Read Replicas**: Distribute read queries
4. **CDN for Frames**: Offload frame storage to S3/CDN
5. **GPU Acceleration**: Use hardware encoding/decoding

## Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:4000/streams/health

# Stream heartbeats (via WebSocket)
wscat -c ws://localhost:4000
# Listen for "stream:heartbeat" events
```

### Logs

Structured logging with context:

```
[StreamWorker] Processing job 123 for stream abc123: start
[IngestionService] Started FFmpeg for stream abc123
[DetectionService] Saved 2 detections for stream abc123
[StreamWorker] Stream abc123 started successfully
```

### Metrics to Monitor

- Active streams count
- Frame processing rate (FPS)
- Detection latency (time from frame to result)
- Queue depth (pending jobs)
- Error rate per stream
- Heartbeat gaps (missed heartbeats)

## Error Handling

### Automatic Retry

BullMQ jobs retry with exponential backoff:
- Attempts: 3
- Initial delay: 2s
- Max delay: 8s

### Graceful Degradation

- If AI service is unavailable, frames are skipped (logged)
- If stream URL is invalid, status changes to ERROR
- If FFmpeg crashes, worker detects and retries

### Manual Recovery

```bash
# Restart a stuck stream
curl -X POST http://localhost:4000/streams/{id}/stop
curl -X POST http://localhost:4000/streams/{id}/start

# Check unhealthy streams
curl http://localhost:4000/streams/health
```

## Testing

### Unit Tests

```bash
cd apps/backend
npm test
```

### Integration Tests

```bash
npm test stream-pipeline.spec.ts
```

### Manual Testing

See [RTSP_SIMULATION.md](./RTSP_SIMULATION.md) for setting up test streams.

## Deployment

### Docker

```bash
# Build and start all services
docker compose up --build

# Run migrations
docker compose exec backend npx prisma migrate deploy

# Generate Prisma client
docker compose exec backend npx prisma generate
```

### Production Checklist

- [ ] Set strong `DATABASE_URL` password
- [ ] Configure Redis persistence
- [ ] Set up frame storage (S3/persistent volume)
- [ ] Enable FFmpeg hardware acceleration
- [ ] Configure log aggregation (e.g., ELK stack)
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Implement rate limiting on API
- [ ] Enable HTTPS for WebSocket (wss://)
- [ ] Set up database backups
- [ ] Configure auto-scaling policies

## Troubleshooting

### FFmpeg Not Found

```bash
# Check installation
docker compose exec backend which ffmpeg

# Install manually
docker compose exec backend apk add ffmpeg
```

### Connection Refused to RTSP

- Verify stream URL: `ffplay rtsp://your-url`
- Check network firewall rules
- Use TCP transport: `-rtsp_transport tcp`

### High Memory Usage

- Reduce concurrent streams
- Lower FPS per stream
- Increase detection throttle limit
- Clear old detection frames

### WebSocket Not Connecting

- Check CORS settings in `main.ts`
- Verify WebSocket gateway port
- Use correct URL: `ws://host:4000` (not `http://`)

## Future Enhancements

- [ ] Multi-camera motion tracking
- [ ] Zone-based detection filtering
- [ ] Retention policies for detections
- [ ] Video recording on detection
- [ ] Alert notifications (email/SMS/webhook)
- [ ] Dashboard UI for monitoring
- [ ] gRPC support for AI service
- [ ] GPU-accelerated FFmpeg
- [ ] Cloud storage integration (S3, GCS)
- [ ] Multi-tenancy support
