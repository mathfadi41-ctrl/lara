# Telemetry System

The Telemetry system provides real-time and historical geospatial data for video streams.

## Features

- **Ingestion**: REST API to ingest telemetry samples.
- **Storage**: Persists telemetry in PostgreSQL with time-series indexing.
- **Real-time Broadcast**: Websocket events (`telemetry:update`) for live map updates.
- **Caching**: Redis caching for fast "latest" lookups.
- **Simulation**: Built-in flight path simulator for testing/demos.
- **Integration**: Auto-tags detections with drone location at the time of the event.

## API Endpoints

### Ingest Telemetry
`POST /streams/:id/telemetry`

Payload:
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "altitude": 100.5,
  "heading": 45.0,
  "speed": 15.2,
  "roll": 0.1,
  "pitch": -0.5,
  "yaw": 45.0,
  "source": "MAVLINK"
}
```

### Get History
`GET /streams/:id/telemetry?limit=100&since=2023-01-01T00:00:00Z`

### Get Latest
`GET /telemetry/latest`
Returns the latest sample for every active stream.

## WebSocket Events

Subscribers to `stream:{id}` room receive:

`telemetry:update`
```json
{
  "streamId": "clq...",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "altitude": 100.5,
  "heading": 45.0,
  "speed": 15.2,
  "roll": 0.1,
  "pitch": -0.5,
  "yaw": 45.0,
  "timestamp": "2023-...",
  "source": "MAVLINK"
}
```

## Simulator

Enable the simulator by setting `ENABLE_FAKE_TELEMETRY=true` in `.env`.
The simulator emits circular flight paths for all `RUNNING` streams.
