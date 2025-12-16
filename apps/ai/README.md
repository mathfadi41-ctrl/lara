# Fire/Smoke Detection AI Service

A high-performance microservice for fire, smoke, and hotspot detection using YOLOv8. Built with FastAPI, Uvicorn, PyTorch, and OpenCV.

## Features

- 🚀 **FastAPI REST API** with async/await support
- 🔥 **YOLOv8 Integration** with ultralytics for object detection
- 🖼️ **Multi-format Image Support** (file upload, base64, numpy arrays)
- 📊 **Real-time Statistics** (FPS, inference time, memory usage)
- 🔧 **Dynamic Configuration** (enable/disable detection, confidence thresholds)
- 🏃‍♂️ **Production Ready** (health checks, error handling, logging)
- 🔄 **gRPC Support** (future high-throughput implementation)
- 🐳 **Docker Support** (CUDA/CPU fallback, multi-stage builds)
- 📈 **Performance Monitoring** (GPU/CPU usage, memory tracking)
- 🧪 **Comprehensive Testing** (unit tests, integration tests, mocks)

## Quick Start

### Running with Docker Compose

The easiest way to run the complete system:

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f ai-model

# Stop services
docker-compose down
```

### Running Standalone

1. **Install Python Dependencies:**
   ```bash
   cd apps/ai
   pip install -r requirements.txt
   ```

2. **Set Environment Variables:**
   ```bash
   cp .env.example .env
   # Edit .env as needed
   ```

3. **Run the Service:**
   ```bash
   python main.py
   # Or with custom settings:
   PORT=8001 MODEL_PATH=./models/yolov8s.pt python main.py
   ```

## API Endpoints

### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "modelLoaded": true,
  "version": "1.0.0",
  "timestamp": 1640995200.123
}
```

### Detection

```http
POST /detect
Content-Type: multipart/form-data

# OR

POST /detect
Content-Type: application/json
```

**File Upload Example (COLOR stream):**
```bash
curl -X POST "http://localhost:8000/detect" \
  -F "file=@image.jpg" \
  -F "streamId=camera_001" \
  -F "streamType=COLOR" \
  -F "enableDetection=true" \
  -F "confidenceThreshold=0.5"
```

**Thermal Stream Example:**
```bash
curl -X POST "http://localhost:8000/detect" \
  -F "file=@thermal_image.jpg" \
  -F "streamId=thermal_001" \
  -F "streamType=THERMAL" \
  -F "enableDetection=true" \
  -F "confidenceThreshold=0.4"
```

**Split Stream Example:**
```bash
curl -X POST "http://localhost:8000/detect" \
  -F "file=@split_image.jpg" \
  -F "streamId=split_001" \
  -F "streamType=SPLIT" \
  -F "splitLayout=LEFT_RIGHT" \
  -F "enableDetection=true" \
  -F "confidenceThreshold=0.5"
```

**Base64 Example:**
```bash
curl -X POST "http://localhost:8000/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "base64_image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "streamId": "camera_001",
    "streamType": "COLOR",
    "enableDetection": true,
    "confidenceThreshold": 0.5
  }'
```

**Response (COLOR stream):**
```json
{
  "detections": [
    {
      "label": "fire",
      "confidence": 0.89,
      "detectionType": "FIRE",
      "channel": null,
      "boundingBox": {
        "x": 120,
        "y": 80,
        "width": 200,
        "height": 150
      }
    },
    {
      "label": "smoke",
      "confidence": 0.76,
      "detectionType": "SMOKE",
      "channel": null,
      "boundingBox": {
        "x": 300,
        "y": 100,
        "width": 150,
        "height": 120
      }
    }
  ],
  "inferenceTime": 0.045,
  "modelInfo": {
    "name": "Multi-Model (Color/Thermal)",
    "color_path": "./models/yolov8n.pt",
    "thermal_path": null,
    "device": "cuda",
    "warmed_up": true
  },
  "streamId": "camera_001",
  "enabled": true
}
```

**Response (SPLIT stream):**
```json
{
  "detections": [
    {
      "label": "smoke",
      "confidence": 0.82,
      "detectionType": "SMOKE",
      "channel": "color",
      "boundingBox": {
        "x": 100,
        "y": 150,
        "width": 80,
        "height": 60
      }
    },
    {
      "label": "hotspot",
      "confidence": 0.91,
      "detectionType": "HOTSPOT",
      "channel": "thermal",
      "boundingBox": {
        "x": 750,
        "y": 200,
        "width": 120,
        "height": 100
      }
    }
  ],
  "inferenceTime": 0.062,
  "modelInfo": {
    "name": "Multi-Model (Color/Thermal)",
    "color_path": "./models/yolov8n.pt",
    "thermal_path": null,
    "device": "cuda",
    "warmed_up": true
  },
  "streamId": "split_001",
  "enabled": true
}
```

### Status

```http
GET /status
```

