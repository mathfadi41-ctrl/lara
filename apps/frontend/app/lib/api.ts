'use client';

import axios, { AxiosError, AxiosInstance } from 'axios';
import { disconnectSocket } from './socket';
import { useAuthStore, useDetectionsStore, useStreamsStore } from './store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type ISODateString = string;

export type StreamStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' | 'STOPPING';

export type StreamType = 'COLOR' | 'THERMAL' | 'SPLIT';
export type SplitLayout = 'LEFT_RIGHT' | 'TOP_BOTTOM';
export type DetectionType = 'SMOKE' | 'FIRE' | 'HOTSPOT';
export type DetectionChannel = 'color' | 'thermal';

export interface Stream {
  id: string;
  name: string;
  rtspUrl: string;
  status: StreamStatus;
  detectionEnabled: boolean;
  fps: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lastHeartbeat: ISODateString | null;
  lastFrameAt: ISODateString | null;
  avgLatencyMs: number;
  // Stream type and layout configuration
  type: StreamType;
  splitLayout?: SplitLayout;
}

export interface StreamHealth {
  id: string;
  name: string;
  status: StreamStatus;
  detectionEnabled: boolean;
  fps: number;
  lastHeartbeat: ISODateString | null;
  lastFrameAt: ISODateString | null;
  avgLatencyMs: number;
  type?: StreamType;
  splitLayout?: SplitLayout;
}

export interface Detection {
  id: string;
  type: string;
  confidence: number;
  createdAt: ISODateString;
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

export interface CreateStreamInput {
  name: string;
  rtspUrl: string;
  detectionEnabled?: boolean;
  fps?: number;
  type?: StreamType;
  splitLayout?: SplitLayout;
}

export interface UpdateStreamInput {
  name?: string;
  rtspUrl?: string;
  detectionEnabled?: boolean;
  fps?: number;
  type?: StreamType;
  splitLayout?: SplitLayout;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: 'Admin' | 'Operator' | 'Viewer';
  };
  tokens: AuthTokens;
}

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
  }> = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      withCredentials: true,
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as (AxiosError['config'] & { _retry?: boolean }) | undefined;

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise<string>((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                return this.client(originalRequest);
              })
              .catch((err) => {
                return Promise.reject(err);
              });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = this.getRefreshToken();
            if (refreshToken) {
              const response = await axios.post(
                `${API_URL}/auth/refresh`,
                { refreshToken },
                { withCredentials: true }
              );

              const { tokens } = response.data;
              this.setTokens(tokens);
              this.client.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;
              
              this.processQueue(null, tokens.accessToken);

              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
              }

              return this.client(originalRequest);
            } else {
               throw new Error('No refresh token available');
            }
          } catch (refreshError) {
            this.processQueue(refreshError, null);
            this.logout();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private processQueue(error: unknown, token: string | null = null) {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token as string);
      }
    });

    this.failedQueue = [];
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
  }

  private setTokens(tokens: AuthTokens): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }

  private clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  public setAuthHeader(): void {
    const token = this.getAccessToken();
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }

  public getClient(): AxiosInstance {
    return this.client;
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/login', {
      email,
      password,
    });
    if (response.data.tokens) {
      this.setTokens(response.data.tokens);
      this.setAuthHeader();
    }
    return response.data;
  }

  async register(email: string, password: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/register', {
      email,
      password,
    });
    if (response.data.tokens) {
      this.setTokens(response.data.tokens);
      this.setAuthHeader();
    }
    return response.data;
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/refresh', {
      refreshToken,
    });
    if (response.data.tokens) {
      this.setTokens(response.data.tokens);
      this.setAuthHeader();
    }
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
         await this.client.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Ignore errors during logout
    }

    this.clearTokens();
    delete this.client.defaults.headers.common['Authorization'];
    disconnectSocket();
    
    // Clear stores
    useAuthStore.getState().logout();
    useDetectionsStore.getState().clearDetections();
    useStreamsStore.getState().setSelectedStreamId(null);
    useStreamsStore.getState().clearSelectedStreams();

    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  // Users endpoints
  async getCurrentUser() {
    return this.client.get<{ email: string; id: string; role: string }>('/users/me');
  }

  async listUsers() {
    return this.client.get<Array<{ id: string; email: string; role: string }>>('/users');
  }

  async getUser(id: string) {
    return this.client.get<{ id: string; email: string; role: string }>(`/users/${id}`);
  }

  async createUser(data: Record<string, unknown>) {
    return this.client.post('/users', data);
  }

  async updateUser(id: string, data: Record<string, unknown>) {
    return this.client.patch(`/users/${id}`, data);
  }

  async setUserRole(id: string, role: string) {
    return this.client.patch(`/users/${id}/role`, { role });
  }

  async deleteUser(id: string) {
    return this.client.delete(`/users/${id}`);
  }

  // Streams endpoints
  async listStreams() {
    return this.client.get<Stream[]>('/streams');
  }

  async getStream(id: string) {
    return this.client.get<Stream>(`/streams/${id}`);
  }

  async createStream(data: CreateStreamInput) {
    return this.client.post<Stream>('/streams', data);
  }

  async updateStream(id: string, data: UpdateStreamInput) {
    return this.client.patch<Stream>(`/streams/${id}`, data);
  }

  async deleteStream(id: string) {
    return this.client.delete<{ message: string }>(`/streams/${id}`);
  }

  async startStream(id: string) {
    await this.client.post<{ message: string }>(`/streams/${id}/start`, {});
    return this.getStream(id);
  }

  async stopStream(id: string) {
    await this.client.post<{ message: string }>(`/streams/${id}/stop`, {});
    return this.getStream(id);
  }

  async getStreamHealth(id: string) {
    return this.client.get<StreamHealth>(`/streams/${id}/health`);
  }

  // Detections endpoints
  async listDetections(query?: Record<string, unknown>) {
    return this.client.get<Array<Record<string, unknown>>>('/detections', { params: query });
  }

  async getDetection(id: string) {
    return this.client.get<Record<string, unknown>>(`/detections/${id}`);
  }

  async getDetectionScreenshotMetadata(id: string) {
    return this.client.get(`/detections/${id}/screenshot-metadata`);
  }
}

export const apiClient = new ApiClient();
