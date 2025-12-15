#!/bin/bash
# Quick test script for stream pipeline API
# Usage: ./test-stream-api.sh

set -e

API_URL="${API_URL:-http://localhost:4000}"

echo "🧪 Testing Stream Pipeline API"
echo "================================"
echo ""

# Test 1: Health check
echo "1️⃣  Checking API health..."
curl -s "$API_URL/streams/health" | jq '.' || echo "❌ Health check failed"
echo ""

# Test 2: Create a stream
echo "2️⃣  Creating a test stream..."
STREAM_ID=$(curl -s -X POST "$API_URL/streams" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Stream",
    "rtspUrl": "rtsp://host.docker.internal:8554/test",
    "fps": 5,
    "detectionEnabled": true
  }' | jq -r '.id')

if [ -z "$STREAM_ID" ] || [ "$STREAM_ID" == "null" ]; then
  echo "❌ Failed to create stream"
  exit 1
fi

echo "✅ Stream created with ID: $STREAM_ID"
echo ""

# Test 3: Get stream details
echo "3️⃣  Fetching stream details..."
curl -s "$API_URL/streams/$STREAM_ID" | jq '.'
echo ""

# Test 4: List all streams
echo "4️⃣  Listing all streams..."
curl -s "$API_URL/streams" | jq 'length'
echo ""

# Test 5: Start stream
echo "5️⃣  Starting stream..."
curl -s -X POST "$API_URL/streams/$STREAM_ID/start" | jq '.'
echo ""

echo "⏱️  Waiting 5 seconds for stream to start..."
sleep 5

# Test 6: Check stream status
echo "6️⃣  Checking stream status..."
curl -s "$API_URL/streams/$STREAM_ID" | jq '.status'
echo ""

# Test 7: Update stream
echo "7️⃣  Updating stream..."
curl -s -X PATCH "$API_URL/streams/$STREAM_ID" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Test Stream"}' | jq '.name'
echo ""

# Test 8: Get detections (if any)
echo "8️⃣  Fetching detections..."
curl -s "$API_URL/detections/stream/$STREAM_ID?limit=5" | jq 'length'
echo ""

# Test 9: Stop stream
echo "9️⃣  Stopping stream..."
curl -s -X POST "$API_URL/streams/$STREAM_ID/stop" | jq '.'
echo ""

echo "⏱️  Waiting 3 seconds for stream to stop..."
sleep 3

# Test 10: Delete stream
echo "🔟 Deleting stream..."
curl -s -X DELETE "$API_URL/streams/$STREAM_ID" | jq '.'
echo ""

echo "✅ All tests completed!"
echo ""
echo "💡 To monitor WebSocket events:"
echo "   wscat -c ws://localhost:4000"
echo ""
echo "💡 To run with custom API URL:"
echo "   API_URL=http://production-url ./test-stream-api.sh"
