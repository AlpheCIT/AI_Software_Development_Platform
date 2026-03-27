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
import { CheckCircle, XCircle, Clock, Play } from 'lucide-react';
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

  // CI/CD data would come from a real CI/CD integration (GitHub Actions, GitLab CI, Jenkins, etc.)
  const pipeline: CICDPipeline | null = data.metadata?.cicd || null;

  if (!pipeline) {
    return (
      <VStack spacing={6} align="stretch" p={4}>
        <Alert status="info">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">No CI/CD Data Available</Text>
            <Text fontSize="sm">
              Connect your CI/CD pipeline (GitHub Actions, GitLab CI, Jenkins, etc.)
              to see build and deployment history for this component.
            </Text>
          </Box>
        </Alert>

        {/* Show any metadata we do have from the graph node */}
        {data.metadata && (
          <Card>
            <CardBody>
              <Text fontSize="lg" fontWeight="bold" mb={4}>Available Metadata</Text>
              <VStack spacing={3} align="stretch">
                {data.metadata.version && (
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.600">Version</Text>
                    <Badge variant="outline">{data.metadata.version}</Badge>
                  </HStack>
                )}
                {data.metadata.deploymentStatus && (
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.600">Deployment Status</Text>
                    <Badge colorScheme="green">{data.metadata.deploymentStatus}</Badge>
                  </HStack>
                )}
                {data.metadata.lastDeployment && (
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.600">Last Deployment</Text>
                    <Text fontSize="sm">
                      {new Date(data.metadata.lastDeployment).toLocaleString()}
                    </Text>
                  </HStack>
                )}
              </VStack>
            </CardBody>
          </Card>
        )}
      </VStack>
    );
  }

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

                      {stage.duration && pipeline.stages.some(s => s.duration) && (
                        <Progress
                          value={(stage.duration) / Math.max(...pipeline.stages.map(s => s.duration || 1)) * 100}
                          size="sm"
                          colorScheme={getStatusBadgeColor(stage.status)}
                          mt={2}
                        />
                      )}
                    </CardBody>
                  </Card>
                </ListItem>
              );
            })}
          </List>
        </CardBody>
      </Card>
    </VStack>
  );
}
