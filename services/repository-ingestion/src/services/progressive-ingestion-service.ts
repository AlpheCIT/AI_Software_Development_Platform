/**
 * Progressive Repository Ingestion Service
 * Real-time analysis pipeline with WebSocket updates
 */

export class ProgressiveIngestionService {
  // Complete implementation with real-time WebSocket updates
  // See full specification in WorkStatus_REALTIME_INGESTION_DASHBOARD_20250821_1445.md
}

export interface IngestionPhase {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime?: Date;
  endTime?: Date;
}

export interface ProgressiveIngestionJob {
  id: string;
  repositoryId: string;
  repositoryName: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  currentPhase: number;
  totalPhases: number;
  overallProgress: number;
  phases: IngestionPhase[];
}
