'use client';

import { create } from 'zustand';
import type { StreamType, SplitLayout, DetectionType, DetectionChannel, TelemetryData } from './api';

export type UserRole = 'Admin' | 'Operator' | 'Viewer';

export interface User {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  logout: () => {
    set({ user: null, error: null });
  },
}));

interface StreamsState {
  // Legacy single stream support for backward compatibility
  selectedStreamId: string | null;
  setSelectedStreamId: (id: string | null) => void;
  
  // New multi-stream support
  selectedStreamIds: string[];
  primaryStreamId: string | null;
  setSelectedStreams: (ids: string[]) => void;
  addSelectedStream: (id: string) => void;
  removeSelectedStream: (id: string) => void;
  setPrimaryStream: (id: string | null) => void;
  clearSelectedStreams: () => void;
}

export const useStreamsStore = create<StreamsState>((set, get) => ({
  // Legacy single stream support
  selectedStreamId: null,
  setSelectedStreamId: (selectedStreamId) => {
    set({ selectedStreamId });
    // Keep legacy and new stores in sync for backward compatibility
    if (selectedStreamId && !get().selectedStreamIds.includes(selectedStreamId)) {
      set({ selectedStreamIds: [selectedStreamId], primaryStreamId: selectedStreamId });
    }
  },

  // New multi-stream support
  selectedStreamIds: [],
  primaryStreamId: null,
  setSelectedStreams: (selectedStreamIds) => {
    set({ selectedStreamIds });
    // Update primary stream if not set or no longer in selection
    const currentPrimary = get().primaryStreamId;
    if (!currentPrimary || !selectedStreamIds.includes(currentPrimary)) {
      const newPrimary = selectedStreamIds.length > 0 ? selectedStreamIds[0] : null;
      set({ primaryStreamId: newPrimary });
    }
    // Sync legacy single stream for backward compatibility
    const primaryStreamId = get().primaryStreamId || (selectedStreamIds.length > 0 ? selectedStreamIds[0] : null);
    if (primaryStreamId) {
      set({ selectedStreamId: primaryStreamId });
    }
  },
  
  addSelectedStream: (id) => {
    const { selectedStreamIds } = get();
    if (!selectedStreamIds.includes(id)) {
      const newIds = [...selectedStreamIds, id];
      get().setSelectedStreams(newIds);
    }
  },
  
  removeSelectedStream: (id) => {
    const { selectedStreamIds, primaryStreamId } = get();
    const newIds = selectedStreamIds.filter(streamId => streamId !== id);
    let newPrimary = primaryStreamId;
    
    if (primaryStreamId === id) {
      newPrimary = newIds.length > 0 ? newIds[0] : null;
    }
    
    set({ selectedStreamIds: newIds, primaryStreamId: newPrimary });
    
    // Sync legacy single stream
    if (newPrimary) {
      set({ selectedStreamId: newPrimary });
    }
  },
  
  setPrimaryStream: (id) => {
    if (id && get().selectedStreamIds.includes(id)) {
      set({ primaryStreamId: id });
      // Sync legacy single stream
      set({ selectedStreamId: id });
    }
  },
  
  clearSelectedStreams: () => {
    set({ selectedStreamIds: [], primaryStreamId: null, selectedStreamId: null });
  },
}));

export interface Detection {
  id: string;
  type: string;
  confidence: number;
  createdAt: string;
  streamId: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // Enhanced detection metadata
  detectionType?: DetectionType;
  channel?: DetectionChannel;
  geoInfo?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
  };
  [key: string]: unknown;
}

interface DetectionsState {
  detections: Detection[];
  detectionsByStream: Record<string, Detection[]>;
  addDetection: (detection: Detection) => void;
  addDetectionToStream: (detection: Detection) => void;
  clearDetections: () => void;
  clearDetectionsForStream: (streamId: string) => void;
  getDetectionsForStream: (streamId: string) => Detection[];
  // Helper functions for stream type overlays
  getDetectionColor: (detection: Detection, streamType?: StreamType) => string;
  getDetectionStyle: (detection: Detection, streamType?: StreamType) => {
    color: string;
    icon: string;
    label: string;
  };
  getDetectionsByChannel: (streamId: string, channel: DetectionChannel) => Detection[];
  getDetectionsByType: (streamId: string, detectionType: DetectionType) => Detection[];
}

