'use client';

import { create } from 'zustand';

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
}

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
}));
