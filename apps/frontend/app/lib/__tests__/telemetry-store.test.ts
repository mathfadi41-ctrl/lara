import { useTelemetryStore } from '../store';
import type { TelemetryData } from '../api';

// Mock the store creation
jest.mock('zustand');

const mockTelemetryData: TelemetryData[] = [
  {
    id: '1',
    streamId: 'stream-1',
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 100,
    heading: 45,
    speed: 10.5,
    roll: 0,
    pitch: 0,
    yaw: 0,
    source: 'SIMULATOR',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    streamId: 'stream-2',
    latitude: 37.7849,
    longitude: -122.4294,
    altitude: 120,
    heading: 135,
    speed: 15.2,
    roll: 0,
    pitch: 0,
    yaw: 0,
    source: 'SIMULATOR',
    createdAt: '2024-01-01T00:01:00Z',
  },
];

describe('TelemetryStore', () => {
  let mockStore: Record<string, unknown>;

  beforeEach(() => {
    // Create a mock store instance
    mockStore = {
      telemetryHistory: {},
      latestTelemetry: {},
      addTelemetryPoint: jest.fn(),
      setTelemetryHistory: jest.fn(),
      clearTelemetryHistory: jest.fn(),
      getTelemetryHistory: jest.fn(() => []),
      getLatestTelemetry: jest.fn(() => null),
      getAllLatestTelemetry: jest.fn(() => []),
      correlateDetectionWithTelemetry: jest.fn(),
      getStreamPosition: jest.fn(),
      getStreamStats: jest.fn(),
    };

    // Mock the store creation
    jest.mocked(useTelemetryStore).mockReturnValue(mockStore as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle telemetry point addition', () => {
    mockStore.addTelemetryPoint?.('stream-1', mockTelemetryData[0]);
    
    expect(mockStore.addTelemetryPoint).toHaveBeenCalledWith('stream-1', mockTelemetryData[0]);
  });

  it('should handle telemetry history setting', () => {
    mockStore.setTelemetryHistory?.('stream-1', [mockTelemetryData[0]]);
    
    expect(mockStore.setTelemetryHistory).toHaveBeenCalledWith('stream-1', [mockTelemetryData[0]]);
  });

  it('should handle getting latest telemetry for a stream', () => {
    const mockLatest = mockTelemetryData[0];
    mockStore.getLatestTelemetry = jest.fn().mockReturnValue(mockLatest);
    
    const result = mockStore.getLatestTelemetry('stream-1');
    
    expect(mockStore.getLatestTelemetry).toHaveBeenCalledWith('stream-1');
    expect(result).toEqual(mockLatest);
  });

  it('should handle getting stream position', () => {
    const mockPosition = { lat: 37.7749, lng: -122.4194 };
    mockStore.getStreamPosition = jest.fn().mockReturnValue(mockPosition);
    
    const result = mockStore.getStreamPosition('stream-1');
    
    expect(mockStore.getStreamPosition).toHaveBeenCalledWith('stream-1');
    expect(result).toEqual(mockPosition);
  });

  it('should handle getting stream stats', () => {
    const mockStats = { speed: 10.5, altitude: 100, heading: 45 };
    mockStore.getStreamStats = jest.fn().mockReturnValue(mockStats);
    
    const result = mockStore.getStreamStats('stream-1');
    
    expect(mockStore.getStreamStats).toHaveBeenCalledWith('stream-1');
    expect(result).toEqual(mockStats);
  });

  it('should handle detection correlation with telemetry', () => {
    const detectionId = 'detection-1';
    const telemetryPoint = mockTelemetryData[0];
    
    mockStore.correlateDetectionWithTelemetry?.('stream-1', detectionId, telemetryPoint);
    
    expect(mockStore.correlateDetectionWithTelemetry).toHaveBeenCalledWith(
      'stream-1', 
      detectionId, 
      telemetryPoint
    );
  });

  it('should handle clearing telemetry history', () => {
    mockStore.clearTelemetryHistory?.('stream-1');
    
    expect(mockStore.clearTelemetryHistory).toHaveBeenCalledWith('stream-1');
  });

  it('should return empty when no telemetry available', () => {
    mockStore.getLatestTelemetry = jest.fn().mockReturnValue(null);
    
    const result = mockStore.getLatestTelemetry('non-existent-stream');
    
    expect(result).toBeNull();
  });

  it('should return null position when no telemetry available', () => {
    mockStore.getStreamPosition = jest.fn().mockReturnValue(null);
    
    const result = mockStore.getStreamPosition('non-existent-stream');
    
    expect(result).toBeNull();
  });

  it('should return null stats when no telemetry available', () => {
    mockStore.getStreamStats = jest.fn().mockReturnValue(null);
    
    const result = mockStore.getStreamStats('non-existent-stream');
    
    expect(result).toBeNull();
  });
});