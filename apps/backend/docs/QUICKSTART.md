# Stream Pipeline Quick Start

This guide will get you up and running with the stream pipeline in under 10 minutes.

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- FFmpeg (installed automatically in Docker)

## Step 1: Start the Infrastructure

```bash
# Clone and navigate to project
cd /path/to/project

# Initialize environment files
npm run env:init

# Start all services
docker compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Backend API (port 4000)
- AI Service (port 8000)
- Frontend (port 3000)

## Step 2: Initialize the Database

```bash
# Run migrations
docker compose exec backend npx prisma migrate deploy

# Generate Prisma client
docker compose exec backend npx prisma generate
```

Or for local development:

```bash
cd apps/backend
npm run prisma:generate
npm run prisma:migrate
```

## Step 3: Set Up a Test RTSP Stream

### Option A: Use MediaMTX (Easiest)

```bash
# Start RTSP server
docker run -d --name mediamtx -p 8554:8554 bluenviron/mediamtx:latest

# Publish test stream
docker run --rm -d --name rtsp-publisher \
  jrottenberg/ffmpeg:4.4-alpine \
  -re -f lavfi -i testsrc=size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=1000:sample_rate=44100 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -c:a aac -f rtsp rtsp://host.docker.internal:8554/test
```

### Option B: Use Existing Camera

If you have an IP camera or RTSP source:
```
rtsp://username:password@camera-ip:554/stream
```

## Step 4: Create a Stream

```bash
curl -X POST http://localhost:4000/streams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Camera",
    "rtspUrl": "rtsp://host.docker.internal:8554/test",
    "fps": 5,
    "detectionEnabled": true
  }'
```

Save the returned `id` for next steps.

## Step 5: Start the Stream

```bash
# Replace {stream-id} with your stream ID
curl -X POST http://localhost:4000/streams/{stream-id}/start
```

## Step 6: Monitor Real-Time Events

### Using wscat (Node.js)

```bash
npm install -g wscat
wscat -c ws://localhost:4000

# You should see events like:
# {"event":"stream:status","data":{"streamId":"...","status":"RUNNING"}}
# {"event":"detection","data":{"streamId":"...","label":"person"}}
# {"event":"stream:heartbeat","data":{"streamId":"...","timestamp":"..."}}
```

### Using JavaScript

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:4000');

socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

socket.on('stream:status', (data) => {
  console.log('Status:', data);
});

socket.on('detection', (data) => {
  console.log('Detection:', data);
});

socket.on('stream:heartbeat', (data) => {
  console.log('Heartbeat:', data);
});
```

### Using Browser Console

```javascript
const socket = io('http://localhost:4000');
socket.on('stream:status', console.log);
socket.on('detection', console.log);
socket.on('stream:heartbeat', console.log);
```

## Step 7: View Detections

### Get Recent Detections

```bash
curl http://localhost:4000/detections?limit=10
```

### Get Detections for Specific Stream

```bash
curl http://localhost:4000/detections/stream/{stream-id}?limit=50
```

### View Screenshot

```bash
# List detections to get imagePath
curl http://localhost:4000/detections/stream/{stream-id}

# Get screenshot (extract filename from imagePath)
curl http://localhost:4000/detections/screenshot/{stream-id}/{timestamp}.jpg \
  --output detection.jpg

# Or open in browser:
open http://localhost:4000/detections/screenshot/{stream-id}/{timestamp}.jpg
```

## Step 8: Manage Streams

### List All Streams

```bash
curl http://localhost:4000/streams
```

### Get Stream Details

```bash
curl http://localhost:4000/streams/{stream-id}
```

### Update Stream

```bash
curl -X PATCH http://localhost:4000/streams/{stream-id} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "fps": 10,
    "detectionEnabled": false
  }'
```

### Stop Stream

```bash
curl -X POST http://localhost:4000/streams/{stream-id}/stop
```

### Delete Stream

