/**
 * Repository Ingestion Dashboard
 * 
 * Real-time dashboard for repository ingestion progress, job management,
 * and ingestion analytics with WebSocket integration.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CloudDownload as IngestionIcon,
  Analytics as AnalyticsIcon,
  Timeline as ProgressIcon,
  CheckCircle as CompleteIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';

// Hooks
import { useWebSocket } from '../../hooks/useWebSocket';
import { useNotifications } from '../../hooks/useNotifications';

// Utils
import { apiClient } from '../../utils/apiClient';

interface IngestionJob {
  jobId: string;
  repositoryUrl: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  phase: string;
  startTime: string;
  endTime?: string;
  config: {
    analysisDepth: 'shallow' | 'medium' | 'deep';
    realTimeUpdates: boolean;
    populateCollections: boolean;
  };
  metrics: {
    filesProcessed: number;
    functionsExtracted: number;
    dependenciesFound: number;
    securityIssues: number;
    qualityScore: number;
    collectionsPopulated: string[];
  };
}

interface IngestionMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  totalRepositories: number;
  totalCollectionsPopulated: number;
}

const IngestionDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [metrics, setMetrics] = useState<IngestionMetrics | null>(null);
  const [newJobDialog, setNewJobDialog] = useState(false);
  const [jobDetailsDialog, setJobDetailsDialog] = useState<IngestionJob | null>(null);
  const [loading, setLoading] = useState(false);
  
  // New job form state
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [analysisDepth, setAnalysisDepth] = useState<'shallow' | 'medium' | 'deep'>('medium');
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  const [populateCollections, setPopulateCollections] = useState(true);

  const { isConnected, socket } = useWebSocket();
  const { addNotification } = useNotifications();

  // Load initial data
  useEffect(() => {
    loadJobs();
    loadMetrics();
  }, []);

  // WebSocket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleIngestionProgress = (data: any) => {
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.jobId === data.jobId 
            ? { ...job, progress: data.progress, phase: data.phase, metrics: data.metrics }
            : job
        )
      );
    };

    const handleIngestionCompleted = (data: any) => {
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.jobId === data.jobId 
            ? { ...job, status: 'completed', progress: 100, phase: data.phase, endTime: new Date().toISOString() }
            : job
        )
      );
      
      addNotification({
        type: 'success',
        message: `Repository ${data.repository} ingestion completed successfully!`
      });
      
      loadMetrics(); // Refresh metrics
    };

    const handleIngestionFailed = (data: any) => {
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.jobId === data.jobId 
            ? { ...job, status: 'failed', phase: `Error: ${data.error}`, endTime: new Date().toISOString() }
            : job
        )
      );
      
      addNotification({
        type: 'error',
        message: `Repository ${data.repository} ingestion failed: ${data.error}`
      });
    };

    socket.on('ingestion:progress', handleIngestionProgress);
    socket.on('ingestion:completed', handleIngestionCompleted);
    socket.on('ingestion:failed', handleIngestionFailed);

    return () => {
      socket.off('ingestion:progress', handleIngestionProgress);
      socket.off('ingestion:completed', handleIngestionCompleted);
      socket.off('ingestion:failed', handleIngestionFailed);
    };
  }, [socket, addNotification]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/v1/ingestion/jobs');
      setJobs(response.data.jobs || []);
    } catch (error) {
      console.error('Failed to load ingestion jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      const response = await apiClient.get('/api/v1/ingestion/metrics');
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to load ingestion metrics:', error);
    }
  };

  const startIngestion = async () => {
    if (!repositoryUrl.trim()) {
      addNotification({
        type: 'error',
        message: 'Repository URL is required'
      });
      return;
    }

    try {
      const response = await apiClient.post('/api/v1/ingestion/repository/progressive', {
        repositoryUrl: repositoryUrl.trim(),
        analysisDepth,
        realTimeUpdates,
        populateCollections
      });

      const newJob: IngestionJob = {
        jobId: response.data.jobId,
        repositoryUrl: repositoryUrl.trim(),
        status: 'pending',
        progress: 0,
        phase: 'Initializing...',
        startTime: new Date().toISOString(),
        config: { analysisDepth, realTimeUpdates, populateCollections },
        metrics: {
          filesProcessed: 0,
          functionsExtracted: 0,
          dependenciesFound: 0,
          securityIssues: 0,
          qualityScore: 0,
          collectionsPopulated: []
        }
      };

      setJobs(prev => [newJob, ...prev]);
      setNewJobDialog(false);
      setRepositoryUrl('');
      
      addNotification({
        type: 'success',
        message: 'Repository ingestion started successfully!'
      });

    } catch (error: any) {
      addNotification({
        type: 'error',
        message: `Failed to start ingestion: ${error.message}`
      });
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      await apiClient.post(`/api/v1/ingestion/jobs/${jobId}/cancel`);
      
      setJobs(prev => 
        prev.map(job => 
          job.jobId === jobId 
            ? { ...job, status: 'cancelled', endTime: new Date().toISOString() }
            : job
        )
      );
      
      addNotification({
        type: 'info',
        message: 'Ingestion job cancelled successfully'
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: `Failed to cancel job: ${error.message}`
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CompleteIcon color="success" />;
      case 'failed':
      case 'cancelled':
        return <ErrorIcon color="error" />;
      case 'running':
        return <ProgressIcon color="primary" />;
      default:
        return <PendingIcon color="action" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
      case 'cancelled':
        return 'error';
      case 'running':
        return 'primary';
      default:
        return 'default';
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) {
      return `${duration}s`;
    } else if (duration < 3600) {
      return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    } else {
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Repository Ingestion Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={<IngestionIcon />}
          onClick={() => setNewJobDialog(true)}
        >
          Start New Ingestion
        </Button>
      </Box>

      {/* Connection Status */}
      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          WebSocket connection lost. Real-time updates are unavailable.
        </Alert>
      )}

      {/* Metrics Cards */}
      {metrics && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Jobs
                </Typography>
                <Typography variant="h4">
                  {metrics.totalJobs}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Completed
                </Typography>
                <Typography variant="h4" color="success.main">
                  {metrics.completedJobs}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Failed
                </Typography>
                <Typography variant="h4" color="error.main">
                  {metrics.failedJobs}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Avg. Processing Time
                </Typography>
                <Typography variant="h4">
                  {Math.round(metrics.averageProcessingTime / 60)}m
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Active Jobs */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Active Jobs
            </Typography>
            <IconButton onClick={loadJobs} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Box>

          {jobs.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No ingestion jobs found. Start a new ingestion to see progress here.
            </Typography>
          ) : (
            <List>
              {jobs.map((job, index) => (
                <React.Fragment key={job.jobId}>
                  <ListItem>
                    <Box sx={{ width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        {getStatusIcon(job.status)}
                        <Typography variant="subtitle1" sx={{ ml: 1, flexGrow: 1 }}>
                          {job.repositoryUrl}
                        </Typography>
                        <Chip 
                          label={job.status} 
                          size="small" 
                          color={getStatusColor(job.status) as any}
                          sx={{ mr: 1 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {formatDuration(job.startTime, job.endTime)}
                        </Typography>
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {job.phase}
                      </Typography>
                      
                      {job.status === 'running' && (
                        <Box sx={{ mb: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={job.progress} 
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {job.progress}% complete
                          </Typography>
                        </Box>
                      )}
                      
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Chip 
                          label={`Files: ${job.metrics.filesProcessed}`} 
                          size="small" 
                          variant="outlined"
                        />
                        <Chip 
                          label={`Functions: ${job.metrics.functionsExtracted}`} 
                          size="small" 
                          variant="outlined"
                        />
                        <Chip 
                          label={`Dependencies: ${job.metrics.dependenciesFound}`} 
                          size="small" 
                          variant="outlined"
                        />
                        {job.metrics.qualityScore > 0 && (
                          <Chip 
                            label={`Quality: ${job.metrics.qualityScore}`} 
                            size="small" 
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                    
                    <ListItemSecondaryAction>
                      <IconButton 
                        onClick={() => setJobDetailsDialog(job)}
                        size="small"
                      >
                        <ViewIcon />
                      </IconButton>
                      {job.status === 'running' && (
                        <IconButton 
                          onClick={() => cancelJob(job.jobId)}
                          size="small"
                          color="error"
                        >
                          <StopIcon />
                        </IconButton>
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < jobs.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* New Job Dialog */}
      <Dialog open={newJobDialog} onClose={() => setNewJobDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Start New Repository Ingestion</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Repository URL"
            type="url"
            fullWidth
            variant="outlined"
            value={repositoryUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRepositoryUrl(e.target.value)}
            placeholder="https://github.com/user/repository"
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Analysis Depth</InputLabel>
            <Select
              value={analysisDepth}
              label="Analysis Depth"
              onChange={(e: any) => setAnalysisDepth(e.target.value as any)}
            >
              <MenuItem value="shallow">Shallow - Basic structure only</MenuItem>
              <MenuItem value="medium">Medium - Standard analysis</MenuItem>
              <MenuItem value="deep">Deep - Comprehensive analysis</MenuItem>
            </Select>
          </FormControl>
          
          <FormControlLabel
            control={
              <Switch 
                checked={realTimeUpdates} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRealTimeUpdates(e.target.checked)} 
              />
            }
            label="Real-time progress updates"
            sx={{ mb: 1 }}
          />
          
          <FormControlLabel
            control={
              <Switch 
                checked={populateCollections} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPopulateCollections(e.target.checked)} 
              />
            }
            label="Populate database collections"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewJobDialog(false)}>Cancel</Button>
          <Button onClick={startIngestion} variant="contained">
            Start Ingestion
          </Button>
        </DialogActions>
      </Dialog>

      {/* Job Details Dialog */}
      <Dialog 
        open={!!jobDetailsDialog} 
        onClose={() => setJobDetailsDialog(null)} 
        maxWidth="md" 
        fullWidth
      >
        {jobDetailsDialog && (
          <>
            <DialogTitle>
              Ingestion Job Details
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="h6" gutterBottom>
                    {jobDetailsDialog.repositoryUrl}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip 
                      label={jobDetailsDialog.status} 
                      color={getStatusColor(jobDetailsDialog.status) as any}
                    />
                    <Chip 
                      label={jobDetailsDialog.config.analysisDepth} 
                      variant="outlined"
                    />
                  </Box>
                </Grid>
                
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Progress Information
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell>Status</TableCell>
                          <TableCell>{jobDetailsDialog.status}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Progress</TableCell>
                          <TableCell>{jobDetailsDialog.progress}%</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Current Phase</TableCell>
                          <TableCell>{jobDetailsDialog.phase}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Duration</TableCell>
                          <TableCell>
                            {formatDuration(jobDetailsDialog.startTime, jobDetailsDialog.endTime)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Processing Metrics
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell>Files Processed</TableCell>
                          <TableCell>{jobDetailsDialog.metrics.filesProcessed}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Functions Extracted</TableCell>
                          <TableCell>{jobDetailsDialog.metrics.functionsExtracted}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Dependencies Found</TableCell>
                          <TableCell>{jobDetailsDialog.metrics.dependenciesFound}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Security Issues</TableCell>
                          <TableCell>{jobDetailsDialog.metrics.securityIssues}</TableCell>
                        </TableRow>
                        {jobDetailsDialog.metrics.qualityScore > 0 && (
                          <TableRow>
                            <TableCell>Quality Score</TableCell>
                            <TableCell>{jobDetailsDialog.metrics.qualityScore}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                
                {jobDetailsDialog.metrics.collectionsPopulated.length > 0 && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Collections Populated
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {jobDetailsDialog.metrics.collectionsPopulated.map((collection) => (
                        <Chip 
                          key={collection} 
                          label={collection} 
                          size="small" 
                          variant="outlined"
                          color="success"
                        />
                      ))}
                    </Box>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setJobDetailsDialog(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default IngestionDashboard;


