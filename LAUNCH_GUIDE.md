# Launch Guide - Complete Application Stack

This guide provides comprehensive instructions for launching the entire Lara application stack, including database setup, test data generation, and verification steps.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Database Migrations](#database-migrations)
4. [Test Data & Fake Telemetry](#test-data--fake-telemetry)
5. [Verification Steps](#verification-steps)
6. [Testing Detection & Map](#testing-detection--map)
7. [Troubleshooting](#troubleshooting)
8. [Development Tips](#development-tips)

---

## Prerequisites

### System Requirements

- **Docker & Docker Compose**
  - Docker 20.10+ (or newer)
  - Docker Compose 2.0+
  - Check: `docker --version && docker compose version`

- **Node.js & npm** (for local development)
  - Node.js 20+ (LTS recommended)
  - npm 10+
  - Check: `node --version && npm --version`

- **Python** (required for AI service if running outside Docker)
  - Python 3.11+
  - pip 23+
  - Check: `python3 --version && pip3 --version`

### API Keys & Environment Variables

The application requires JWT secrets and optional API keys:

- **JWT Secrets** (for authentication) - auto-generated defaults provided
- **Admin Credentials** - seeded from environment
- **AI Service URL** - defaults to `http://localhost:8000`
- **Map Tile Providers** (optional) - uses OpenStreetMap by default
  - Mapbox token (optional, set `NEXT_PUBLIC_MAPBOX_TOKEN`)
  - Google Maps API key (optional, set `NEXT_PUBLIC_GOOGLE_MAPS_KEY`)

---

## Quick Start

### Step 1: Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/lara.git
cd lara

# Check branch (ensure you're on main or your target branch)
git status
```

### Step 2: Initialize Environment Files

```bash
# Copy example environment files to .env
npm run env:init
```

This creates:
- `.env` (root level - database, Redis, JWT secrets)
- `apps/backend/.env` (backend configuration)
- `apps/frontend/.env` (frontend configuration)
- `apps/ai/.env` (AI service configuration)

### Step 3: Review & Update Environment Variables

Edit the generated `.env` files if needed:

```bash
# Root .env - Shared settings
cat .env
# Expected defaults:
# - POSTGRES_USER=postgres
# - POSTGRES_PASSWORD=postgres
# - POSTGRES_DB=app
# - JWT_ACCESS_SECRET=changeme (⚠️ Change in production!)
# - JWT_REFRESH_SECRET=changeme (⚠️ Change in production!)

# Backend .env
cat apps/backend/.env
# Expected defaults:
# - DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
# - ADMIN_EMAIL=admin@example.com
# - ADMIN_PASSWORD=change_me_please

# Frontend .env
cat apps/frontend/.env
# Expected defaults:
# - NEXT_PUBLIC_API_URL=http://localhost:4000

# AI .env
cat apps/ai/.env
# Expected defaults:
# - MODEL_PATH=./models/yolov8n.pt
# - DEVICE=auto
```

### Step 4: Start Docker Compose Stack

```bash
# Start all services (builds if needed)
docker compose up --build

# Expected startup time: 1-3 minutes depending on system
# Watch for messages indicating successful startup:
# - "postgres: database system is ready to accept connections"
# - "redis: Ready to accept connections"
# - "🚀 Backend server running on http://0.0.0.0:4000"
# - "AI service is starting up"
# - "Ready in X.XXs"
```

### Step 5: In Another Terminal - Run Database Migrations

```bash
# While services are running, initialize database
docker compose exec backend npx prisma migrate deploy

# Verify migrations completed:
# Output should show "✔ Your database is now in sync with your schema."
```

### Step 6: Verify All Services Are Running

```bash
# Check container status
docker compose ps

# Expected output:
# NAME       COMMAND                  SERVICE      STATUS
# postgres   "docker-entrypoint.sh..."  postgres     Up (healthy)
# redis      "redis-server"             redis        Up (healthy)
# backend    "node apps/backend/..."    backend      Up
# ai-model   "uvicorn main:app..."      ai-model     Up
# frontend   "npm start"                frontend     Up
```

---

## Database Migrations

### Understanding Migrations

The Lara backend uses **Prisma ORM** with PostgreSQL. Migrations are version-controlled SQL changes that keep your database schema in sync.

### Prisma Schema Location

```
apps/backend/prisma/schema.prisma
```

Key tables:
- **streams** - Video stream metadata
- **detections** - AI detection results with bounding boxes
- **telemetry** - Geospatial data from drones (lat, lon, altitude, heading)
- **users** - User accounts and roles

### Running Migrations

#### Docker Environment (Recommended)

```bash
# Deploy existing migrations to database
docker compose exec backend npx prisma migrate deploy

# View Prisma Studio (interactive database browser)
docker compose exec backend npx prisma studio
# Opens at http://localhost:5555
```

#### Local Development

```bash
# Navigate to backend
cd apps/backend

# Generate Prisma client
npm run prisma:generate

# Create and run migrations
npm run prisma:migrate
# Prompts for migration name and runs it locally

# Open Prisma Studio
npm run prisma:studio
# Opens at http://localhost:5555
```

### Resetting Database (For Testing)

⚠️ **Warning**: This deletes all data!

```bash
# Option 1: Reset via Prisma (includes seeds)
cd apps/backend
npm run prisma:reset

# Option 2: Docker - Drop and recreate
docker compose down -v  # Remove volumes
docker compose up postgres  # Start fresh
docker compose exec backend npx prisma migrate deploy
```

### Viewing Schema

```bash
# View schema.prisma
cat apps/backend/prisma/schema.prisma

# Connect directly to PostgreSQL
docker compose exec postgres psql -U postgres -d app

# In psql:
\dt              # List all tables
\d streams       # Describe streams table
SELECT * FROM streams;
\q               # Exit
```

---

## Test Data & Fake Telemetry

### Creating Test Streams

Test streams represent video feeds (color, thermal, or split-screen) that can be monitored.

#### Method 1: Using curl (With Authentication)

First, register and login:

```bash
# 1. Register a user
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "test123456"
  }'

# Response includes accessToken and refreshToken
# Save accessToken in variable
TOKEN="your_access_token_here"

# 2. Create a color stream
curl -X POST http://localhost:4000/streams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Color Camera 1",
    "rtspUrl": "rtsp://example.com/camera1",
    "type": "COLOR",
    "fps": 5,
    "detectionEnabled": true
  }'

# 3. Create a thermal stream
curl -X POST http://localhost:4000/streams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Thermal Camera 1",
    "rtspUrl": "rtsp://example.com/thermal1",
    "type": "THERMAL",
    "fps": 3,
    "detectionEnabled": true
  }'

# 4. Create a split-screen stream
curl -X POST http://localhost:4000/streams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Split Stream 1",
    "rtspUrl": "rtsp://example.com/split1",
    "type": "SPLIT",
    "splitLayout": "LEFT_RIGHT",
    "fps": 5,
    "detectionEnabled": true
  }'

# Response includes stream id (example: "clq1234abcd...")
# Save stream id for next steps
STREAM_ID="clq1234abcd..."
```

#### Method 2: Using Frontend UI

1. Navigate to `http://localhost:3000`
2. Register/login with credentials
3. Click "Add Stream" button
4. Fill in:
   - Stream Name: e.g., "Color Camera 1"
   - RTSP URL: `rtsp://your-camera-ip/stream` or test URL
   - Type: COLOR, THERMAL, or SPLIT
   - FPS: 3-5 (low for testing)
   - Detection Enabled: ✓

### Generating Fake Telemetry Data

Telemetry includes GPS coordinates, altitude, heading, and speed for map visualization.

#### Method 1: Manual Telemetry Injection

```bash
# Ingest a single telemetry sample
curl -X POST http://localhost:4000/streams/$STREAM_ID/telemetry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude": 150.5,
    "heading": 45.0,
    "speed": 15.2,
    "roll": 0.1,
    "pitch": -0.5,
    "yaw": 45.0,
    "source": "SIMULATOR"
  }'

# Inject multiple samples in a sequence
for i in {1..10}; do
  LAT=$(echo "37.7749 + $i * 0.001" | bc)
  LON=$(echo "-122.4194 + $i * 0.001" | bc)
  curl -X POST http://localhost:4000/streams/$STREAM_ID/telemetry \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"latitude\": $LAT,
      \"longitude\": $LON,
      \"altitude\": $((150 + i * 2)),
      \"heading\": $((i * 36 % 360)),
      \"speed\": 15.2,
      \"roll\": 0.1,
      \"pitch\": -0.5,
      \"yaw\": $((i * 36 % 360)),
      \"source\": \"SIMULATOR\"
    }"
done
```

#### Method 2: Enable Fake Telemetry Simulator

The simulator generates realistic flight paths for testing.

Edit `.env`:

```bash
# Root .env
echo "ENABLE_FAKE_TELEMETRY=true" >> .env
```

Or set in Docker:

```bash
# Restart backend with simulator enabled
docker compose down backend
# Edit docker-compose.yml to add env var
# Or use docker compose set environment
docker compose up backend -e ENABLE_FAKE_TELEMETRY=true
```

**Simulator Behavior:**
- Emits circular flight paths for RUNNING streams
- Generates coordinates at 1-second intervals
- Broadcasts via WebSocket `telemetry:update` events
- Auto-tags detections with drone location

#### Method 3: Frontend Simulator Controls

1. Navigate to `http://localhost:3000/live` (Live Monitoring page)
2. Select a stream
3. Look for "Telemetry Controls" panel
4. Click "Start Simulator" button
5. Watch Map view for moving drone markers

### Expected Telemetry Payload

```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "altitude": 150.5,
  "heading": 45.0,
  "speed": 15.2,
  "roll": 0.1,
  "pitch": -0.5,
  "yaw": 45.0,
  "source": "SIMULATOR"
}
```

**Fields:**
- `latitude` - Latitude in decimal degrees (-90 to 90)
- `longitude` - Longitude in decimal degrees (-180 to 180)
- `altitude` - Height above ground in meters
- `heading` - Compass direction (0-360 degrees, 0=North)
- `speed` - Ground speed in m/s
- `roll` - Aircraft roll angle in radians
- `pitch` - Aircraft pitch angle in radians
- `yaw` - Aircraft yaw angle in radians
- `source` - Data origin: SIMULATOR, MAVLINK, or MANUAL

---

## Verification Steps

### Health Check Endpoints

Verify all services are responsive:

```bash
# Backend health
curl http://localhost:4000/health
# Expected: {"ok":true}

# AI service health
curl http://localhost:8000/health
# Expected: {"status":"ok"} or similar

# PostgreSQL (from backend logs)
docker compose logs backend | grep "Database connected"

# Redis (from backend logs)
docker compose logs backend | grep "Redis connected"
```

### Test Login Credentials

Default seeded admin user (if ADMIN_EMAIL/ADMIN_PASSWORD set):

```bash
# Login with default credentials
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "change_me_please"
  }'

# Response includes accessToken and refreshToken
```

### Frontend Access

```bash
# Frontend
http://localhost:3000

# Expected:
# - Login/Register page
# - After login: Dashboard with streams list
# - Live monitoring page at /live
# - Map view for telemetry data
```

### API Documentation

Interactive Swagger API docs:

```bash
# Backend API docs (may be available)
http://localhost:4000/api/docs
```

### WebSocket Connectivity

Test real-time events:

```bash
# Install wscat if needed
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:4000

# Expected events after connecting:
# {"event":"stream:status","data":{...}}
# {"event":"detection","data":{...}}
# {"event":"telemetry:update","data":{...}}

# Or test with Node.js
cat > test-ws.js << 'EOF'
const io = require('socket.io-client');
const socket = io('http://localhost:4000');

socket.on('connect', () => console.log('✓ Connected'));
socket.on('stream:status', (data) => console.log('Status:', data));
socket.on('detection', (data) => console.log('Detection:', data));
socket.on('telemetry:update', (data) => console.log('Telemetry:', data));
EOF

node test-ws.js
```

### List Services and Ports

```bash
# Services running
docker compose ps

# Port mapping:
# Frontend:  3000
# Backend:   4000
# AI Service: 8000
# PostgreSQL: 5432
# Redis:     6379
```

---

## Testing Detection & Map

### Verify Detection Pipeline

Detection workflow: Stream → FFmpeg frames → AI service → Detections stored

```bash
# 1. Start a stream
STREAM_ID="your_stream_id"
curl -X POST http://localhost:4000/streams/$STREAM_ID/start \
  -H "Authorization: Bearer $TOKEN"

# 2. Check stream status
curl http://localhost:4000/streams/$STREAM_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.status'
# Expected: "RUNNING"

# 3. Wait 30-60 seconds for frame processing

# 4. Get recent detections
curl http://localhost:4000/detections \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | {streamId, label, confidence}'

# 5. Get detections for specific stream
curl "http://localhost:4000/detections?streamId=$STREAM_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### Color/Thermal/Split Detection Testing

Different stream types may have different detection sensitivity:

```bash
# Create and start each stream type
for TYPE in COLOR THERMAL SPLIT; do
  STREAM_JSON=$(curl -s -X POST http://localhost:4000/streams \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
      "name": "'$TYPE' Test",
      "rtspUrl": "rtsp://test-url",
      "type": "'$TYPE'",
      "detectionEnabled": true
    }')
  
  STREAM_ID=$(echo $STREAM_JSON | jq -r '.id')
  echo "Created $TYPE stream: $STREAM_ID"
  
  # Start it
  curl -X POST http://localhost:4000/streams/$STREAM_ID/start \
    -H "Authorization: Bearer $TOKEN"
done

# Monitor detections for each type
for i in {1..6}; do
  echo "=== Check $i (in 10 seconds) ==="
  sleep 10
  curl http://localhost:4000/detections \
    -H "Authorization: Bearer $TOKEN" | jq '.[] | {streamId, label, detectionType}'
done
```

### Viewing Detections on Map

1. Navigate to `http://localhost:3000/live`
2. Click "Map" or "Split View" button
3. Observe:
   - Stream markers with location pins
   - Detection overlays as colored circles/markers
   - Flight path lines connecting telemetry points
4. Click markers to highlight streams in the list

### Testing with Fake Telemetry & Detection

Combined test:

```bash
# 1. Enable simulator
echo "ENABLE_FAKE_TELEMETRY=true" >> .env
docker compose restart backend

# 2. Create test stream
STREAM=$(curl -s -X POST http://localhost:4000/streams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Simulator Test",
    "rtspUrl": "rtsp://test",
    "detectionEnabled": true
  }')
STREAM_ID=$(echo $STREAM | jq -r '.id')

# 3. Start stream
curl -X POST http://localhost:4000/streams/$STREAM_ID/start \
  -H "Authorization: Bearer $TOKEN"

# 4. Inject telemetry (simulator will auto-emit)
curl -X POST http://localhost:4000/streams/$STREAM_ID/telemetry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude": 100,
    "heading": 0,
    "speed": 10,
    "roll": 0,
    "pitch": 0,
    "yaw": 0,
    "source": "SIMULATOR"
  }'

# 5. View on map at http://localhost:3000/live
```

---

## Troubleshooting

### Common Startup Issues

#### Docker Services Not Starting

```bash
# Check service logs
docker compose logs backend    # Backend issues
docker compose logs postgres   # Database issues
docker compose logs ai-model   # AI service issues

# Restart specific service
docker compose restart backend

# Full restart
docker compose down -v
docker compose up --build
```

#### Port Already in Use

```bash
# Find process using port 3000 (frontend)
lsof -i :3000
kill -9 <PID>

# Or change ports in .env
# Edit docker-compose.yml environment section
# Or use docker compose -f with custom ports
docker compose up -p 3001:3000
```

#### Database Connection Failed

```bash
# Check PostgreSQL is healthy
docker compose exec postgres pg_isready

# View PostgreSQL logs
docker compose logs postgres

# Connect to database manually
docker compose exec postgres psql -U postgres -d app

# Check DATABASE_URL in backend .env
echo $DATABASE_URL
# Should match: postgresql://postgres:postgres@postgres:5432/app
```

#### Migrations Not Running

```bash
# Manually run migrations
docker compose exec backend npx prisma migrate deploy

# Check migration status
docker compose exec backend npx prisma migrate status

# Reset and run fresh (⚠️ loses data)
docker compose exec backend npm run prisma:reset
```

### Viewing Service Logs

```bash
# All logs
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f ai-model
docker compose logs -f frontend

# Last 100 lines
docker compose logs --tail=100 backend

# Follow new logs only
docker compose logs -f backend | grep -i error
```

### Database Connection Issues

```bash
# Test PostgreSQL directly
docker compose exec postgres psql -U postgres -d app -c "SELECT 1"

# Check connection string
cat apps/backend/.env | grep DATABASE_URL

# View backend connection logs
docker compose logs backend | grep -i "database\|connection\|pool"
```

### Redis Issues

```bash
# Test Redis connectivity
docker compose exec redis redis-cli ping
# Expected: PONG

# Check queue status
docker compose exec redis redis-cli
# In redis-cli:
LLEN bull:stream-processing:wait    # Pending jobs
LLEN bull:stream-processing:active  # Running jobs
KEYS *                              # All keys
INFO                                # Server info
```

### Stream Not Starting

```bash
# Check stream status
curl http://localhost:4000/streams/$STREAM_ID \
  -H "Authorization: Bearer $TOKEN"

# View backend logs for stream ID
docker compose logs backend | grep $STREAM_ID

# Check RTSP URL is valid (if using real camera)
# Use ffplay or ffmpeg to test:
ffplay rtsp://your-camera-url

# If using test RTSP, start MediaMTX
docker run -d --name mediamtx -p 8554:8554 bluenviron/mediamtx:latest
```

### No Detections Appearing

```bash
# 1. Verify AI service is running
curl http://localhost:8000/health

# 2. Check detectionEnabled on stream
curl http://localhost:4000/streams/$STREAM_ID | jq '.detectionEnabled'

# 3. Verify frames are being captured
docker compose exec backend ls -la /app/storage/frames/

# 4. Check AI service logs
docker compose logs ai-model

# 5. Test detection manually
curl -X POST http://localhost:8000/detect \
  -F "image=@/path/to/test/image.jpg"
```

### High Memory Usage

```bash
# Check memory consumption
docker compose stats

# Reduce frame rate
curl -X PATCH http://localhost:4000/streams/$STREAM_ID \
  -H "Content-Type: application/json" \
  -d '{"fps": 2}'

# Clear old frames
docker compose exec backend rm -rf /app/storage/frames/*

# Disable detections on unused streams
curl -X PATCH http://localhost:4000/streams/$STREAM_ID \
  -H "Content-Type: application/json" \
  -d '{"detectionEnabled": false}'
```

---

## Development Tips

### Running Tests

#### Backend Tests (Jest)

```bash
# Navigate to backend
cd apps/backend

# Run all tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# With coverage
npm run test:cov

# From root
npm -w backend run test
```

#### AI Tests (pytest)

```bash
# Navigate to AI service
cd apps/ai

# Install test dependencies
pip install -r requirements.txt pytest

# Run tests
pytest

# With verbose output
pytest -v

# Specific test file
pytest tests/test_detection.py
```

### Local Development (Without Docker)

```bash
# Install dependencies
npm install

# Terminal 1: Start PostgreSQL and Redis (Docker only)
docker compose up -d postgres redis

# Terminal 2: Start backend
npm run dev:backend

# Terminal 3: Start frontend
npm run dev:frontend

# Terminal 4: Start AI service
cd apps/ai && pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Code Structure Overview

```
lara/
├── apps/
│   ├── frontend/           # Next.js (React) frontend
│   │   ├── src/
│   │   │   ├── app/        # Pages and routes
│   │   │   ├── components/ # UI components
│   │   │   ├── lib/        # Utilities, API client
│   │   │   └── store/      # State management (Zustand)
│   │   └── package.json
│   │
│   ├── backend/            # NestJS backend
│   │   ├── src/
│   │   │   ├── stream/     # Stream ingestion service
│   │   │   ├── detection/  # Detection processing
│   │   │   ├── telemetry/  # GPS/location data
│   │   │   ├── auth/       # JWT authentication
│   │   │   ├── users/      # User management
│   │   │   ├── websocket/  # Real-time events
│   │   │   └── main.ts     # Entry point
│   │   ├── prisma/
│   │   │   └── schema.prisma  # Database schema
│   │   └── package.json
│   │
│   └── ai/                 # Python FastAPI AI service
│       ├── main.py         # Entry point
│       ├── models/         # YOLO models
│       ├── requirements.txt # Python dependencies
│       └── package.json
│
├── infra/
│   └── docker/            # Dockerfiles
│
├── docker-compose.yml     # Service orchestration
├── .env.example           # Environment template
└── LAUNCH_GUIDE.md        # This file
```

### Modifying Detection Models

The AI service uses YOLO for object detection. To use a different model:

```bash
# Edit apps/ai/main.py

# Change model
MODEL_PATH=./models/yolov8m.pt  # Medium model (higher accuracy)
# or
MODEL_PATH=./models/yolov8x.pt  # Extra large (highest accuracy)

# Download models from https://docs.ultralytics.com/models/yolov8/
cd apps/ai/models
wget https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8m.pt
wget https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8x.pt

# Restart AI service
docker compose restart ai-model
```

### Environment Variables for Production

⚠️ **Security**: Never commit real credentials to Git.

```bash
# Root .env
POSTGRES_PASSWORD=<strong-random-password>
JWT_ACCESS_SECRET=<long-random-string>
JWT_REFRESH_SECRET=<long-random-string>

# Backend .env
ADMIN_PASSWORD=<strong-random-password>

# Optional: Map tile providers
NEXT_PUBLIC_MAPBOX_TOKEN=<mapbox-token>
NEXT_PUBLIC_GOOGLE_MAPS_KEY=<google-api-key>
```

### Debugging Tips

```bash
# Enable verbose logging
# In apps/backend/.env
LOG_LEVEL=DEBUG

# In apps/ai/.env
LOG_LEVEL=DEBUG

# Restart services
docker compose restart backend ai-model

# Monitor logs in real-time
docker compose logs -f backend | grep -i debug
```

### Performance Optimization

```bash
# 1. Reduce frame rate (default 5 FPS)
curl -X PATCH http://localhost:4000/streams/$STREAM_ID \
  -d '{"fps": 2}'

# 2. Use smaller AI model
# Edit apps/ai/.env
MODEL_PATH=./models/yolov8n.pt

# 3. Increase worker concurrency
# Edit docker-compose.yml backend service
# Or in apps/backend/src/stream/stream.worker.ts
concurrency: 20

# 4. Enable Redis caching
# Already enabled in architecture

# 5. Monitor performance
docker compose stats
```

---

## Support & Resources

### Documentation Files

- **Stream Pipeline**: `apps/backend/docs/STREAM_PIPELINE.md`
- **RTSP Simulation**: `apps/backend/docs/RTSP_SIMULATION.md`
- **Telemetry System**: `apps/backend/docs/TELEMETRY.md`
- **API Examples**: `apps/backend/docs/stream-api.postman_collection.json`

### Useful Commands

```bash
# View all available npm scripts
npm run

# Build production images
docker compose build

# View resource usage
docker compose stats

# Remove all containers and volumes
docker compose down -v

# SSH into a container
docker compose exec backend sh

# Check health status
curl http://localhost:4000/health && echo "✓ Backend healthy"
curl http://localhost:8000/health && echo "✓ AI healthy"
```

### Getting Help

1. **Check logs first**: `docker compose logs -f <service>`
2. **Review documentation**: See links above
3. **Verify prerequisites**: Ensure Docker, Node.js, Python are correct versions
4. **Test connectivity**: Use `curl`, `ffplay`, `redis-cli` for diagnostic checks
5. **Reset database**: As last resort, use `docker compose down -v && docker compose up`

---

## Next Steps

Once everything is running:

1. **Explore the Dashboard**: `http://localhost:3000`
2. **Create test streams** with different types (COLOR, THERMAL, SPLIT)
3. **Inject telemetry data** for map visualization
4. **Monitor detections** in real-time via WebSocket
5. **Review API docs** and integration examples
6. **Deploy** to production following deployment guide

---

**Last Updated**: 2025-01-09  
**Version**: 1.0  
For issues or questions, refer to the repository's issues or documentation.
