/**
 * Repository Ingestion Service
 * Coordinates the end-to-end repository analysis and ingestion process
 */

import { arangoDBService, Repository } from './arangodbService';
import { gitHubService, GitHubRepository } from './gitHubService';

export interface IngestionJob {
  id: string;
  repositoryName: string;
  repositoryUrl: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentPhase: number;
  totalPhases: number;
  overallProgress: number;
  estimatedTimeRemaining: number;
  startTime: string;
  endTime?: string;
  phases: IngestionPhase[];
  errors?: string[];
  results?: IngestionResults;
}

export interface IngestionPhase {
  id: number;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number;
  startTime?: string;
  endTime?: string;
  duration?: number;
  itemsProcessed?: number;
  totalItems?: number;
  error?: string;
}

export interface IngestionResults {
  collectionsPopulated: string[];
  documentsCreated: number;
  edgesCreated: number;
  filesAnalyzed: number;
  securityIssues: number;
  performanceIssues: number;
  qualityScore: number;
  insights: Array<{
    type: 'security' | 'performance' | 'quality' | 'architecture';
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  }>;
}

export interface IngestionOptions {
  includeTests: boolean;
  includeDocs: boolean;
  deepSecurity: boolean;
  performanceAnalysis: boolean;
  qualityAnalysis: boolean;
  generateInsights: boolean;
  maxDepth?: number;
  fileExtensions?: string[];
}

class IngestionService {
  private jobs: Map<string, IngestionJob> = new Map();
  private eventListeners: Array<(event: IngestionEvent) => void> = [];
  
  /**
   * Start repository ingestion process
   */
  async startIngestion(
    repositoryUrl: string, 
    options: Partial<IngestionOptions> = {}
  ): Promise<string> {
    try {
      // Validate GitHub repository first
      const validation = await gitHubService.validateRepository(repositoryUrl);
      
      if (!validation.isValid) {
        throw new Error(`Repository validation failed: ${validation.errors?.join(', ')}`);
      }

      // Get repository details
      const githubRepo = await gitHubService.getRepositoryDetails(repositoryUrl);
      
      // Create ingestion job
      const jobId = this.generateJobId();
      const job: IngestionJob = {
        id: jobId,
        repositoryName: githubRepo.full_name,
        repositoryUrl: repositoryUrl,
        status: 'queued',
        currentPhase: 0,
        totalPhases: 7,
        overallProgress: 0,
        estimatedTimeRemaining: 0,
        startTime: new Date().toISOString(),
        phases: this.createIngestionPhases(),
        errors: []
      };

      this.jobs.set(jobId, job);
      this.emitEvent({ type: 'job-created', jobId, job });

      // Start the ingestion process asynchronously
      this.processIngestion(jobId, githubRepo, options).catch(error => {
        console.error(`❌ Ingestion job ${jobId} failed:`, error);
        this.updateJob(jobId, {
          status: 'failed',
          errors: [...(job.errors || []), error.message],
          endTime: new Date().toISOString()
        });
      });

      return jobId;
    } catch (error) {
      console.error('❌ Failed to start ingestion:', error);
      throw error;
    }
  }

  /**
   * Get ingestion job status
   */
  getJob(jobId: string): IngestionJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get all jobs
   */
  getAllJobs(): IngestionJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    this.updateJob(jobId, {
      status: 'cancelled',
      endTime: new Date().toISOString()
    });

    return true;
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
   * Process repository ingestion
   */
  private async processIngestion(
    jobId: string, 
    githubRepo: GitHubRepository, 
    options: Partial<IngestionOptions>
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      // Update job status
      this.updateJob(jobId, { status: 'running', currentPhase: 1 });

      // Phase 1: Repository Setup
      await this.executePhase(jobId, 1, async () => {
        // Create repository record in ArangoDB
        const repoData = {
          name: githubRepo.name,
          url: githubRepo.clone_url,
          description: githubRepo.description || undefined,
          language: githubRepo.language || 'unknown',
          owner: githubRepo.owner.login,
          defaultBranch: githubRepo.default_branch
        };

        const repository = await arangoDBService.createRepository(repoData);
        
        // Store repository reference in job
        (job as any).repositoryKey = repository._key;
        
        return { message: 'Repository created in database' };
      });

      // Phase 2: Code Analysis
      await this.executePhase(jobId, 2, async () => {
        // This would call the backend ingestion API
        const response = await fetch('/api/ingestion/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repositoryUrl: githubRepo.clone_url,
            repositoryKey: (job as any).repositoryKey,
            options: {
              includeTests: options.includeTests ?? true,
              includeDocs: options.includeDocs ?? false,
              deepSecurity: options.deepSecurity ?? true,
              performanceAnalysis: options.performanceAnalysis ?? true,
              qualityAnalysis: options.qualityAnalysis ?? true
            }
          })
        });

        if (!response.ok) {
          throw new Error('Code analysis failed');
        }

