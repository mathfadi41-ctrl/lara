# RTSP Stream Simulation Guide

This guide explains how to simulate an RTSP source for testing the stream pipeline.

## Option 1: Using MediaMTX (Recommended)

MediaMTX (formerly rtsp-simple-server) is a ready-to-use RTSP server.

### Quick Start with Docker

```bash
docker run --rm -it -p 8554:8554 -p 1935:1935 -p 8888:8888 \
  bluenviron/mediamtx:latest
```

### Publish a test stream using FFmpeg

```bash
# Stream a test pattern
ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=1000:sample_rate=44100 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -c:a aac -f rtsp rtsp://localhost:8554/test

# Stream a video file
ffmpeg -re -i your-video.mp4 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -c:a aac -f rtsp rtsp://localhost:8554/mystream

# Stream from webcam (macOS)
ffmpeg -f avfoundation -framerate 30 -i "0:0" \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -c:a aac -f rtsp rtsp://localhost:8554/webcam

# Stream from webcam (Linux)
ffmpeg -f v4l2 -i /dev/video0 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -f rtsp rtsp://localhost:8554/webcam
```

### Connect to the stream

Use this URL in your stream configuration:
```
rtsp://localhost:8554/test
```

Or from within Docker network:
```
rtsp://host.docker.internal:8554/test
```

## Option 2: Using OpenCV Python Server

Create a simple RTSP server using OpenCV and Python:

```python
# rtsp_server.py
import cv2
import subprocess
import numpy as np

# Generate test pattern
cap = cv2.VideoCapture(0)  # Use webcam, or cv2.VideoCapture('video.mp4')

# FFmpeg command to create RTSP stream
ffmpeg_cmd = [
    'ffmpeg',
    '-y',
    '-f', 'rawvideo',
    '-vcodec', 'rawvideo',
    '-pix_fmt', 'bgr24',
    '-s', '640x480',
    '-r', '30',
    '-i', '-',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-f', 'rtsp',
    'rtsp://localhost:8554/opencv'
]

process = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE)

while True:
    ret, frame = cap.read()
    if not ret:
        break
    
    process.stdin.write(frame.tobytes())

cap.release()
process.stdin.close()
process.wait()
```

Run with:
```bash
python rtsp_server.py
```

## Option 3: Using VLC

Stream a video file using VLC:

```bash
vlc -vvv your-video.mp4 --sout '#rtp{sdp=rtsp://localhost:8554/vlc}' --loop
```

## Option 4: Docker Compose Service

Add to your `docker-compose.yml`:

```yaml
services:
  rtsp-server:
    image: bluenviron/mediamtx:latest
    ports:
      - "8554:8554"
      - "1935:1935"
      - "8888:8888"
    networks:
      - app-net

  rtsp-publisher:
    image: jrottenberg/ffmpeg:4.4-alpine
    depends_on:
      - rtsp-server
    networks:
      - app-net
    command: >
      -re -f lavfi -i testsrc=size=1280x720:rate=30
      -f lavfi -i sine=frequency=1000:sample_rate=44100
      -c:v libx264 -preset ultrafast -tune zerolatency
      -c:a aac -f rtsp rtsp://rtsp-server:8554/test
```

Then use this URL in your stream configuration:
```
rtsp://rtsp-server:8554/test
```

## Testing the Pipeline

Once you have an RTSP stream running:

1. Create a stream via API:
```bash
curl -X POST http://localhost:4000/streams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Camera",
    "rtspUrl": "rtsp://localhost:8554/test",
    "fps": 5,
    "detectionEnabled": true
  }'
```

2. Start the stream:
```bash
curl -X POST http://localhost:4000/streams/{stream-id}/start
```

3. Monitor WebSocket events:
```javascript
const socket = io('http://localhost:4000');
socket.on('stream:status', (data) => console.log('Status:', data));
socket.on('detection', (data) => console.log('Detection:', data));
socket.on('stream:heartbeat', (data) => console.log('Heartbeat:', data));
```

4. Check detections:
```bash
curl http://localhost:4000/detections/stream/{stream-id}
```

## Troubleshooting

### Connection refused
- Ensure RTSP server is running
- Check firewall rules
- Verify network connectivity

### FFmpeg errors
- Check FFmpeg is installed: `ffmpeg -version`
- Verify RTSP URL is correct
- Check network latency: `ping rtsp-host`

### No frames received
- Verify stream is publishing: `ffplay rtsp://localhost:8554/test`
- Check FPS settings (too high FPS may cause issues)
- Review backend logs for errors

### Low performance
- Reduce FPS in stream configuration
- Use hardware acceleration if available
- Adjust FFmpeg preset to faster/ultrafast
- Check CPU/memory usage
