import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketProps {
  autoConnect?: boolean;
  reconnectionDelay?: number;
  maxReconnectionAttempts?: number;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const useWebSocket = (
  namespace: string = '/',
  options: UseWebSocketProps = {}
): UseWebSocketReturn => {
  const {
    autoConnect = true,
    reconnectionDelay = 1000,
    maxReconnectionAttempts = 5
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectionAttemptsRef = useRef(0);
  const reconnectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (socketRef.current?.connected) return;

    setIsConnecting(true);
    setError(null);

    try {
      const socketUrl = `${API_BASE_URL}${namespace}`;
      
      socketRef.current = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        reconnection: false, // We'll handle reconnection manually
      });

      socketRef.current.on('connect', () => {
        console.log(`WebSocket connected to ${namespace}`);
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectionAttemptsRef.current = 0;
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log(`WebSocket disconnected from ${namespace}:`, reason);
        setIsConnected(false);
        setIsConnecting(false);

        // Auto-reconnect unless it was a manual disconnect
        if (reason !== 'io client disconnect' && autoConnect) {
          handleReconnection();
        }
      });

      socketRef.current.on('connect_error', (error) => {
        // Only log on first attempt to reduce console noise
        if (reconnectionAttemptsRef.current === 0) {
          console.warn(`WebSocket: API gateway not available at ${socketUrl} (this is normal if running standalone)`);
        }
        setIsConnected(false);
        setIsConnecting(false);
        setError(`Connection failed: ${error.message}`);

        if (autoConnect && reconnectionAttemptsRef.current < maxReconnectionAttempts) {
          handleReconnection();
        }
      });

      socketRef.current.on('error', (error) => {
        console.error(`WebSocket error for ${namespace}:`, error);
        setError(`Socket error: ${error}`);
      });

    } catch (error) {
      console.error('Failed to create socket connection:', error);
      setIsConnecting(false);
      setError(error instanceof Error ? error.message : 'Unknown connection error');
    }
  };

  const handleReconnection = () => {
    if (reconnectionAttemptsRef.current >= maxReconnectionAttempts) {
      setError(`Failed to reconnect after ${maxReconnectionAttempts} attempts`);
      return;
    }

    reconnectionAttemptsRef.current++;
    const delay = reconnectionDelay * reconnectionAttemptsRef.current;

    console.log(`Attempting to reconnect to ${namespace} in ${delay}ms (attempt ${reconnectionAttemptsRef.current})`);

    reconnectionTimeoutRef.current = setTimeout(() => {
      setIsConnecting(true);
      connect();
    }, delay);
  };

  const disconnect = () => {
    if (reconnectionTimeoutRef.current) {
      clearTimeout(reconnectionTimeoutRef.current);
      reconnectionTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    reconnectionAttemptsRef.current = 0;
  };

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [namespace, autoConnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect
  };
};