export interface TelemetryPoint extends TelemetryData {
  // Extended with detection correlation
  correlatedDetections?: string[];
}

interface TelemetryHistoryPoint {
  telemetry: TelemetryPoint;
  timestamp: Date;
}

interface TelemetryState {
  // Per-stream telemetry data
  telemetryHistory: Record<string, TelemetryHistoryPoint[]>;
  latestTelemetry: Record<string, TelemetryPoint>;
  
  // Actions
  addTelemetryPoint: (streamId: string, telemetry: TelemetryPoint) => void;
  setTelemetryHistory: (streamId: string, history: TelemetryPoint[]) => void;
  clearTelemetryHistory: (streamId: string) => void;
  getTelemetryHistory: (streamId: string) => TelemetryPoint[];
  getLatestTelemetry: (streamId: string) => TelemetryPoint | null;
  getAllLatestTelemetry: () => TelemetryPoint[];
  
  // Detection correlation
  correlateDetectionWithTelemetry: (streamId: string, detectionId: string, telemetryPoint: TelemetryPoint) => void;
  
  // Utility getters
  getStreamPosition: (streamId: string) => { lat: number; lng: number } | null;
  getStreamStats: (streamId: string) => { speed: number; altitude: number; heading: number } | null;
}

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  telemetryHistory: {},
  latestTelemetry: {},
  
  addTelemetryPoint: (streamId, telemetry) => {
    const timestamp = new Date(telemetry.createdAt);
    const historyPoint: TelemetryHistoryPoint = {
      telemetry,
      timestamp,
    };
    
    set((state) => {
      const currentHistory = state.telemetryHistory[streamId] || [];
      const updatedHistory = [historyPoint, ...currentHistory]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 100); // Keep only latest 100 points for performance
      
      return {
        telemetryHistory: {
          ...state.telemetryHistory,
          [streamId]: updatedHistory,
        },
        latestTelemetry: {
          ...state.latestTelemetry,
          [streamId]: telemetry,
        },
      };
    });
  },
  
  setTelemetryHistory: (streamId, history) => {
    const historyPoints: TelemetryHistoryPoint[] = history
      .map(t => ({
        telemetry: t,
        timestamp: new Date(t.createdAt),
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    set((state) => ({
      telemetryHistory: {
        ...state.telemetryHistory,
        [streamId]: historyPoints,
      },
    }));
  },
  
  clearTelemetryHistory: (streamId) => {
    set((state) => {
      const { [streamId]: _removed, ...remaining } = state.telemetryHistory;
      void _removed; // Intentionally unused variable to avoid TypeScript error
      const { [streamId]: _removedLatest, ...remainingLatest } = state.latestTelemetry;
      void _removedLatest; // Intentionally unused variable to avoid TypeScript error
      return {
        telemetryHistory: remaining,
        latestTelemetry: remainingLatest,
      };
    });
  },
  
  getTelemetryHistory: (streamId) => {
    const history = get().telemetryHistory[streamId] || [];
    return history.map(point => point.telemetry);
  },
  
  getLatestTelemetry: (streamId) => {
    return get().latestTelemetry[streamId] || null;
  },
  
  getAllLatestTelemetry: () => {
    const { latestTelemetry } = get();
    return Object.values(latestTelemetry);
  },
  
  correlateDetectionWithTelemetry: (streamId, detectionId, telemetryPoint) => {
    const correlatedDetections = telemetryPoint.correlatedDetections || [];
    if (!correlatedDetections.includes(detectionId)) {
      const updatedTelemetry = {
        ...telemetryPoint,
        correlatedDetections: [...correlatedDetections, detectionId],
      };
      
      set((state) => ({
        latestTelemetry: {
          ...state.latestTelemetry,
          [streamId]: updatedTelemetry,
        },
      }));
    }
  },
  
  getStreamPosition: (streamId) => {
    const latest = get().getLatestTelemetry(streamId);
    if (latest) {
      return { lat: latest.latitude, lng: latest.longitude };
    }
    return null;
  },
  
  getStreamStats: (streamId) => {
    const latest = get().getLatestTelemetry(streamId);
    if (latest) {
      return {
        speed: latest.speed,
        altitude: latest.altitude,
        heading: latest.heading,
      };
    }
    return null;
  },
}));

