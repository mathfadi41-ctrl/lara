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
  selectedStreamId: string | null;
  setSelectedStreamId: (id: string | null) => void;
}

export const useStreamsStore = create<StreamsState>((set) => ({
  selectedStreamId: null,
  setSelectedStreamId: (selectedStreamId) => set({ selectedStreamId }),
}));

export interface Detection {
  id: string;
  type: string;
  confidence: number;
  createdAt: string;
  [key: string]: unknown;
}

interface DetectionsState {
  detections: Detection[];
  addDetection: (detection: Detection) => void;
  clearDetections: () => void;
}

export const useDetectionsStore = create<DetectionsState>((set) => ({
  detections: [],
  addDetection: (detection) =>
    set((state) => ({
      detections: [detection, ...state.detections].slice(0, 100),
    })),
  clearDetections: () => set({ detections: [] }),
}));
