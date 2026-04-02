import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  Progress,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Card,
  CardBody,
  Badge,
  Divider,
  Spinner,
  useToast,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow
} from '@chakra-ui/react';
import { 
  Github, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Database,
  Activity,
  Clock,
  FileText
} from 'lucide-react';
import { useIngestionStore } from '../../stores/ingestion-store';
import { useWebSocket } from '../../hooks/useWebSocket';

const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || '';

export interface IngestionJob {
  id: string;
  repositoryUrl: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  phase: string;
  startTime: Date;
  endTime?: Date;
  collectionsPopulated: number;
  totalCollections: number;
  error?: string;
  metrics?: {
    filesProcessed: number;
    nodesCreated: number;
    edgesCreated: number;
    securityIssues: number;
    performanceIssues: number;
  };
}

export const RepositoryIngestionDashboard: React.FC = () => {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(false);
  const toast = useToast();
  
  const { 
    currentJob, 
    jobHistory, 
    isLoading, 
    startIngestion, 
    clearCurrentJob 
  } = useIngestionStore();

  // WebSocket connection for real-time updates
  const { socket, isConnected } = useWebSocket('/');

  // Load past QA runs into history on mount
  useEffect(() => {
    const loadPastRuns = async () => {
      if (jobHistory.length > 0) return; // Already have history
      try {
        const res = await fetch(`${QA_ENGINE_URL}/qa/runs`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.runs?.length) return;

        const pastJobs = data.runs.slice(0, 10).map((run: any) => ({
          id: run.runId || run.id,
          repositoryUrl: run.repoUrl || run.repository || '',
          status: run.status === 'completed' ? 'completed' as const : 'failed' as const,
          progress: 100,
          phase: 'Completed',
          startTime: new Date(run.startedAt || run.date),
          endTime: run.completedAt ? new Date(run.completedAt) : undefined,
          collectionsPopulated: 0,
          totalCollections: 0,
          metrics: {
            filesAnalyzed: run.filesAnalyzed || run.tests || 0,
            entitiesExtracted: 0,
            securityIssues: 0,
            performanceIssues: 0,
          },
        }));

        useIngestionStore.setState({ jobHistory: pastJobs });
      } catch {
        // QA engine may not be running
      }
    };
    loadPastRuns();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('ingestion:progress', handleProgressUpdate);
      socket.on('ingestion:phase-completed', handlePhaseComplete);
      socket.on('ingestion:collection-updated', handleCollectionUpdate);
      socket.on('ingestion:completed', handleIngestionComplete);
      socket.on('ingestion:error', handleIngestionError);
    }

    return () => {
      if (socket) {
        socket.off('ingestion:progress');
        socket.off('ingestion:phase-completed');
        socket.off('ingestion:collection-updated');
        socket.off('ingestion:completed');
        socket.off('ingestion:error');
      }
    };
  }, [socket]);

  const handleProgressUpdate = (data: { jobId: string; progress: number; phase: string }) => {
    // Update progress in store
    useIngestionStore.getState().updateJobProgress(data.jobId, data.progress, data.phase);
  };

  const handlePhaseComplete = (data: { jobId: string; phase: string; metrics: any }) => {
    toast({
      title: `Phase Complete: ${data.phase}`,
      description: `Analysis phase completed successfully`,
      status: 'success',
      duration: 3000,
    });
  };

  const handleCollectionUpdate = (data: { jobId: string; collection: string; count: number }) => {
    // Update collection count in store
    useIngestionStore.getState().updateCollectionCount(data.jobId, data.collection, data.count);
  };

  const handleIngestionComplete = (data: { jobId: string; metrics: any }) => {
    toast({
      title: 'Repository Analysis Complete!',
      description: `Successfully analyzed repository with comprehensive insights`,
      status: 'success',
      duration: 5000,
    });
  };

  const handleIngestionError = (data: { jobId: string; error: string }) => {
    toast({
      title: 'Ingestion Error',
      description: data.error,
      status: 'error',
      duration: 5000,
    });
  };

  const validateRepositoryUrl = (url: string) => {
    const githubUrlPattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+(?:\.git)?$/;
    const isValid = githubUrlPattern.test(url);
    setIsValidUrl(isValid);
    return isValid;
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setRepositoryUrl(url);
    validateRepositoryUrl(url);
  };

  const handleStartIngestion = async () => {
    if (!isValidUrl || !repositoryUrl) {
      toast({
        title: 'Invalid Repository URL',
        description: 'Please enter a valid GitHub repository URL',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      await startIngestion(repositoryUrl);
      toast({
        title: 'Ingestion Started',
        description: 'Repository analysis has begun. Watch the progress below.',
        status: 'info',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Failed to Start Ingestion',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'running': return 'blue';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} />;
      case 'running': return <Spinner size="sm" />;
      case 'failed': return <AlertCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const formatDuration = (start: Date | string | undefined, end?: Date | string) => {
    if (!start) return '0m 0s';
    
    const startTime = start instanceof Date ? start : new Date(start);
    const endTime = end ? (end instanceof Date ? end : new Date(end)) : new Date();
    
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return '0m 0s';
    }
    
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <Box p={6} maxW="100%" mx="auto">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <Box>
            <Text fontSize="2xl" fontWeight="bold" color="gray.800">
              Repository Analysis Dashboard
            </Text>
            <Text color="gray.600">
              Ingest and analyze any GitHub repository with comprehensive AI-powered insights
            </Text>
          </Box>
          <HStack spacing={2}>
            <Badge colorScheme={isConnected ? 'green' : 'gray'} variant={isConnected ? 'solid' : 'subtle'}>
              {isConnected ? 'Live' : 'Standalone'}
            </Badge>
            <Activity size={16} color={isConnected ? 'green' : 'gray'} />
          </HStack>
        </HStack>

        {/* Repository Input */}
        <Card>
          <CardBody>
            <VStack spacing={4}>
              <HStack w="100%" spacing={4}>
                <Box flex="1">
                  <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.700">
                    GitHub Repository URL
                  </Text>
                  <HStack>
                    <Github size={20} color="gray" />
                    <Input
                      placeholder="https://github.com/username/repository"
                      value={repositoryUrl}
                      onChange={handleUrlChange}
                      isInvalid={repositoryUrl.length > 0 && !isValidUrl}
                      size="lg"
                    />
                  </HStack>
                </Box>
                <Button
                  colorScheme="blue"
                  size="lg"
                  leftIcon={<Play size={16} />}
                  onClick={handleStartIngestion}
                  isDisabled={!isValidUrl || isLoading}
                  isLoading={isLoading}
                  loadingText="Starting..."
                  minW="120px"
                >
                  Analyze
                </Button>
              </HStack>
              
              {repositoryUrl.length > 0 && !isValidUrl && (
                <Alert status="error" size="sm">
                  <AlertIcon />
                  Please enter a valid GitHub repository URL
                </Alert>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* Current Job Progress */}
        {currentJob && (
          <Card key="current-job-card">
            <CardBody>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="lg" fontWeight="bold">
                    Analyzing: {currentJob.repositoryUrl.split('/').pop()}
                  </Text>
                  <HStack>
                    {getStatusIcon(currentJob.status)}
                    <Badge colorScheme={getStatusColor(currentJob.status)}>
                      {currentJob.status.toUpperCase()}
                    </Badge>
                  </HStack>
                </HStack>

                <Box>
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="sm" color="gray.600">
                      Current Phase: {currentJob.phase}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {currentJob.progress}%
                    </Text>
                  </HStack>
                  <Progress
                    value={currentJob.progress}
                    colorScheme="blue"
                    size="lg"
                    borderRadius="md"
                  />
                </Box>

                {/* Collection Progress */}
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    Database Collections ({currentJob.collectionsPopulated}/{currentJob.totalCollections})
                  </Text>
                  <Progress
                    value={(currentJob.collectionsPopulated / currentJob.totalCollections) * 100}
                    colorScheme="green"
                    size="sm"
                    borderRadius="md"
                  />
                </Box>

                {/* Real-time Metrics */}
                {currentJob.metrics && (
                  <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4}>
                    <Stat key="files" size="sm">
                      <StatLabel>Files</StatLabel>
                      <StatNumber>{currentJob.metrics.filesProcessed}</StatNumber>
                    </Stat>
                    <Stat key="nodes" size="sm">
                      <StatLabel>Nodes</StatLabel>
                      <StatNumber>{currentJob.metrics.nodesCreated}</StatNumber>
                    </Stat>
                    <Stat key="edges" size="sm">
                      <StatLabel>Edges</StatLabel>
                      <StatNumber>{currentJob.metrics.edgesCreated}</StatNumber>
                    </Stat>
                    <Stat key="security" size="sm">
                      <StatLabel>Security</StatLabel>
                      <StatNumber color={currentJob.metrics.securityIssues > 0 ? 'red.500' : 'green.500'}>
                        {currentJob.metrics.securityIssues}
                      </StatNumber>
                      <StatHelpText>Issues</StatHelpText>
                    </Stat>
                    <Stat key="performance" size="sm">
                      <StatLabel>Performance</StatLabel>
                      <StatNumber color={currentJob.metrics.performanceIssues > 0 ? 'orange.500' : 'green.500'}>
                        {currentJob.metrics.performanceIssues}
                      </StatNumber>
                      <StatHelpText>Issues</StatHelpText>
                    </Stat>
                  </SimpleGrid>
                )}

                {/* Error Display */}
                {currentJob.status === 'failed' && currentJob.error && (
                  <Alert status="error">
                    <AlertIcon />
                    <Box>
                      <AlertTitle>Ingestion Failed</AlertTitle>
                      <AlertDescription>{currentJob.error}</AlertDescription>
                    </Box>
                  </Alert>
                )}
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Job History */}
        {jobHistory.length > 0 && (
          <Card key="job-history-card">
            <CardBody>
              <Text fontSize="lg" fontWeight="bold" mb={4}>
                Recent Analysis History
              </Text>
              <VStack spacing={3} align="stretch">
                {jobHistory
                  .filter((job) => {
                    // Filter out stale running jobs (>30 min old)
                    if (job.status === 'running' && job.startTime) {
                      const age = Date.now() - new Date(job.startTime).getTime();
                      return age < 30 * 60 * 1000;
                    }
                    return true;
                  })
                  .slice(0, 5).map((job, index) => (
                  <Box key={job.id || `job-${index}`}>
                    <HStack justify="space-between">
                      <HStack>
                        {getStatusIcon(job.status)}
                        <Text fontWeight="medium">
                          {job.repositoryUrl.split('/').pop()}
                        </Text>
                        <Badge colorScheme={getStatusColor(job.status)} size="sm">
                          {job.status}
                        </Badge>
                      </HStack>
                      <HStack spacing={4}>
                        {job.metrics && (
                          <HStack spacing={2}>
                            <Text fontSize="xs" color="gray.500">
                              {job.metrics.filesProcessed} files
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              {job.metrics.nodesCreated} nodes
                            </Text>
                            {job.metrics.securityIssues > 0 && (
                              <Text fontSize="xs" color="red.500">
                                {job.metrics.securityIssues} security issues
                              </Text>
                            )}
                          </HStack>
                        )}
                        <Text fontSize="xs" color="gray.500">
                          {formatDuration(job.startTime, job.endTime)}
                        </Text>
                      </HStack>
                    </HStack>
                    {job !== jobHistory[jobHistory.length - 1] && <Divider mt={3} />}
                  </Box>
                ))}
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Demo Instructions */}
        {!currentJob && jobHistory.length === 0 && (
          <Card key="demo-repositories-card" borderColor="blue.200" borderWidth="1px">
            <CardBody>
              <VStack spacing={3} align="start">
                <HStack>
                  <FileText size={20} color="blue" />
                  <Text fontSize="lg" fontWeight="bold" color="blue.600">
                    Try These Demo Repositories
                  </Text>
                </HStack>
                <VStack spacing={2} align="start" pl={6}>
                  <Button
                    variant="link"
                    color="blue.500"
                    size="sm"
                    onClick={() => {
                      setRepositoryUrl('https://github.com/facebook/react');
                      setIsValidUrl(true);
                    }}
                  >
                    https://github.com/facebook/react (Large React project)
                  </Button>
                  <Button
                    variant="link"
                    color="blue.500"
                    size="sm"
                    onClick={() => {
                      setRepositoryUrl('https://github.com/express/express');
                      setIsValidUrl(true);
                    }}
                  >
                    https://github.com/express/express (Node.js framework)
                  </Button>
                  <Button
                    variant="link"
                    color="blue.500"
                    size="sm"
                    onClick={() => {
                      setRepositoryUrl('https://github.com/microsoft/typescript');
                      setIsValidUrl(true);
                    }}
                  >
                    https://github.com/microsoft/typescript (TypeScript compiler)
                  </Button>
                </VStack>
              </VStack>
            </CardBody>
          </Card>
        )}
      </VStack>
    </Box>
  );
};

export default RepositoryIngestionDashboard;