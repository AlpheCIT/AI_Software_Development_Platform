/**
 * WebSocket Context - Real-time Communication
 * 
 * Provides real-time communication for:
 * - Analysis progress updates
 * - System notifications
 * - Live metrics updates
 * - Error notifications
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAppContext } from './AppContext';

const WebSocketContext = createContext();

export function WebSocketProvider({ children }) {
  const {
    currentRepository,
    handleAnalysisProgress,
    handleAnalysisCompleted,
    handleAnalysisFailed,
    loadMetrics
  } = useAppContext();

  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const reconnectTimeoutRef = useRef();
  const reconnectAttemptsRef = useRef(0);

  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  const connect = () => {
    try {
      const socketUrl = process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:3001';
      
      const newSocket = io(socketUrl, {
        transports: ['websocket'],
        autoConnect: false
      });

      // Connection events
      newSocket.on('connect', () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;

        // Join current repository room
        if (currentRepository) {
          newSocket.emit('join-repository', currentRepository._id);
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 WebSocket disconnected:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, try to reconnect
          scheduleReconnect();
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error);
        setConnectionError(`Connection failed: ${error.message}`);
        scheduleReconnect();
      });

      // Analysis events
      newSocket.on('analysis:started', (data) => {
        console.log('🔍 Analysis started:', data);
      });

      newSocket.on('analysis:progress', (data) => {
        console.log('📊 Analysis progress:', data);
        handleAnalysisProgress(data);
      });

      newSocket.on('analysis:completed', (data) => {
        console.log('✅ Analysis completed:', data);
        handleAnalysisCompleted(data);
      });

      newSocket.on('analysis:failed', (data) => {
        console.error('❌ Analysis failed:', data);
        handleAnalysisFailed(data);
      });

      // System events
      newSocket.on('system:metrics-updated', () => {
        loadMetrics();
      });

      newSocket.on('system:notification', (notification) => {
        console.log('🔔 System notification:', notification);
        // Handle system notifications
      });

      setSocket(newSocket);
      newSocket.connect();

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setConnectionError(`Failed to initialize connection: ${error.message}`);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('💥 Max reconnection attempts reached');
      setConnectionError('Connection lost. Please refresh the page.');
      return;
    }

    reconnectAttemptsRef.current += 1;
    const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1); // Exponential backoff

    console.log(`🔄 Scheduling reconnection attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (socket) {
        socket.disconnect();
      }
      connect();
    }, delay);
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    
    setIsConnected(false);
    setConnectionError(null);
  };

  // Initialize connection
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  // Handle repository changes
  useEffect(() => {
    if (socket && isConnected && currentRepository) {
      socket.emit('join-repository', currentRepository._id);
    }
  }, [socket, isConnected, currentRepository]);

  // Start analysis via WebSocket
  const startAnalysis = (repositoryPath, options = {}) => {
    if (socket && isConnected) {
      socket.emit('start-analysis', {
        repositoryPath,
        options
      });
    } else {
      throw new Error('WebSocket not connected');
    }
  };

  // Send custom event
  const sendEvent = (eventName, data) => {
    if (socket && isConnected) {
      socket.emit(eventName, data);
    } else {
      console.warn('Cannot send event: WebSocket not connected');
    }
  };

  const contextValue = {
    socket,
    isConnected,
    connectionError,
    startAnalysis,
    sendEvent,
    connect,
    disconnect
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
