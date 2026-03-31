/**
 * Repository Ingestion Service - INVESTOR READY VERSION
 * Connects to Enhanced API Gateway for real repository ingestion
 * 
 * Features:
 * - Real GitHub repository ingestion
 * - WebSocket real-time progress updates
 * - 49 database collections population
 * - No mock data - everything is real
 */

import { io, Socket } from 'socket.io-client';

// Real API Gateway Configuration
const API_BASE_URL = 'http://localhost:3001/api/v1';
const WEBSOCKET_URL = 'ws://localhost:4001';

// Real API Gateway Interfaces
export interface IngestionJob {
  id: string;
  repositoryUrl: string;
  repositoryName?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  overallProgress?: number;
  phase: string;
  currentPhase?: number;
  totalPhases?: number;
  startTime: string;
  endTime?: string;
  collectionsPopulated: number;
  totalCollections: number;
  phases?: Array<{ name: string; progress: number; status: string }>;
  metrics: {
    filesProcessed: number;
    nodesCreated: number;
    edgesCreated: number;
    securityIssues: number;
    performanceIssues: number;
  };
  error?: string;
}

export interface IngestionOptions {
  repositoryUrl: string;
  analysisDepth?: 'basic' | 'comprehensive';
  realTimeUpdates?: boolean;
  populateCollections?: boolean;
}

export interface WebSocketEvents {
  'ingestion:progress': {
    jobId: string;
    progress: number;
    phase: string;
    repository: string;
    collectionsPopulated: number;
    totalCollections: number;
    metrics: {
      filesProcessed: number;
      nodesCreated: number;
      edgesCreated: number;
      securityIssues: number;
      performanceIssues: number;
    };
  };
  'ingestion:completed': {
    jobId: string;
    repository: any;
    totalCollections: number;
    phase: string;
    progress: number;
    metrics: any;
  };
  'ingestion:error': {
    jobId: string;
    error: string;
    repository: string;
  };
  'database-status': {
    connected: boolean;
    database: string;
    message: string;
  };
}

class IngestionService {
  private jobs: Map<string, IngestionJob> = new Map();
  private socket: Socket | null = null;
  private eventListeners: Array<(event: IngestionEvent) => void> = [];
  
  constructor() {
    this.initializeWebSocket();
  }

  /**
   * Initialize WebSocket connection to API Gateway
   */
  private initializeWebSocket(): void {
    try {
      this.socket = io(WEBSOCKET_URL);
      
      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected to API Gateway');
        this.emitEvent({ type: 'websocket-connected' });
      });
      
      this.socket.on('disconnect', () => {
        console.log('❌ WebSocket disconnected from API Gateway');
        this.emitEvent({ type: 'websocket-disconnected' });
      });
      
      // Real-time ingestion progress updates
      this.socket.on('ingestion:progress', (data) => {
        console.log('📊 Ingestion progress:', data);
        this.updateJobFromWebSocket(data.jobId, {
          progress: data.progress,
          phase: data.phase,
          collectionsPopulated: data.collectionsPopulated,
          metrics: data.metrics
        });
        this.emitEvent({ type: 'progress-update', jobId: data.jobId, data });
      });
      
      // Ingestion completion
      this.socket.on('ingestion:completed', (data) => {
        console.log('✅ Ingestion completed:', data);
        this.updateJobFromWebSocket(data.jobId, {
          status: 'completed',
          progress: 100,
          phase: 'Analysis complete',
          endTime: new Date().toISOString()
        });
        this.emitEvent({ type: 'ingestion-completed', jobId: data.jobId, data });
      });
      
      // Ingestion errors
      this.socket.on('ingestion:error', (data) => {
        console.error('❌ Ingestion error:', data);
        this.updateJobFromWebSocket(data.jobId, {
          status: 'failed',
          error: data.error,
          endTime: new Date().toISOString()
        });
        this.emitEvent({ type: 'ingestion-error', jobId: data.jobId, error: data.error });
      });
      
      // Database status updates
      this.socket.on('database-status', (data) => {
        console.log('🗄️ Database status:', data);
        this.emitEvent({ type: 'database-status', data });
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket:', error);
    }
  }

