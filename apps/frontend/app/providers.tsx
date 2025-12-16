'use client';

import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import { Toaster } from 'sonner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          apiClient.setAuthHeader();
          const response = await apiClient.getCurrentUser();
          setUser(response.data);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        // If loading user fails, we should probably clear auth?
        // But maybe it failed due to network?
        // If 401, the interceptor should have handled it?
        // If fetchUser fails, we assume not logged in or invalid token.
        // But interceptor might refresh.
        // If refresh fails, interceptor clears tokens.
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [setUser, setLoading]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