Response:
```json
{
  "status": "running",
  "modelLoaded": true,
  "device": "cuda",
  "gpu": {
    "device": "Tesla T4",
    "memory_used": 524288000,
    "memory_total": 16106127360,
    "compute_capability": [7, 5]
  },
  "fps": 22.3,
  "avgInferenceTime": 0.045,
  "memoryUsage": {
    "total": 16777216000,
    "available": 8388608000,
    "percent": 50.0,
    "process_rss": 209715200,
    "process_vms": 524288000
  },
  "uptime": 3600.5,
  "stats": {
    "total_requests": 100,
    "detection_enabled_requests": 95,
    "total_detections": 23,
    "avg_inference_time": 0.045,
    "fps": 22.3
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | HTTP server port |
| `MODEL_PATH` | `./models/yolov8n.pt` | Path to YOLO model weights (legacy, use COLOR_MODEL_PATH) |
| `COLOR_MODEL_PATH` | `./models/yolov8n.pt` | Path to RGB/color model weights for smoke/fire detection |
| `THERMAL_MODEL_PATH` | `None` | Path to thermal model weights (optional, uses heuristic if not provided) |
| `THERMAL_THRESHOLD` | `200.0` | Intensity threshold for heuristic thermal detection (0-255) |
| `CONCURRENCY` | `4` | Number of uvicorn workers |
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `MAX_DETECTIONS` | `100` | Maximum detections per request |
| `CONFIDENCE_THRESHOLD` | `0.25` | Default confidence threshold |
| `DEVICE` | `auto` | Compute device (auto, cpu, cuda) |
| `ENABLE_DETECTION` | `true` | Global detection enable/disable flag |
| `MODELS_DIR` | `./models` | Directory for model storage |
| `HEARTBEAT_INTERVAL` | `10` | Heartbeat interval in seconds |
| `GRPC_PORT` | `50051` | gRPC server port |

### Multi-Model Pipeline Configuration

The AI service now supports multiple detection pipelines for different stream types:

**Stream Types:**
- `COLOR`: RGB streams using YOLO for smoke/fire detection
- `THERMAL`: Thermal camera streams using intensity-based hotspot detection
- `SPLIT`: Combined streams with side-by-side color and thermal feeds

**Model Configuration:**

```bash
# Color model for RGB smoke/fire detection
COLOR_MODEL_PATH=./models/fire_smoke_yolov8.pt

# Thermal model (optional - if not provided, uses heuristic detector)
THERMAL_MODEL_PATH=./models/thermal_hotspot_yolov8.pt

# Thermal threshold for heuristic detector (0-255, higher = hotter regions only)
THERMAL_THRESHOLD=180.0
```

**Split Layout Options:**
- `LEFT_RIGHT`: Color on left, thermal on right
- `TOP_BOTTOM`: Color on top, thermal on bottom

The service automatically:
- Routes COLOR streams to the RGB smoke/fire detector
- Routes THERMAL streams to the thermal hotspot detector
- Routes SPLIT streams to both detectors, splitting the frame and remapping bounding boxes
- Tags each detection with `detectionType` (SMOKE, FIRE, HOTSPOT) and `channel` (color, thermal) for split streams

## Client SDK Usage

The included `client_sdk.py` provides a Python client for easy integration:

```python
from client_sdk import FireDetectionClient

# Initialize client
client = FireDetectionClient(base_url="http://localhost:8000")

# Check health
health = client.health_check()
print(f"Service status: {health['status']}")

# Detect from file
result = client.detect_from_file(
    image_path="test_image.jpg",
    stream_id="camera_001",
    enable_detection=True,
    confidence_threshold=0.5
)

print(f"Found {len(result['detections'])} detections")
for detection in result['detections']:
    print(f"  {detection['label']}: {detection['confidence']:.2f}")

# Batch processing
image_paths = ["img1.jpg", "img2.jpg", "img3.jpg"]
results = client.batch_detect(image_paths, stream_id_prefix="batch")
```

## Python API Examples

### File Upload Detection

```python
import requests

# Upload image for detection
with open("image.jpg", "rb") as f:
    response = requests.post(
        "http://localhost:8000/detect",
        files={"file": f},
        data={
            "streamId": "security_camera_01",
            "enableDetection": "true",
            "confidenceThreshold": "0.6"
        }
    )

result = response.json()
print(f"Inference time: {result['inferenceTime']:.3f}s")
```

### Base64 Image Detection

```python
import base64
import requests

# Encode image to base64
with open("image.jpg", "rb") as f:
    base64_image = base64.b64encode(f.read()).decode('utf-8')

# Send for detection
response = requests.post(
    "http://localhost:8000/detect",
    json={
        "base64_image": base64_image,
        "streamId": "thermal_camera_02",
        "enableDetection": True,
        "confidenceThreshold": 0.4
    }
)

result = response.json()
```

### Status Monitoring

```python
import requests

# Get service status
response = requests.get("http://localhost:8000/status")
status = response.json()

print(f"Model loaded: {status['modelLoaded']}")
print(f"Device: {status['device']}")
print(f"FPS: {status['fps']:.1f}")
print(f"Average inference time: {status['avgInferenceTime']:.3f}s")
print(f"Total requests: {status['stats']['total_requests']}")
```

## Configuration Options

### Dynamic Detection Control

The service supports dynamic enable/disable flags per request:

```python
# Disable detection for monitoring-only mode
result = client.detect_from_file("image.jpg", enable_detection=False)