  /**
   * Start real repository ingestion via API Gateway
   */
  async startIngestion(repositoryUrl: string): Promise<string> {
    try {
      // Validate GitHub URL format
      const githubUrlPattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+(?:\.git)?$/;
      if (!githubUrlPattern.test(repositoryUrl)) {
        throw new Error('Invalid GitHub repository URL format');
      }

      console.log('🚀 Starting real repository ingestion:', repositoryUrl);
      
      // Call enhanced API gateway ingestion endpoint
      const response = await fetch(`${API_BASE_URL}/ingestion/repository/progressive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repositoryUrl,
          analysisDepth: 'comprehensive',
          realTimeUpdates: true,
          populateCollections: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start repository ingestion');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Repository ingestion request failed');
      }

      const jobId = result.data.jobId;
      
      // Create initial job record
      const job: IngestionJob = {
        id: jobId,
        repositoryUrl,
        status: 'running',
        progress: 0,
        phase: 'Initializing...',
        startTime: new Date().toISOString(),
        collectionsPopulated: 0,
        totalCollections: 49,
        metrics: {
          filesProcessed: 0,
          nodesCreated: 0,
          edgesCreated: 0,
          securityIssues: 0,
          performanceIssues: 0
        }
      };

      this.jobs.set(jobId, job);
      this.emitEvent({ type: 'job-created', jobId, job });

      console.log('✅ Repository ingestion started successfully:', jobId);
      return jobId;
      
    } catch (error) {
      console.error('❌ Failed to start repository ingestion:', error);
      throw error;
    }
  }

  /**
   * Get ingestion job status from API Gateway
   */
  async getJob(jobId: string): Promise<IngestionJob | null> {
    try {
      // First check local cache
      const localJob = this.jobs.get(jobId);
      if (localJob) {
        return localJob;
      }

      // Fetch from API Gateway
      const response = await fetch(`${API_BASE_URL}/ingestion/jobs/${jobId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch job status');
      }

      const result = await response.json();
      
      if (result.success) {
        const job = result.data;
        this.jobs.set(jobId, job);
        return job;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get job status:', error);
      return this.jobs.get(jobId) || null;
    }
  }

  /**
   * Get all jobs from API Gateway
   */
  async getAllJobs(): Promise<IngestionJob[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/ingestion/jobs`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }

      const result = await response.json();
      
      if (result.success) {
        // Update local cache
        result.data.forEach((job: IngestionJob) => {
          this.jobs.set(job.id, job);
        });
        return result.data;
      }
      
      // Fallback to local jobs
      return Array.from(this.jobs.values()).sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    } catch (error) {
      console.error('❌ Failed to fetch all jobs:', error);
      // Return local jobs as fallback
      return Array.from(this.jobs.values()).sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    }
  }

  /**
   * Get collections status from API Gateway
   */
  async getCollectionsStatus(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/collections/status`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch collections status');
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('❌ Failed to get collections status:', error);
      return null;
    }
  }

  /**
   * Get MCP analytics from API Gateway
   */
  async getAnalytics(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/mcp/analytics`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('❌ Failed to get analytics:', error);
      return null;
    }
  }

  /**
   * Add event listener for ingestion events
   */
  addEventListener(listener: (event: IngestionEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Check WebSocket connection status
   */
  isWebSocketConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get WebSocket instance for advanced usage
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Update job from WebSocket data
   */
  private updateJobFromWebSocket(jobId: string, updates: Partial<IngestionJob>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    Object.assign(job, updates);
    this.jobs.set(jobId, job);
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: IngestionEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('❌ Event listener error:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventListeners = [];
    this.jobs.clear();
  }


}

// Updated event interface for real API Gateway integration
export interface IngestionEvent {
  type: 'job-created' | 'job-updated' | 'job-completed' | 'job-failed' | 'progress-update' | 'ingestion-completed' | 'ingestion-error' | 
        'websocket-connected' | 'websocket-disconnected' | 'database-status';
  jobId?: string;
  job?: IngestionJob;
  data?: any;
  error?: string;
  message?: string;
}

// Export singleton instance - REAL API GATEWAY VERSION
export const ingestionService = new IngestionService();
export default ingestionService;

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    ingestionService.destroy();
  });
}
