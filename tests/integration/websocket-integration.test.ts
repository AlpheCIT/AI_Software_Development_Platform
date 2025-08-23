/**
 * Integration test for WebSocket Service
 * Tests the connection between frontend and WebSocket service
 */

import { io, Socket } from 'socket.io-client';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  error?: string;
  duration?: number;
}

class WebSocketIntegrationTester {
  private socket: Socket | null = null;
  private results: TestResult[] = [];

  constructor(private readonly wsUrl: string = 'http://localhost:4001') {}

  async runTests(): Promise<TestResult[]> {
    console.log(`🧪 Starting WebSocket Integration Tests`);
    console.log(`📡 WebSocket URL: ${this.wsUrl}\n`);

    await this.testConnection();
    await this.testAuthentication();
    await this.testRoomJoining();
    await this.testEventBroadcast();
    await this.testDisconnection();

    this.printResults();
    return this.results;
  }

  private async testConnection(): Promise<void> {
    const testName = 'Connection Establishment';
    const startTime = Date.now();

    try {
      this.socket = io(this.wsUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        this.socket!.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.socket!.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.addResult({
        test: testName,
        status: 'PASS',
        duration: Date.now() - startTime,
      });

      console.log(`✅ ${testName}: PASS (${Date.now() - startTime}ms)`);
    } catch (error) {
      this.addResult({
        test: testName,
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });

      console.log(`❌ ${testName}: FAIL - ${error}`);
    }
  }

  private async testAuthentication(): Promise<void> {
    const testName = 'User Authentication';
    const startTime = Date.now();

    if (!this.socket?.connected) {
      this.addResult({
        test: testName,
        status: 'FAIL',
        error: 'Socket not connected',
      });
      return;
    }

    try {
      const testUser = {
        id: 'test-user-123',
        name: 'Test User',
        role: 'developer',
      };

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Authentication timeout'));
        }, 3000);

        this.socket!.on('authenticated', (data) => {
          clearTimeout(timeout);
          if (data.success) {
            resolve();
          } else {
            reject(new Error(data.message || 'Authentication failed'));
          }
        });

        this.socket!.emit('authenticate', testUser);
      });

      this.addResult({
        test: testName,
        status: 'PASS',
        duration: Date.now() - startTime,
      });

      console.log(`✅ ${testName}: PASS (${Date.now() - startTime}ms)`);
    } catch (error) {
      this.addResult({
        test: testName,
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });

      console.log(`❌ ${testName}: FAIL - ${error}`);
    }
  }

  private async testRoomJoining(): Promise<void> {
    const testName = 'Room Joining';
    const startTime = Date.now();

    if (!this.socket?.connected) {
      this.addResult({
        test: testName,
        status: 'FAIL',
        error: 'Socket not connected',
      });
      return;
    }

    try {
      const testRoom = 'test-room-123';

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Room join timeout'));
        }, 3000);

        this.socket!.on('room_joined', (data) => {
          clearTimeout(timeout);
          if (data.room === testRoom) {
            resolve();
          } else {
            reject(new Error('Wrong room joined'));
          }
        });

        this.socket!.emit('join_room', { room: testRoom });
      });

      this.addResult({
        test: testName,
        status: 'PASS',
        duration: Date.now() - startTime,
      });

      console.log(`✅ ${testName}: PASS (${Date.now() - startTime}ms)`);
    } catch (error) {
      this.addResult({
        test: testName,
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });

      console.log(`❌ ${testName}: FAIL - ${error}`);
    }
  }

  private async testEventBroadcast(): Promise<void> {
    const testName = 'Event Broadcasting';
    const startTime = Date.now();

    try {
      const testEvent = {
        type: 'analysis.progress',
        data: {
          repositoryId: 'test-repo',
          progress: 50,
          stage: 'analysis',
        },
        timestamp: new Date().toISOString(),
      };

      // Use the HTTP API to broadcast an event
      const response = await fetch('http://localhost:4001/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: testEvent,
          room: 'test-room-123',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.eventType === testEvent.type) {
        this.addResult({
          test: testName,
          status: 'PASS',
          duration: Date.now() - startTime,
        });

        console.log(`✅ ${testName}: PASS (${Date.now() - startTime}ms)`);
      } else {
        throw new Error('Invalid broadcast response');
      }
    } catch (error) {
      this.addResult({
        test: testName,
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });

      console.log(`❌ ${testName}: FAIL - ${error}`);
    }
  }

  private async testDisconnection(): Promise<void> {
    const testName = 'Graceful Disconnection';
    const startTime = Date.now();

    if (!this.socket?.connected) {
      this.addResult({
        test: testName,
        status: 'FAIL',
        error: 'Socket not connected',
      });
      return;
    }

    try {
      await new Promise<void>((resolve) => {
        this.socket!.on('disconnect', () => {
          resolve();
        });

        this.socket!.disconnect();
      });

      this.addResult({
        test: testName,
        status: 'PASS',
        duration: Date.now() - startTime,
      });

      console.log(`✅ ${testName}: PASS (${Date.now() - startTime}ms)`);
    } catch (error) {
      this.addResult({
        test: testName,
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });

      console.log(`❌ ${testName}: FAIL - ${error}`);
    }
  }

  private addResult(result: TestResult): void {
    this.results.push(result);
  }

  private printResults(): void {
    console.log('\n📊 Test Results Summary');
    console.log('========================');

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const total = this.results.length;

    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(`  • ${result.test}: ${result.error}`);
        });
    }

    console.log('\n🕐 Performance:');
    this.results.forEach(result => {
      if (result.duration) {
        console.log(`  • ${result.test}: ${result.duration}ms`);
      }
    });
  }
}

// Run tests if this file is executed directly
async function runIntegrationTests() {
  const tester = new WebSocketIntegrationTester();
  const results = await tester.runTests();
  
  const failed = results.filter(r => r.status === 'FAIL').length;
  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  runIntegrationTests().catch(console.error);
}

export { WebSocketIntegrationTester };