export const useDetectionsStore = create<DetectionsState>((set, get) => ({
  detections: [],
  detectionsByStream: {},
  
  addDetection: (detection) =>
    set((state) => ({
      detections: [detection, ...state.detections].slice(0, 100),
    })),
  
  addDetectionToStream: (detection) => {
    const { detectionsByStream } = get();
    const streamDetections = detectionsByStream[detection.streamId] || [];
    const updatedStreamDetections = [detection, ...streamDetections].slice(0, 50);
    
    set((state) => ({
      detections: [detection, ...state.detections].slice(0, 100),
      detectionsByStream: {
        ...state.detectionsByStream,
        [detection.streamId]: updatedStreamDetections,
      },
    }));
  },
  
  clearDetections: () => set({ detections: [], detectionsByStream: {} }),
  
  clearDetectionsForStream: (streamId) => {
    set((state) => {
      const { [streamId]: _removed, ...remainingDetections } = state.detectionsByStream;
      // Using _removed to avoid unused variable warning
      void _removed;
      return {
        detections: state.detections.filter(d => d.streamId !== streamId),
        detectionsByStream: remainingDetections,
      };
    });
  },
  
  getDetectionsForStream: (streamId) => {
    return get().detectionsByStream[streamId] || [];
  },

  // Helper functions for stream type overlays
  getDetectionColor: (detection, streamType) => {
    const detectionType = detection.detectionType || detection.type.toUpperCase();
    
    // Color mapping based on detection type and stream type
    switch (detectionType) {
      case 'FIRE':
        return streamType === 'THERMAL' ? '#FF4400' : '#FF0000'; // Red for fire
      case 'SMOKE':
        return streamType === 'THERMAL' ? '#888888' : '#666666'; // Gray for smoke
      case 'HOTSPOT':
        return streamType === 'THERMAL' ? '#FFFF00' : '#FF8800'; // Yellow for hotspots
      case 'PERSON':
        return '#FF0000'; // Red for person
      case 'VEHICLE':
        return '#0000FF'; // Blue for vehicle
      default:
        return '#22C55E'; // Green for others
    }
  },

  getDetectionStyle: (detection, streamType) => {
    const detectionType = detection.detectionType || detection.type.toUpperCase();
    const color = get().getDetectionColor(detection, streamType);
    
    switch (detectionType) {
      case 'FIRE':
        return { color, icon: '🔥', label: 'Fire' };
      case 'SMOKE':
        return { color, icon: '💨', label: 'Smoke' };
      case 'HOTSPOT':
        return { color, icon: '🌡️', label: 'Hotspot' };
      case 'PERSON':
        return { color, icon: '👤', label: 'Person' };
      case 'VEHICLE':
        return { color, icon: '🚗', label: 'Vehicle' };
      default:
        return { color, icon: '🔍', label: 'Detection' };
    }
  },

  getDetectionsByChannel: (streamId, channel) => {
    const streamDetections = get().getDetectionsForStream(streamId);
    return streamDetections.filter(detection => detection.channel === channel);
  },

  getDetectionsByType: (streamId, detectionType) => {
    const streamDetections = get().getDetectionsForStream(streamId);
    return streamDetections.filter(detection => detection.detectionType === detectionType);
  },
}));
