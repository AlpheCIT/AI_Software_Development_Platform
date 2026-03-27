import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { apiClient } from '../lib/api/client';
import type { IngestionJob } from '../components/ingestion/RepositoryIngestionDashboard';

interface IngestionState {
  currentJob: IngestionJob | null;
  jobHistory: IngestionJob[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  startIngestion: (repositoryUrl: string) => Promise<void>;
  updateJobProgress: (jobId: string, progress: number, phase: string) => void;
  updateCollectionCount: (jobId: string, collection: string, count: number) => void;
  updateJobMetrics: (jobId: string, metrics: IngestionJob['metrics']) => void;
  completeJob: (jobId: string, metrics?: IngestionJob['metrics']) => void;
  failJob: (jobId: string, error: string) => void;
  clearCurrentJob: () => void;
  clearError: () => void;
}

export const useIngestionStore = create<IngestionState>()(
  devtools(
    persist(
      (set, get) => ({
        currentJob: null,
        jobHistory: [],
        isLoading: false,
        error: null,

        startIngestion: async (repositoryUrl: string) => {
          set({ isLoading: true, error: null });
          
          try {
            // Call the repository ingestion API
            const response = await apiClient.post('/api/v1/ingestion/repository/progressive', {
              repositoryUrl,
              analysisDepth: 'comprehensive',
              realTimeUpdates: true,
              populateCollections: true
            });

            const jobId = response.data.jobId;
            
            // Create initial job object
            const newJob: IngestionJob = {
              id: jobId,
              repositoryUrl,
              status: 'running',
              progress: 0,
              phase: 'Initializing...',
              startTime: new Date(),
              collectionsPopulated: 0,
              totalCollections: 130, // All expected collections
            };

            set({ 
              currentJob: newJob, 
              isLoading: false,
              error: null
            });

            // Add to history
            const { jobHistory } = get();
            set({ 
              jobHistory: [newJob, ...jobHistory].slice(0, 20) // Keep last 20 jobs
            });

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to start ingestion';
            set({ 
              isLoading: false, 
              error: errorMessage 
            });
            throw error;
          }
        },

        updateJobProgress: (jobId: string, progress: number, phase: string) => {
          set((state) => {
            if (state.currentJob && state.currentJob.id === jobId) {
              return {
                currentJob: {
                  ...state.currentJob,
                  progress,
                  phase
                }
              };
            }
            return state;
          });
        },

        updateCollectionCount: (jobId: string, collection: string, count: number) => {
          set((state) => {
            if (state.currentJob && state.currentJob.id === jobId) {
              const collectionsPopulated = state.currentJob.collectionsPopulated + 1;
              return {
                currentJob: {
                  ...state.currentJob,
                  collectionsPopulated: Math.min(collectionsPopulated, state.currentJob.totalCollections)
                }
              };
            }
            return state;
          });
        },

        updateJobMetrics: (jobId: string, metrics: IngestionJob['metrics']) => {
          set((state) => {
            if (state.currentJob && state.currentJob.id === jobId) {
              return {
                currentJob: {
                  ...state.currentJob,
                  metrics: {
                    ...state.currentJob.metrics,
                    ...metrics
                  }
                }
              };
            }
            return state;
          });
        },

        completeJob: (jobId: string, metrics?: IngestionJob['metrics']) => {
          set((state) => {
            if (state.currentJob && state.currentJob.id === jobId) {
              const completedJob: IngestionJob = {
                ...state.currentJob,
                status: 'completed',
                progress: 100,
                phase: 'Analysis Complete',
                endTime: new Date(),
                metrics: metrics || state.currentJob.metrics
              };

              // Update job in history
              const updatedHistory = state.jobHistory.map(job => 
                job.id === jobId ? completedJob : job
              );

              return {
                currentJob: completedJob,
                jobHistory: updatedHistory
              };
            }
            return state;
          });
        },

        failJob: (jobId: string, error: string) => {
          set((state) => {
            if (state.currentJob && state.currentJob.id === jobId) {
              const failedJob: IngestionJob = {
                ...state.currentJob,
                status: 'failed',
                endTime: new Date(),
                error
              };

              // Update job in history
              const updatedHistory = state.jobHistory.map(job => 
                job.id === jobId ? failedJob : job
              );

              return {
                currentJob: failedJob,
                jobHistory: updatedHistory,
                error
              };
            }
            return { error };
          });
        },

        clearCurrentJob: () => {
          set({ currentJob: null, error: null });
        },

        clearError: () => {
          set({ error: null });
        }
      }),
      {
        name: 'ingestion-store',
        partialize: (state) => ({
          jobHistory: state.jobHistory.slice(0, 10) // Only persist recent history
        }),
        onRehydrate: () => {
          // Clean up stale/zombie jobs on app startup
          return (state) => {
            if (!state) return;
            const MAX_RUNNING_AGE_MS = 30 * 60 * 1000; // 30 minutes max
            const now = Date.now();

            // Clear stale currentJob
            if (state.currentJob && state.currentJob.status === 'running') {
              const startTime = new Date(state.currentJob.startTime).getTime();
              if (now - startTime > MAX_RUNNING_AGE_MS) {
                state.currentJob = null;
              }
            }

            // Mark stale running jobs in history as failed
            state.jobHistory = state.jobHistory.map(job => {
              if (job.status === 'running') {
                const startTime = new Date(job.startTime).getTime();
                if (now - startTime > MAX_RUNNING_AGE_MS) {
                  return { ...job, status: 'failed' as const, error: 'Job timed out (stale)', endTime: new Date() };
                }
              }
              return job;
            });
          };
        }
      }
    ),
    {
      name: 'ingestion-store'
    }
  )
);