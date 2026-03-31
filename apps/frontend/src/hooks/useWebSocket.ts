import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketProps {
  autoConnect?: boolean;
  reconnectionDelay?: number;
  maxReconnectionAttempts?: number;
}

export interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  lastMessage: any;
  sendMessage: (message: any) => void;
  subscribe: (eventName: string, callback: (data: any) => void) => void;
  unsubscribe: (eventName: string, callback?: (data: any) => void) => void;
  emit: (eventName: string, data?: any) => void;
  on: (eventName: string, callback: (data: any) => void) => void;
  off: (eventName: string, callback?: (data: any) => void) => void;
  subscribeToGraph: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const useWebSocket = (
  namespace: string = '/',
  options: UseWebSocketProps = {}
): UseWebSocketReturn => {
  const {
    autoConnect = true,
    reconnectionDelay = 5000,
    maxReconnectionAttempts = 0  // Don't retry — if gateway is down, stop immediately
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<any>(null);
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

      // Listen for all messages
      socketRef.current.onAny((eventName, ...args) => {
        setLastMessage({ eventName, data: args });
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

  // Helper methods for compatibility
  const sendMessage = (message: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message', message);
    }
  };

  const subscribe = (eventName: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(eventName, callback);
    }
  };

  const unsubscribe = (eventName: string, callback?: (data: any) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(eventName, callback);
      } else {
        socketRef.current.removeAllListeners(eventName);
      }
    }
  };

  const emit = (eventName: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(eventName, data);
    }
  };

  const on = (eventName: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(eventName, callback);
    }
  };

  const off = (eventName: string, callback?: (data: any) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(eventName, callback);
      } else {
        socketRef.current.removeAllListeners(eventName);
      }
    }
  };

  const subscribeToGraph = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe', 'graph-updates');
    }
  };

  useEffect(() => {
    // Don't attempt WebSocket if API gateway is known to be down
    if ((window as any).__apiGatewayDown) return;

    // Probe first — only connect if gateway responds
    if (autoConnect) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
        .then(() => {
          clearTimeout(timeout);
          connect();
        })
        .catch(() => {
          clearTimeout(timeout);
          (window as any).__apiGatewayDown = true;
          // Don't connect — gateway is unreachable
        });
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
    disconnect,
    lastMessage,
    sendMessage,
    subscribe,
    unsubscribe,
    emit,
    on,
    off,
    subscribeToGraph
  };
};
