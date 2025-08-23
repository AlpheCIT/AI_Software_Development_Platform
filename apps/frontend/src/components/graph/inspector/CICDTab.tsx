import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  Badge,
  Progress,
  Alert,
  AlertIcon,
  Box,
  SimpleGrid,
  List,
  ListItem,
  ListIcon
} from '@chakra-ui/react';
import { CheckCircle, XCircle, Clock, GitBranch, Play } from 'lucide-react';
import { fetchNodeDetails, createGraphQueryOptions } from '../../../lib/api/graph';
import { CICDPipeline } from '../../../types/common';

interface CICDTabProps {
  nodeId: string;
}

export default function CICDTab({ nodeId }: CICDTabProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['node', nodeId],
    queryFn: () => fetchNodeDetails(nodeId),
    enabled: !!nodeId,
    ...createGraphQueryOptions(),
  });

  if (isLoading) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Text>Loading CI/CD information...</Text>
      </VStack>
    );
  }

  if (error || !data) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="error">
          <AlertIcon />
          Unable to load CI/CD details. Please try again.
        </Alert>
      </VStack>
    );
  }

  // Mock CI/CD data - this would come from your CI/CD integration
  const pipeline: CICDPipeline = {
    id: 'pipeline-123',
    name: `${data.name || nodeId} Pipeline`,
    status: 'passed',
    lastRun: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 minutes ago
    duration: 420, // 7 minutes
    stages: [
      { name: 'Build', status: 'passed', duration: 120 },
      { name: 'Test', status: 'passed', duration: 180 },
      { name: 'Security Scan', status: 'passed', duration: 90 },
      { name: 'Deploy', status: 'passed', duration: 30 }
    ]
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return CheckCircle;
      case 'failed': return XCircle;
      case 'running': return Play;
      case 'pending': return Clock;
      default: return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'green.500';
      case 'failed': return 'red.500';
      case 'running': return 'blue.500';
      case 'pending': return 'yellow.500';
      default: return 'gray.500';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'passed': return 'green';
      case 'failed': return 'red';
      case 'running': return 'blue';
      case 'pending': return 'yellow';
      default: return 'gray';
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <VStack spacing={6} align="stretch" p={4}>
      {/* Pipeline Overview */}
      <Card>
        <CardBody>
          <HStack justify="space-between" mb={4}>
            <Text fontSize="lg" fontWeight="bold">Pipeline Status</Text>
            <Badge colorScheme={getStatusBadgeColor(pipeline.status)} size="lg">
              {pipeline.status.toUpperCase()}
            </Badge>
          </HStack>
          
          <SimpleGrid columns={3} spacing={4}>
            <Box>
              <Text fontSize="sm" color="gray.600">Last Run</Text>
              <Text fontWeight="medium">
                {new Date(pipeline.lastRun).toLocaleString()}
              </Text>
            </Box>
            
            <Box>
              <Text fontSize="sm" color="gray.600">Duration</Text>
              <Text fontWeight="medium">{formatDuration(pipeline.duration)}</Text>
            </Box>
            
            <Box>
              <Text fontSize="sm" color="gray.600">Stages</Text>
              <Text fontWeight="medium">{pipeline.stages.length} stages</Text>
            </Box>
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* Pipeline Stages */}
      <Card>
        <CardBody>
          <Text fontSize="lg" fontWeight="bold" mb={4}>Pipeline Stages</Text>
          
          <List spacing={3}>
            {pipeline.stages.map((stage, index) => {
              const StatusIcon = getStatusIcon(stage.status);
              
              return (
                <ListItem key={index}>
                  <Card size="sm" bg={stage.status === 'passed' ? 'green.50' : stage.status === 'failed' ? 'red.50' : 'gray.50'}>
                    <CardBody py={3}>
                      <HStack justify="space-between">
                        <HStack>
                          <ListIcon as={StatusIcon} color={getStatusColor(stage.status)} boxSize={5} />
                          <Text fontWeight="medium">{stage.name}</Text>
                          <Badge colorScheme={getStatusBadgeColor(stage.status)} size="sm">
                            {stage.status}
                          </Badge>
                        </HStack>
                        
                        <VStack spacing={0} align="end">
                          {stage.duration && (
                            <Text fontSize="sm" color="gray.600">
                              {formatDuration(stage.duration)}
                            </Text>
                          )}
                        </VStack>
                      </HStack>
                      
                      {/* Progress bar showing relative duration */}
                      <Progress
                        value={(stage.duration || 0) / Math.max(...pipeline.stages.map(s => s.duration || 0)) * 100}
                        size="sm"
                        colorScheme={getStatusBadgeColor(stage.status)}
                        mt={2}
                      />
                    </CardBody>
                  </Card>
                </ListItem>
              );
            })}
          </List>
        </CardBody>
      </Card>

      {/* Deployment Information */}
      <Card>
        <CardBody>
          <Text fontSize="lg" fontWeight="bold" mb={4}>Deployment Information</Text>
          
          <VStack spacing={3} align="stretch">
            <HStack justify="space-between">
              <Text fontSize="sm" color="gray.600">Current Version</Text>
              <Badge variant="outline">{data.metadata?.version || 'v1.0.0'}</Badge>
            </HStack>
            
            <HStack justify="space-between">
              <Text fontSize="sm" color="gray.600">Deployment Status</Text>
              <Badge colorScheme="green">
                {data.metadata?.deploymentStatus || 'deployed'}
              </Badge>
            </HStack>
            
            <HStack justify="space-between">
              <Text fontSize="sm" color="gray.600">Last Deployment</Text>
              <Text fontSize="sm">
                {data.metadata?.lastDeployment 
                  ? new Date(data.metadata.lastDeployment).toLocaleString()
                  : new Date().toLocaleString()
                }
              </Text>
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Build Metrics */}
      <Card>
        <CardBody>
          <Text fontSize="lg" fontWeight="bold" mb={4}>Build Metrics</Text>
          
          <SimpleGrid columns={2} spacing={4}>
            <Box>
              <Text fontSize="sm" color="gray.600">Success Rate (30 days)</Text>
              <HStack>
                <Text fontSize="2xl" fontWeight="bold" color="green.500">98%</Text>
                <Progress value={98} colorScheme="green" size="sm" flex="1" />
              </HStack>
            </Box>
            
            <Box>
              <Text fontSize="sm" color="gray.600">Average Duration</Text>
              <Text fontSize="2xl" fontWeight="bold" color="blue.500">
                {formatDuration(pipeline.duration)}
              </Text>
            </Box>
            
            <Box>
              <Text fontSize="sm" color="gray.600">Total Builds</Text>
              <Text fontSize="2xl" fontWeight="bold" color="purple.500">247</Text>
            </Box>
            
            <Box>
              <Text fontSize="sm" color="gray.600">Failed Builds</Text>
              <Text fontSize="2xl" fontWeight="bold" color="red.500">5</Text>
            </Box>
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* Recent Builds */}
      <Card>
        <CardBody>
          <Text fontSize="lg" fontWeight="bold" mb={4}>Recent Builds</Text>
          
          <VStack spacing={2} align="stretch">
            {[
              { id: '123', status: 'passed', duration: 420, timestamp: new Date(Date.now() - 1000 * 60 * 45) },
              { id: '122', status: 'passed', duration: 398, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3) },
              { id: '121', status: 'failed', duration: 245, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8) },
              { id: '120', status: 'passed', duration: 435, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12) }
            ].map((build) => {
              const StatusIcon = getStatusIcon(build.status);
              
              return (
                <HStack key={build.id} justify="space-between" p={2} borderRadius="md" bg="gray.50">
                  <HStack>
                    <StatusIcon size={16} color={getStatusColor(build.status)} />
                    <Text fontSize="sm" fontFamily="mono">#{build.id}</Text>
                    <Badge colorScheme={getStatusBadgeColor(build.status)} size="sm">
                      {build.status}
                    </Badge>
                  </HStack>
                  
                  <VStack spacing={0} align="end">
                    <Text fontSize="xs" color="gray.600">
                      {formatDuration(build.duration)}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {build.timestamp.toLocaleString()}
                    </Text>
                  </VStack>
                </HStack>
              );
            })}
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
}
