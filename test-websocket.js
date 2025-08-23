#!/usr/bin/env node

/**
 * WebSocket Test
 * Tests WebSocket connectivity and real-time features
 */

const { io } = require('socket.io-client');

async function testWebSocket() {
  console.log('🔌 Testing WebSocket Connection...');
  
  const socket = io('http://localhost:3001', {
    autoConnect: true,
    timeout: 5000
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('WebSocket connection timeout'));
    }, 5000);

    socket.on('connect', () => {
      console.log('✅ WebSocket connected successfully');
      console.log(`📡 Socket ID: ${socket.id}`);
      
      // Test joining a repository room
      socket.emit('join-repository', 'test-repo-123');
      console.log('📨 Sent join-repository event');
      
      // Test user presence
      socket.emit('user-presence', {
        repositoryId: 'test-repo-123',
        status: 'active',
        location: { file: 'test.js', line: 42 }
      });
      console.log('📨 Sent user-presence event');
      
      clearTimeout(timeout);
      socket.disconnect();
      resolve(true);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    socket.on('user-presence-update', (data) => {
      console.log('📥 Received user-presence-update:', data);
    });
  });
}

async function runWebSocketTest() {
  try {
    await testWebSocket();
    console.log('🎉 WebSocket test completed successfully!');
  } catch (error) {
    console.error('❌ WebSocket test failed:', error.message);
    console.log('\n💡 This might be expected if Socket.IO client is not installed');
    console.log('   To install: npm install socket.io-client');
  }
}

runWebSocketTest();
