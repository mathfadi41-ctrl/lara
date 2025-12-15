'use client';

import axios, { AxiosError, AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      withCredentials: true,
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosError['config'] & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

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

              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
              }

              return this.client(originalRequest);
            }
          } catch {
            this.clearTokens();
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );
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

  logout(): void {
    this.clearTokens();
    delete this.client.defaults.headers.common['Authorization'];
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
    return this.client.get<Array<Record<string, unknown>>>('/streams');
  }

  async getStream(id: string) {
    return this.client.get<Record<string, unknown>>(`/streams/${id}`);
  }

  async createStream(data: Record<string, unknown>) {
    return this.client.post('/streams', data);
  }

  async updateStream(id: string, data: Record<string, unknown>) {
    return this.client.patch(`/streams/${id}`, data);
  }

  async startStream(id: string) {
    return this.client.post(`/streams/${id}/start`, {});
  }

  async stopStream(id: string) {
    return this.client.post(`/streams/${id}/stop`, {});
  }

  async getStreamHealth(id: string) {
    return this.client.get(`/streams/${id}/health`);
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
