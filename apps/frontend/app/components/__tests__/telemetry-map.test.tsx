import React from 'react';
import { render, screen } from '@testing-library/react';
import { TelemetryMap } from '../telemetry-map';
import type { Stream } from '@/lib/api';

// Mock the telemetry store
jest.mock('@/lib/store', () => ({
  useTelemetryStore: () => ({
    getStreamPosition: () => ({ lat: 37.7749, lng: -122.4194 }),
    getTelemetryHistory: () => [],
    getLatestTelemetry: () => ({
      speed: 10.5,
      altitude: 100,
      heading: 45,
    }),
    getStreamStats: () => ({ speed: 10.5, altitude: 100, heading: 45 }),
  }),
  useDetectionsStore: () => ({
    getDetectionsForStream: () => [],
  }),
}));

// Mock react-leaflet components
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  Polyline: () => <div data-testid="polyline" />,
  useMap: () => ({
    setView: jest.fn(),
    fitBounds: jest.fn(),
  }),
}));

// Mock leaflet
jest.mock('leaflet', () => ({
  latLng: (lat: number, lng: number) => ({ lat, lng }),
  polygon: () => ({
    addTo: jest.fn(),
    setLatLngs: jest.fn(),
  }),
  DivIcon: jest.fn(),
}));

const mockStreams: Stream[] = [
  {
    id: '1',
    name: 'Test Stream 1',
    rtspUrl: 'rtsp://test.com/stream1',
    status: 'RUNNING',
    detectionEnabled: true,
    fps: 30,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastHeartbeat: '2024-01-01T00:00:00Z',
    lastFrameAt: '2024-01-01T00:00:00Z',
    avgLatencyMs: 100,
    type: 'COLOR',
  },
  {
    id: '2',
    name: 'Test Stream 2',
    rtspUrl: 'rtsp://test.com/stream2',
    status: 'RUNNING',
    detectionEnabled: false,
    fps: 25,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastHeartbeat: '2024-01-01T00:00:00Z',
    lastFrameAt: '2024-01-01T00:00:00Z',
    avgLatencyMs: 120,
    type: 'THERMAL',
  },
];

describe('TelemetryMap', () => {
  it('renders without crashing', () => {
    render(
      <TelemetryMap
        streams={mockStreams}
        showDetections={true}
        showPaths={true}
        showHeadingCones={true}
      />
    );
    
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('displays stream markers', () => {
    render(
      <TelemetryMap
        streams={mockStreams}
        showDetections={true}
        showPaths={true}
        showHeadingCones={true}
      />
    );
    
    // Should render markers for streams
    expect(screen.getAllByTestId('marker')).toHaveLength(mockStreams.length);
  });

  it('handles detection filter toggles', () => {
    render(
      <TelemetryMap
        streams={mockStreams}
        showDetections={true}
        showPaths={true}
        showHeadingCones={true}
      />
    );
    
    // Check if detection filter switches are present
    expect(screen.getByLabelText(/FIRE/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/SMOKE/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/HOTSPOT/i)).toBeInTheDocument();
  });

  it('displays map legend', () => {
    render(
      <TelemetryMap
        streams={mockStreams}
        showDetections={true}
        showPaths={true}
        showHeadingCones={true}
      />
    );
    
    expect(screen.getByText('Stream Types')).toBeInTheDocument();
    expect(screen.getByText('Detections')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
  });

  it('handles empty streams gracefully', () => {
    render(
      <TelemetryMap
        streams={[]}
        showDetections={true}
        showPaths={true}
        showHeadingCones={true}
      />
    );
    
    expect(screen.getByText(/no streams available/i)).toBeInTheDocument();
  });
});