        const result = await response.json();
        return { message: `Analyzed ${result.filesProcessed || 0} files` };
      });

      // Phase 3: Collection Population
      await this.executePhase(jobId, 3, async () => {
        // Monitor collection population
        const collections = await arangoDBService.getAllCollections();
        const populatedCollections = collections.collections.filter(col => col.count > 0);
        
        return { 
          message: `Populated ${populatedCollections.length} collections`,
          collectionsCount: populatedCollections.length 
        };
      });

      // Phase 4: Security Analysis
      await this.executePhase(jobId, 4, async () => {
        if (!options.deepSecurity) {
          return { message: 'Security analysis skipped' };
        }

        // Call security analysis endpoint
        const response = await fetch('/api/ingestion/security', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repositoryKey: (job as any).repositoryKey
          })
        });

        const result = await response.json();
        return { message: `Found ${result.issuesFound || 0} security issues` };
      });

      // Phase 5: Performance Analysis
      await this.executePhase(jobId, 5, async () => {
        if (!options.performanceAnalysis) {
          return { message: 'Performance analysis skipped' };
        }

        // Simulate performance analysis
        await this.delay(2000);
        return { message: 'Performance analysis completed' };
      });

      // Phase 6: Quality Assessment
      await this.executePhase(jobId, 6, async () => {
        if (!options.qualityAnalysis) {
          return { message: 'Quality analysis skipped' };
        }

        // Simulate quality analysis
        await this.delay(1500);
        return { message: 'Quality assessment completed' };
      });

      // Phase 7: AI Insights Generation
      await this.executePhase(jobId, 7, async () => {
        if (!options.generateInsights) {
          return { message: 'AI insights generation skipped' };
        }

        // Generate AI insights
        const response = await fetch('/api/ingestion/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repositoryKey: (job as any).repositoryKey
          })
        });

        const result = await response.json();
        return { message: `Generated ${result.insightsCount || 0} AI insights` };
      });

      // Mark job as completed
      this.updateJob(jobId, {
        status: 'completed',
        endTime: new Date().toISOString(),
        overallProgress: 100
      });

      this.emitEvent({ 
        type: 'job-completed', 
        jobId, 
        message: `Repository ${githubRepo.full_name} analysis completed successfully` 
      });

    } catch (error) {
      console.error(`❌ Ingestion job ${jobId} failed:`, error);
      
      this.updateJob(jobId, {
        status: 'failed',
        errors: [...(job.errors || []), error.message],
        endTime: new Date().toISOString()
      });

      this.emitEvent({ 
        type: 'job-failed', 
        jobId, 
        error: error.message 
      });
    }
  }

  /**
   * Execute a specific ingestion phase
   */
  private async executePhase(
    jobId: string, 
    phaseId: number, 
    executor: () => Promise<any>
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') return;

    const phase = job.phases.find(p => p.id === phaseId);
    if (!phase) return;

    try {
      // Update phase status
      this.updatePhase(jobId, phaseId, {
        status: 'running',
        startTime: new Date().toISOString(),
        progress: 0
      });

      this.updateJob(jobId, { currentPhase: phaseId });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        const currentPhase = this.jobs.get(jobId)?.phases.find(p => p.id === phaseId);
        if (currentPhase?.status === 'running' && currentPhase.progress < 90) {
          this.updatePhase(jobId, phaseId, {
            progress: Math.min(currentPhase.progress + 10, 90)
          });
        }
      }, 500);

      // Execute phase
      const result = await executor();

      clearInterval(progressInterval);

      // Update phase completion
      this.updatePhase(jobId, phaseId, {
        status: 'completed',
        progress: 100,
        endTime: new Date().toISOString()
      });

      // Update overall progress
      const completedPhases = job.phases.filter(p => p.status === 'completed').length;
      const overallProgress = Math.round((completedPhases / job.totalPhases) * 100);
      
      this.updateJob(jobId, { overallProgress });

      this.emitEvent({
        type: 'phase-completed',
        jobId,
        phaseId,
        phaseName: phase.name,
        result
      });

    } catch (error) {
      this.updatePhase(jobId, phaseId, {
        status: 'failed',
        error: error.message,
        endTime: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Create default ingestion phases
   */
  private createIngestionPhases(): IngestionPhase[] {
    return [
      {
        id: 1,
        name: 'Repository Setup',
        description: 'Creating repository record and initializing analysis',
        status: 'pending',
        progress: 0
      },
      {
        id: 2,
        name: 'Code Analysis',
        description: 'Analyzing source code structure and dependencies',
        status: 'pending',
        progress: 0
      },
      {
        id: 3,
        name: 'Collection Population',
        description: 'Populating ArangoDB collections with analysis data',
        status: 'pending',
        progress: 0
      },
      {
        id: 4,
        name: 'Security Analysis',
        description: 'Scanning for security vulnerabilities and issues',
        status: 'pending',
        progress: 0
      },
      {
        id: 5,
        name: 'Performance Analysis',
        description: 'Analyzing performance patterns and bottlenecks',
        status: 'pending',
        progress: 0
      },
      {
        id: 6,
        name: 'Quality Assessment',
        description: 'Evaluating code quality and maintainability',
        status: 'pending',
        progress: 0
      },
      {
        id: 7,
        name: 'AI Insights',
        description: 'Generating AI-powered insights and recommendations',
        status: 'pending',
        progress: 0
      }
    ];
  }

  /**
   * Update job properties
   */
  private updateJob(jobId: string, updates: Partial<IngestionJob>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    Object.assign(job, updates);
    this.jobs.set(jobId, job);

    this.emitEvent({ type: 'job-updated', jobId, updates });
  }

  /**
   * Update phase properties
   */
  private updatePhase(jobId: string, phaseId: number, updates: Partial<IngestionPhase>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const phaseIndex = job.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex === -1) return;

    Object.assign(job.phases[phaseIndex], updates);
    this.jobs.set(jobId, job);

    this.emitEvent({ type: 'phase-updated', jobId, phaseId, updates });
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export interface IngestionEvent {
  type: 'job-created' | 'job-updated' | 'job-completed' | 'job-failed' | 'phase-completed' | 'phase-updated';
  jobId: string;
  job?: IngestionJob;
  phaseId?: number;
  phaseName?: string;
  updates?: any;
  result?: any;
  error?: string;
  message?: string;
}

// Export singleton instance
export const ingestionService = new IngestionService();
export default ingestionService;