# This will return empty detections but still update statistics
assert result["enabled"] is False
assert len(result["detections"]) == 0
```

### Custom Confidence Thresholds

```python
# High precision for production
result = client.detect_from_file(
    "image.jpg", 
    confidence_threshold=0.8
)

# Lower threshold for testing
result = client.detect_from_file(
    "image.jpg", 
    confidence_threshold=0.2
)
```

## gRPC Support (Future)

A gRPC server definition is included for high-throughput scenarios:

```python
# Start gRPC server
python grpc_server.py
```

See `proto/fire_detection.proto` for the service definition.

## Testing

Run the test suite:

```bash
# Install test dependencies
pip install pytest pytest-asyncio pytest-mock

# Run all tests
pytest test_main.py -v

# Run with coverage
pip install pytest-cov
pytest test_main.py --cov=. --cov-report=html
```

## Docker Configuration

### Build AI Service Image

```bash
# Build the image
docker build -f infra/docker/ai.Dockerfile -t ai-service:latest .

# Run with custom environment
docker run -p 8000:8000 \
  -e PORT=8000 \
  -e DEVICE=cuda \
  -e MODEL_PATH=/models/yolov8n.pt \
  -v $(pwd)/models:/models \
  ai-service:latest
```

### CUDA Support

For GPU acceleration, ensure CUDA is available:

```bash
# Check CUDA availability
nvidia-smi

# Run with CUDA
docker run --gpus all -p 8000:8000 ai-service:latest
```

## Model Management

### Using Different YOLOv8 Models

The service supports different YOLOv8 model sizes:

```bash
# Nano (fastest, least accurate)
MODEL_PATH=./models/yolov8n.pt python main.py

# Small (balanced)
MODEL_PATH=./models/yolov8s.pt python main.py

# Medium (more accurate, slower)
MODEL_PATH=./models/yolov8m.pt python main.py

# Large (most accurate, slowest)
MODEL_PATH=./models/yolov8l.pt python main.py
```

### Custom Models

For fire/smoke detection, you can use a custom trained model:

```bash
# Use custom model
MODEL_PATH=./models/fire_detection_yolov8.pt python main.py
```

## Performance Optimization

### GPU vs CPU

- **GPU**: Use `DEVICE=cuda` for faster inference
- **CPU**: Use `DEVICE=cpu` for basic deployment
- **Auto**: Use `DEVICE=auto` to automatically detect hardware

### Concurrency

Adjust worker count based on CPU cores:

```bash
# Single worker
CONCURRENCY=1 python main.py

# Multiple workers
CONCURRENCY=8 python main.py
```

### Memory Management

Monitor memory usage via the `/status` endpoint:

```python
status = client.get_status()
memory = status['memoryUsage']
print(f"Memory usage: {memory['percent']:.1f}%")
```

## Troubleshooting

### Common Issues

1. **Model Loading Failure**
   ```bash
   # Check model path exists
   ls -la models/
   
   # Download model if missing
   python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
   ```

2. **CUDA Out of Memory**
   ```bash
   # Use smaller model
   MODEL_PATH=./models/yolov8n.pt
   
   # Or use CPU
   DEVICE=cpu python main.py
   ```

3. **Permission Issues**
   ```bash
   # Fix permissions
   chmod +x client_sdk.py
   chmod +x health_check.sh
   ```

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=DEBUG python main.py
```

### Health Checks

```bash
# Check service health
curl http://localhost:8000/health

# Check detailed status
curl http://localhost:8000/status
```

## Integration with Backend

The AI service is designed to work with the NestJS backend:

```typescript
// Backend service example
@Injectable()
export class AiService {
  private readonly aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  
  async detectFire(imageBuffer: Buffer, streamId: string) {
    const formData = new FormData();
    formData.append('file', new Blob([imageBuffer]), 'frame.jpg');
    formData.append('streamId', streamId);
    formData.append('enableDetection', 'true');
    
    const response = await fetch(`${this.aiUrl}/detect`, {
      method: 'POST',
      body: formData
    });
    
    return response.json();
  }
}
```

## Development

### Project Structure

```
apps/ai/
├── main.py              # FastAPI application
├── grpc_server.py       # gRPC server implementation
├── client_sdk.py        # Python client SDK
├── requirements.txt     # Python dependencies
├── test_main.py        # Comprehensive test suite
├── proto/              # gRPC protocol definitions
│   └── fire_detection.proto
└── .env.example        # Environment variables template
```

### Adding New Features

1. **Extend API endpoints** in `main.py`
2. **Add corresponding tests** in `test_main.py`
3. **Update client SDK** in `client_sdk.py`
4. **Document changes** in this README

### Contributing

1. Add tests for new functionality
2. Update this README
3. Ensure all tests pass
4. Follow existing code patterns

## License

This project is part of the larger application repository. See the main repository for licensing information.

## Support

For issues and questions:
1. Check this README first
2. Review test examples in `test_main.py`
3. Check service logs and status endpoint
4. Create issues in the main repository