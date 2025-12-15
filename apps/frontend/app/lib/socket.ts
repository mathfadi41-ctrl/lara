import { io, Socket } from 'socket.io-client';
import { useDetectionsStore } from './store';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let socket: Socket | null = null;

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

  socket.on('detection', (data) => {
    useDetectionsStore.getState().addDetection(data);
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
  }
};

export const subscribeToStream = (streamId: string): void => {
  if (socket) {
    socket.emit('subscribe:stream', { streamId });
  }
};

export const unsubscribeFromStream = (streamId: string): void => {
  if (socket) {
    socket.emit('unsubscribe:stream', { streamId });
  }
};

export const enableStreamDetection = (streamId: string): void => {
  if (socket) {
    socket.emit('stream:enable-detection', { streamId });
  }
};

export const disableStreamDetection = (streamId: string): void => {
  if (socket) {
    socket.emit('stream:disable-detection', { streamId });
  }
};
