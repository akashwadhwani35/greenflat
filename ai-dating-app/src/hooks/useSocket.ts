import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type UseSocketOptions = {
  token: string | null;
  apiBaseUrl: string;
};

export function useSocket({ token, apiBaseUrl }: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      // Disconnect if token is cleared (logout)
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Derive server URL by stripping the /api path suffix
    const serverUrl = apiBaseUrl.replace(/\/api\/?$/, '');

    const socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, apiBaseUrl]);

  return { socket: socketRef.current, isConnected };
}
