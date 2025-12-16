import { io, Socket } from 'socket.io-client';
import { useDetectionsStore } from './store';
import { toast } from 'sonner';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let socket: Socket | null = null;
const currentSubscriptions: Set<string> = new Set();

export const initializeSocket = (token: string): Socket => {
  if (socket) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    // Re-subscribe to previously subscribed streams
    currentSubscriptions.forEach(streamId => {
      subscribeToStream(streamId);
    });
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  socket.on('detection', (data) => {
    // Add detection to store with stream-specific tracking
    useDetectionsStore.getState().addDetectionToStream(data);
    
    // Show toast notification for subscribed streams
    if (currentSubscriptions.has(data.streamId)) {
      toast.success(`${data.type} detected`, {
        description: `Confidence: ${(data.confidence * 100).toFixed(1)}%`,
      });
    }
  });

  socket.on('stream:status', (data) => {
    console.log('Stream status:', data);
  });

  socket.on('stream:health', (data) => {
    console.log('Stream health:', data);
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentSubscriptions.clear();
  }
};

export const subscribeToStream = (streamId: string): void => {
  if (socket) {
    socket.emit('subscribe:stream', { streamId });
    currentSubscriptions.add(streamId);
  }
};

export const unsubscribeFromStream = (streamId: string): void => {
  if (socket) {
    socket.emit('unsubscribe:stream', { streamId });
    currentSubscriptions.delete(streamId);
  }
};

export const enableStreamDetection = (streamId: string): void => {
  if (socket) {
    socket.emit('detection:enable', { streamId });
  }
};

export const disableStreamDetection = (streamId: string): void => {
  if (socket) {
    socket.emit('detection:disable', { streamId });
  }
};

export const getCurrentSubscriptions = (): string[] => {
  return Array.from(currentSubscriptions);
};

export const isSubscribedToStream = (streamId: string): boolean => {
  return currentSubscriptions.has(streamId);
};
