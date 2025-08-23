import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  subscribeToGraph: (repositoryId: string) => void;
  on: (event: string, handler: Function) => void;
  off: (event: string, handler: Function) => void;
  emit: (event: string, data?: any) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef<Map<string, Function[]>>(new Map());

  useEffect(() => {
    const socketInstance = io(
      import.meta.env.VITE_WS_URL || 'http://localhost:4001',
      {
        transports: ['websocket'],
        autoConnect: true
      }
    );

    socketInstance.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const subscribeToGraph = (repositoryId: string) => {
    if (socket) {
      socket.emit('join-repository', repositoryId);
    }
  };

  const on = (event: string, handler: Function) => {
    if (socket) {
      socket.on(event, handler as any);
      
      // Keep track of handlers for cleanup
      const handlers = handlersRef.current.get(event) || [];
      handlers.push(handler);
      handlersRef.current.set(event, handlers);
    }
  };

  const off = (event: string, handler: Function) => {
    if (socket) {
      socket.off(event, handler as any);
      
      // Remove from tracked handlers
      const handlers = handlersRef.current.get(event) || [];
      const filteredHandlers = handlers.filter(h => h !== handler);
      handlersRef.current.set(event, filteredHandlers);
    }
  };

  const emit = (event: string, data?: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    }
  };

  return {
    socket,
    isConnected,
    subscribeToGraph,
    on,
    off,
    emit
  };
}
