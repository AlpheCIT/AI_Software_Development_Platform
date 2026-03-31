/**
 * Live Ingestion Dashboard Component
 * Real-time visualization of repository ingestion progress
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Progress,
  Card,
  CardHeader,
  CardBody,
  Badge,
  SimpleGrid,
  Stepper,
  Step,
  StepIndicator,
  StepStatus,
  StepTitle,
  StepDescription,
  StepSeparator,
  Spinner,
  Icon,
  Button,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Heading,
  Divider,
  Stat,
  StatLabel,
  StatNumber,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton
} from '@chakra-ui/react';
import {
  Square,
  CheckCircle,
  Eye,
  Clock,
  Database,
  GitBranch,
  Shield,
  Zap,
  BarChart3,
  Bot
} from 'lucide-react';
import { ingestionService, IngestionJob, IngestionEvent } from '../../services/ingestionService';
import { arangoDBService } from '../../services/arangodbService';

interface LiveIngestionDashboardProps {
  jobId?: string;
  onJobComplete?: (jobId: string) => void;
  onJobFailed?: (jobId: string, error: string) => void;
}

export function LiveIngestionDashboard({ 
  jobId, 
  onJobComplete, 
  onJobFailed 
}: LiveIngestionDashboardProps) {
  const [job, setJob] = useState<IngestionJob | null>(null);
  const [collectionStats, setCollectionStats] = useState<any[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const toast = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'blue';
      case 'completed': return 'green';
      case 'failed': return 'red';
      case 'cancelled': return 'orange';
      default: return 'gray';
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return '< 1s';
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  };

  // Load job data and subscribe to updates
  useEffect(() => {
    if (!jobId) return;

    const loadInitialJob = async () => {
      try {
        const initialJob = await ingestionService.getJob(jobId);
        if (initialJob) {
          setJob(initialJob);
        } else {
          setError('Ingestion job not found');
          return;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(`Failed to load job: ${errorMessage}`);
        console.error('Failed to load initial job:', error);
      }
    };

    loadInitialJob();

    const unsubscribe = ingestionService.addEventListener((event: IngestionEvent) => {
      if (event.jobId !== jobId) return;

      switch (event.type) {
        case 'job-updated':
          const handleJobUpdate = async () => {
            try {
              const updatedJob = await ingestionService.getJob(jobId);
              if (updatedJob) setJob(updatedJob);
            } catch (error) {
              console.error('Failed to update job:', error);
            }
          };
          handleJobUpdate();
          break;

        case 'job-completed':
          toast({
            title: 'Ingestion Complete!',
            description: event.message || 'Repository analysis completed successfully',
            status: 'success',
            duration: 5000,
            isClosable: true
          });
          onJobComplete?.(jobId);
          break;

        case 'job-failed':
          toast({
            title: 'Ingestion Failed',
            description: event.error || 'Repository analysis failed',
            status: 'error',
            duration: 8000,
            isClosable: true
          });
          onJobFailed?.(jobId, event.error || 'Unknown error');
          break;
      }
    });

    return unsubscribe;
  }, [jobId, onJobComplete, onJobFailed, toast]);

  // Load collection statistics
  useEffect(() => {
    const loadCollectionStats = async () => {
      try {
        const stats = await arangoDBService.getCollectionPopulationStatus();
        setCollectionStats(stats.collections);
      } catch (err) {
        console.error('Failed to load collection stats:', err);
      }
    };

    loadCollectionStats();
    const interval = setInterval(loadCollectionStats, 5000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Error Loading Ingestion</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (!job) {
    return (
      <Box textAlign="center" py={8}>
        <Spinner size="xl" />
        <Text mt={4} color="gray.500">Loading ingestion details...</Text>
      </Box>
    );
  }

  return (
    <Box>
      <VStack spacing={6} align="stretch">
        <Card>
          <CardHeader>
            <HStack justify="space-between" align="start">
              <VStack align="start" spacing={1}>
                <Heading size="md">{job.repositoryName}</Heading>
                <HStack spacing={2}>
                  <Badge colorScheme={getStatusColor(job.status)} size="lg">
                    {job.status.toUpperCase()}
                  </Badge>
                  {job.status === 'running' && (
                    <Text fontSize="sm" color="gray.600">
                      Phase {job.currentPhase}/{job.totalPhases}
                    </Text>
                  )}
                </HStack>
              </VStack>

              <Button
                leftIcon={<Eye size={16} />}
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(true)}
              >
                View Details
              </Button>
            </HStack>
          </CardHeader>

          <CardBody pt={0}>
            <VStack spacing={4} align="stretch">
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="medium">Overall Progress</Text>
                  <Text fontSize="sm" color="gray.600">
                    {Math.round(job.overallProgress ?? 0)}%
                  </Text>
                </HStack>
                <Progress 
                  value={job.overallProgress ?? 0} 
                  colorScheme={getStatusColor(job.status)}
                  hasStripe={job.status === 'running'}
                  isAnimated={job.status === 'running'}
                  size="lg"
                />
              </Box>

              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                <Stat size="sm">
                  <StatLabel>Elapsed</StatLabel>
                  <StatNumber fontSize="md">
                    {formatDuration(Date.now() - new Date(job.startTime).getTime())}
                  </StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Current Phase</StatLabel>
                  <StatNumber fontSize="md">
                    {job.phases && job.currentPhase && job.phases[job.currentPhase - 1] 
                      ? job.phases[job.currentPhase - 1].name?.split(' ')[0] 
                      : 'Starting'}
                  </StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Collections</StatLabel>
                  <StatNumber fontSize="md">
                    {collectionStats.filter(c => c.currentCount > 0).length}/{collectionStats.length}
                  </StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Status</StatLabel>
                  <StatNumber fontSize="md">
                    {job.status === 'running' ? 'Processing' : job.status}
                  </StatNumber>
                </Stat>
              </SimpleGrid>
            </VStack>
          </CardBody>
        </Card>

        {/* Collection Population Status */}
        <Card>
          <CardHeader>
            <Heading size="sm">Database Collections</Heading>
          </CardHeader>
          <CardBody>
            <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={4}>
              {collectionStats.map((collection) => (
                <Card key={collection.name} size="sm" variant="outline">
                  <CardBody p={3}>
                    <VStack spacing={2}>
                      <HStack justify="space-between" w="full">
                        <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
                          {collection.name}
                        </Text>
                        <Badge 
                          colorScheme={
                            collection.status === 'complete' ? 'green' :
                            collection.status === 'populating' ? 'blue' : 'gray'
                          }
                          size="sm"
                        >
                          {collection.currentCount}
                        </Badge>
                      </HStack>
                      <Progress 
                        value={(collection.currentCount / Math.max(collection.expectedCount, 1)) * 100} 
                        size="sm" 
                        w="full"
                        colorScheme={
                          collection.status === 'complete' ? 'green' :
                          collection.status === 'populating' ? 'blue' : 'gray'
                        }
                        hasStripe={collection.status === 'populating'}
                        isAnimated={collection.status === 'populating'}
                      />
                    </VStack>
                  </CardBody>
                </Card>
              ))}
            </SimpleGrid>
          </CardBody>
        </Card>
      </VStack>

      {/* Details Modal */}
      <Modal isOpen={showDetails} onClose={() => setShowDetails(false)} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack justify="space-between">
              <Text>Ingestion Details - {job.repositoryName}</Text>
              <Badge colorScheme={getStatusColor(job.status)}>
                {job.status.toUpperCase()}
              </Badge>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={6} align="stretch">
              <Box>
                <Heading size="sm" mb={3}>Job Information</Heading>
                <SimpleGrid columns={2} spacing={4}>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Job ID</Text>
                    <Text fontFamily="mono" fontSize="sm">{job.id}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Repository URL</Text>
                    <Text fontSize="sm" noOfLines={1}>{job.repositoryUrl}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Started</Text>
                    <Text fontSize="sm">{new Date(job.startTime).toLocaleString()}</Text>
                  </Box>
                  {job.endTime && (
                    <Box>
                      <Text fontSize="sm" color="gray.500">Completed</Text>
                      <Text fontSize="sm">{new Date(job.endTime).toLocaleString()}</Text>
                    </Box>
                  )}
                </SimpleGrid>
              </Box>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default LiveIngestionDashboard;

