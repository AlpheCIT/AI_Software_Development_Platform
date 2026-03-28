/**
 * RunComparisonView - Compare two analysis runs side by side
 *
 * Fetches comparison data from the AI orchestration service and displays
 * new, resolved, and changed findings between two runs.
 */

import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  Divider,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  useColorModeValue,
  Icon
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ArrowRight, Plus, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../lib/api/client';

interface Finding {
  id: string;
  title: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  file?: string;
  line?: number;
  description?: string;
}

interface ChangedFinding {
  id: string;
  title: string;
  type: string;
  file?: string;
  oldSeverity: string;
  newSeverity: string;
  oldConfidence: number;
  newConfidence: number;
}

interface ComparisonData {
  run1: { id: string; repositoryId?: string; startedAt?: string; status?: string };
  run2: { id: string; repositoryId?: string; startedAt?: string; status?: string };
  newFindings: Finding[];
  resolvedFindings: Finding[];
  changedFindings: ChangedFinding[];
  summary: {
    newCount: number;
    resolvedCount: number;
    changedCount: number;
  };
}

interface RunComparisonViewProps {
  runId1?: string;
  runId2?: string;
}

const severityColor: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'blue'
};

const RunComparisonView: React.FC<RunComparisonViewProps> = ({ runId1: propRunId1, runId2: propRunId2 }) => {
  const params = useParams<{ runId1: string; runId2: string }>();
  const run1 = propRunId1 || params.runId1;
  const run2 = propRunId2 || params.runId2;

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtleBg = useColorModeValue('gray.50', 'gray.900');

  const {
    data: comparison,
    isLoading,
    error
  } = useQuery<ComparisonData>({
    queryKey: ['run-comparison', run1, run2],
    queryFn: async () => {
      const res = await apiClient.get(
        `/api/v1/ai-orchestration/runs/compare?run1=${run1}&run2=${run2}`
      );
      return res.data;
    },
    enabled: !!run1 && !!run2,
    staleTime: 5 * 60 * 1000
  });

  // Empty state - no runs selected
  if (!run1 || !run2) {
    return (
      <Box p={8} textAlign="center">
        <VStack spacing={4}>
          <Icon as={AlertTriangle} boxSize={12} color="gray.300" />
          <Heading size="md" color="gray.500">
            Select two runs to compare
          </Heading>
          <Text color="gray.400" maxW="md">
            Choose two analysis runs from the Runs list to see what findings
            were added, resolved, or changed between them.
          </Text>
        </VStack>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box p={8} textAlign="center">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading comparison data...</Text>
        </VStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={6}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">Failed to load comparison</Text>
            <Text fontSize="sm">
              {error instanceof Error ? error.message : 'Could not fetch comparison data'}
            </Text>
          </Box>
        </Alert>
      </Box>
    );
  }

  if (!comparison) {
    return null;
  }

  const { newFindings, resolvedFindings, changedFindings, summary } = comparison;

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="lg" mb={2}>Run Comparison</Heading>
          <HStack spacing={3}>
            <Badge colorScheme="blue" px={2} py={1}>
              Run: {run1?.slice(0, 8)}...
            </Badge>
            <Icon as={ArrowRight} color="gray.400" />
            <Badge colorScheme="purple" px={2} py={1}>
              Run: {run2?.slice(0, 8)}...
            </Badge>
          </HStack>
        </Box>

        {/* Summary Stats */}
        <Box bg={cardBg} p={6} borderRadius="lg" border="1px solid" borderColor={borderColor}>
          <StatGroup>
            <Stat>
              <StatLabel>New Findings</StatLabel>
              <StatNumber color="red.500">{summary.newCount}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Resolved</StatLabel>
              <StatNumber color="green.500">{summary.resolvedCount}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Changed</StatLabel>
              <StatNumber color="yellow.600">{summary.changedCount}</StatNumber>
            </Stat>
          </StatGroup>
        </Box>

        <Divider />

        {/* New Findings Section */}
        <Box>
          <HStack mb={4}>
            <Icon as={Plus} color="red.500" />
            <Heading size="md">New Findings</Heading>
            <Badge colorScheme="red">{newFindings.length}</Badge>
          </HStack>

          {newFindings.length === 0 ? (
            <Box bg={subtleBg} p={4} borderRadius="md">
              <Text color="gray.500">No new findings in the later run.</Text>
            </Box>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Status</Th>
                    <Th>Finding</Th>
                    <Th>Type</Th>
                    <Th>Severity</Th>
                    <Th>Confidence</Th>
                    <Th>File</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {newFindings.map((finding) => (
                    <Tr key={finding.id}>
                      <Td>
                        <Badge colorScheme="red" variant="solid" fontSize="xs">NEW</Badge>
                      </Td>
                      <Td>
                        <Text fontWeight="medium" fontSize="sm">{finding.title}</Text>
                      </Td>
                      <Td>
                        <Badge variant="outline" fontSize="xs">{finding.type}</Badge>
                      </Td>
                      <Td>
                        <Badge colorScheme={severityColor[finding.severity]} fontSize="xs">
                          {finding.severity}
                        </Badge>
                      </Td>
                      <Td>
                        <Text fontSize="sm">{Math.round(finding.confidence * 100)}%</Text>
                      </Td>
                      <Td>
                        <Text fontSize="xs" color="gray.500" maxW="200px" isTruncated>
                          {finding.file || '-'}
                        </Text>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </Box>

        <Divider />

        {/* Resolved Findings Section */}
        <Box>
          <HStack mb={4}>
            <Icon as={CheckCircle} color="green.500" />
            <Heading size="md">Resolved Findings</Heading>
            <Badge colorScheme="green">{resolvedFindings.length}</Badge>
          </HStack>

          {resolvedFindings.length === 0 ? (
            <Box bg={subtleBg} p={4} borderRadius="md">
              <Text color="gray.500">No findings were resolved between these runs.</Text>
            </Box>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Status</Th>
                    <Th>Finding</Th>
                    <Th>Type</Th>
                    <Th>Severity</Th>
                    <Th>File</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {resolvedFindings.map((finding) => (
                    <Tr key={finding.id}>
                      <Td>
                        <Badge colorScheme="green" variant="solid" fontSize="xs">RESOLVED</Badge>
                      </Td>
                      <Td>
                        <Text fontWeight="medium" fontSize="sm" textDecoration="line-through" color="gray.500">
                          {finding.title}
                        </Text>
                      </Td>
                      <Td>
                        <Badge variant="outline" fontSize="xs">{finding.type}</Badge>
                      </Td>
                      <Td>
                        <Badge colorScheme={severityColor[finding.severity]} fontSize="xs">
                          {finding.severity}
                        </Badge>
                      </Td>
                      <Td>
                        <Text fontSize="xs" color="gray.500" maxW="200px" isTruncated>
                          {finding.file || '-'}
                        </Text>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </Box>

        <Divider />

        {/* Changed Findings Section */}
        <Box>
          <HStack mb={4}>
            <Icon as={AlertTriangle} color="yellow.500" />
            <Heading size="md">Changed Findings</Heading>
            <Badge colorScheme="yellow">{changedFindings.length}</Badge>
          </HStack>

          {changedFindings.length === 0 ? (
            <Box bg={subtleBg} p={4} borderRadius="md">
              <Text color="gray.500">No findings changed severity or confidence between these runs.</Text>
            </Box>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Status</Th>
                    <Th>Finding</Th>
                    <Th>Type</Th>
                    <Th>Severity Change</Th>
                    <Th>Confidence Change</Th>
                    <Th>File</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {changedFindings.map((finding) => (
                    <Tr key={finding.id}>
                      <Td>
                        <Badge colorScheme="yellow" variant="solid" fontSize="xs">CHANGED</Badge>
                      </Td>
                      <Td>
                        <Text fontWeight="medium" fontSize="sm">{finding.title}</Text>
                      </Td>
                      <Td>
                        <Badge variant="outline" fontSize="xs">{finding.type}</Badge>
                      </Td>
                      <Td>
                        <HStack spacing={1}>
                          <Badge colorScheme={severityColor[finding.oldSeverity] || 'gray'} fontSize="xs">
                            {finding.oldSeverity}
                          </Badge>
                          <Icon as={ArrowRight} boxSize={3} color="gray.400" />
                          <Badge colorScheme={severityColor[finding.newSeverity] || 'gray'} fontSize="xs">
                            {finding.newSeverity}
                          </Badge>
                        </HStack>
                      </Td>
                      <Td>
                        <HStack spacing={1}>
                          <Text fontSize="xs" color="gray.500">
                            {Math.round(finding.oldConfidence * 100)}%
                          </Text>
                          <Icon as={ArrowRight} boxSize={3} color="gray.400" />
                          <Text fontSize="xs" fontWeight="medium">
                            {Math.round(finding.newConfidence * 100)}%
                          </Text>
                        </HStack>
                      </Td>
                      <Td>
                        <Text fontSize="xs" color="gray.500" maxW="200px" isTruncated>
                          {finding.file || '-'}
                        </Text>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </Box>
      </VStack>
    </Box>
  );
};

export default RunComparisonView;