```bash
curl -X DELETE http://localhost:4000/streams/{stream-id}
```

## Step 9: Check Health

```bash
curl http://localhost:4000/streams/health
```

Response:
```json
{
  "totalStreams": 2,
  "healthyStreams": 2,
  "unhealthyStreams": []
}
```

## Common Tasks

### Restart a Stream

```bash
# Stop
curl -X POST http://localhost:4000/streams/{stream-id}/stop

# Wait a few seconds
sleep 3

# Start
curl -X POST http://localhost:4000/streams/{stream-id}/start
```

### View Logs

```bash
# All services
docker compose logs -f

# Backend only
docker compose logs -f backend

# Filter for specific stream
docker compose logs -f backend | grep "stream-id"
```

### Check Database

```bash
# Open Prisma Studio
cd apps/backend
npm run prisma:studio

# Or connect with psql
docker compose exec postgres psql -U postgres -d app
```

### Monitor Redis Queue

```bash
# Connect to Redis
docker compose exec redis redis-cli

# Check queue length
LLEN bull:stream-processing:wait

# Check active jobs
LLEN bull:stream-processing:active

# Monitor keys
KEYS bull:stream-processing:*
```

## Troubleshooting

### Stream Not Starting

1. Check logs:
```bash
docker compose logs -f backend
```

2. Verify RTSP URL:
```bash
ffplay rtsp://your-url
```

3. Check stream status:
```bash
curl http://localhost:4000/streams/{stream-id}
```

### No Detections

1. Verify AI service is running:
```bash
curl http://localhost:8000/health
```

2. Check detection is enabled:
```bash
curl http://localhost:4000/streams/{stream-id}
# Look for "detectionEnabled": true
```

3. Increase detection probability in AI service (for testing):
```python
# Edit apps/ai/main.py
if random.random() < 0.8:  # Change from 0.3 to 0.8
```

### High Memory Usage

1. Reduce FPS:
```bash
curl -X PATCH http://localhost:4000/streams/{stream-id} \
  -H "Content-Type: application/json" \
  -d '{"fps": 3}'
```

2. Disable unused streams:
```bash
curl -X POST http://localhost:4000/streams/{stream-id}/stop
```

3. Clear old frames:
```bash
docker compose exec backend rm -rf /app/storage/frames/*
```

## Next Steps

- Read [STREAM_PIPELINE.md](./STREAM_PIPELINE.md) for detailed architecture
- See [RTSP_SIMULATION.md](./RTSP_SIMULATION.md) for more testing options
- Explore the REST API with Postman/Insomnia
- Build a frontend dashboard to visualize streams
- Deploy to production (see deployment guide)

## Example: Complete Workflow

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Create stream
STREAM_ID=$(curl -s -X POST http://localhost:4000/streams \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","rtspUrl":"rtsp://host.docker.internal:8554/test","fps":5}' \
  | jq -r '.id')

echo "Stream ID: $STREAM_ID"

# 3. Start stream
curl -X POST http://localhost:4000/streams/$STREAM_ID/start

# 4. Monitor (in another terminal)
wscat -c ws://localhost:4000

# 5. Wait for detections (30-60 seconds)
sleep 60

# 6. View detections
curl http://localhost:4000/detections/stream/$STREAM_ID | jq

# 7. Stop stream
curl -X POST http://localhost:4000/streams/$STREAM_ID/stop

# 8. Cleanup
curl -X DELETE http://localhost:4000/streams/$STREAM_ID
```

## Performance Tips

- **Start with low FPS (3-5)** and increase gradually
- **Limit concurrent streams** based on CPU/memory
- **Use hardware acceleration** for FFmpeg if available
- **Monitor queue depth** to avoid backlog
- **Set up retention policies** to clean old frames

## Support

- Check logs first: `docker compose logs -f backend`
- Review documentation in `docs/` folder
- Test RTSP URL independently: `ffplay rtsp://your-url`
- Verify all services are healthy: `docker compose ps`
