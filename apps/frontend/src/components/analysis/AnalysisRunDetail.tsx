/**
 * AnalysisRunDetail - Shows detailed view of a single analysis run
 *
 * Fetches run detail from GET /api/v1/ai-orchestration/runs/:runId
 * and displays findings, debate metrics, and LLM usage.
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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Divider,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Tag,
  useColorModeValue
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api/client';

interface AnalysisRunDetailProps {
  runId: string;
}

interface Finding {
  id?: string;
  type?: string;
  title?: string;
  description?: string;
  severity: string;
  file?: string;
  line?: number;
  confidence?: number;
  verified?: boolean;
  falsePositive?: boolean;
  domain?: string;
  recommendation?: string;
}

const severityColorMap: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'blue',
  info: 'gray',
};

function formatDuration(ms?: number): string {
  if (!ms) return '--';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export default function AnalysisRunDetail({ runId }: AnalysisRunDetailProps) {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const {
    data,
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ['analysis-run', runId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/ai-orchestration/runs/${runId}`);
      return response.data;
    },
    retry: 2,
  });

  const {
    data: findingsData
  } = useQuery({
    queryKey: ['analysis-run-findings', runId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/ai-orchestration/runs/${runId}/findings`);
      return response.data;
    },
    retry: 1,
    enabled: !!data?.run,
  });

  if (isLoading) {
    return (
      <HStack spacing={3} justify="center" py={12}>
        <Spinner size="lg" color="blue.500" />
        <Text>Loading run details...</Text>
      </HStack>
    );
  }

  if (isError) {
    return (
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold">Could not load run details</Text>
          <Text fontSize="sm">
            {error instanceof Error ? error.message : 'Failed to fetch run data.'}
          </Text>
        </Box>
      </Alert>
    );
  }

  const run = data?.run;
  if (!run) {
    return (
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <Text>Run not found.</Text>
      </Alert>
    );
  }

  const findings: Finding[] = findingsData?.findings || run.findings?.items || [];
  const debate = run.debateMetrics || {};
  const llmUsage = run.llmUsage || {};

  return (
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <Box>
        <HStack spacing={3} mb={2}>
          <Heading size="lg">Run Detail</Heading>
          <Badge
            colorScheme={
              run.status === 'completed' ? 'green' :
              run.status === 'running' ? 'blue' :
              run.status === 'failed' ? 'red' : 'gray'
            }
            fontSize="sm"
          >
            {run.status}
          </Badge>
        </HStack>
        <Text fontFamily="mono" fontSize="sm" color="gray.500">
          {run.runId || run.id}
        </Text>
      </Box>

      {/* Run Metadata */}
      <Box bg={cardBg} p={5} borderRadius="lg" border="1px solid" borderColor={borderColor}>
        <Text fontWeight="bold" mb={3}>Run Information</Text>
        <VStack align="stretch" spacing={2}>
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.500">Repository:</Text>
            <Text fontSize="sm">
              {run.repositoryUrl
                ? run.repositoryUrl.split('/').pop()?.replace('.git', '')
                : run.repositoryId || '--'}
            </Text>
          </HStack>
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.500">Branch:</Text>
            <Text fontSize="sm">{run.branch || 'main'}</Text>
          </HStack>
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.500">Started:</Text>
            <Text fontSize="sm">
              {run.startedAt ? new Date(run.startedAt).toLocaleString() : '--'}
            </Text>
          </HStack>
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.500">Duration:</Text>
            <Text fontSize="sm">{formatDuration(run.duration)}</Text>
          </HStack>
        </VStack>
      </Box>

      {/* Debate Metrics */}
      {(debate.rounds || debate.convergenceScore !== undefined) && (
        <Box bg={cardBg} p={5} borderRadius="lg" border="1px solid" borderColor={borderColor}>
          <Text fontWeight="bold" mb={3}>Debate Metrics</Text>
          <StatGroup>
            {debate.rounds !== undefined && (
              <Stat>
                <StatLabel>Rounds</StatLabel>
                <StatNumber>{debate.rounds}</StatNumber>
              </Stat>
            )}
            {debate.convergenceScore !== undefined && (
              <Stat>
                <StatLabel>Convergence</StatLabel>
                <StatNumber>{Math.round(debate.convergenceScore * 100)}%</StatNumber>
              </Stat>
            )}
            {debate.falsePositivesEliminated !== undefined && (
              <Stat>
                <StatLabel>False Positives Eliminated</StatLabel>
                <StatNumber>{debate.falsePositivesEliminated}</StatNumber>
              </Stat>
            )}
          </StatGroup>
        </Box>
      )}

      {/* LLM Usage */}
      {(llmUsage.totalCalls || llmUsage.totalTokens) && (
        <Box bg={cardBg} p={5} borderRadius="lg" border="1px solid" borderColor={borderColor}>
          <Text fontWeight="bold" mb={3}>LLM Usage</Text>
          <StatGroup>
            {llmUsage.totalCalls !== undefined && (
              <Stat>
                <StatLabel>API Calls</StatLabel>
                <StatNumber>{llmUsage.totalCalls}</StatNumber>
              </Stat>
            )}
            {llmUsage.totalTokens !== undefined && (
              <Stat>
                <StatLabel>Total Tokens</StatLabel>
                <StatNumber>{llmUsage.totalTokens.toLocaleString()}</StatNumber>
              </Stat>
            )}
            {llmUsage.estimatedCost !== undefined && (
              <Stat>
                <StatLabel>Est. Cost</StatLabel>
                <StatNumber>${llmUsage.estimatedCost.toFixed(4)}</StatNumber>
              </Stat>
            )}
          </StatGroup>
        </Box>
      )}

      {/* Findings Table */}
      <Box bg={cardBg} p={5} borderRadius="lg" border="1px solid" borderColor={borderColor}>
        <Text fontWeight="bold" mb={3}>
          Findings ({findings.length})
        </Text>

        {findings.length === 0 ? (
          <Text fontSize="sm" color="gray.500">No findings for this run.</Text>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Severity</Th>
                  <Th>Title</Th>
                  <Th>File</Th>
                  <Th>Confidence</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {findings.map((finding, index) => (
                  <Tr
                    key={finding.id || index}
                    opacity={finding.falsePositive ? 0.5 : 1}
                    textDecoration={finding.falsePositive ? 'line-through' : 'none'}
                  >
                    <Td>
                      <Badge
                        colorScheme={severityColorMap[finding.severity?.toLowerCase()] || 'gray'}
                        variant="solid"
                        fontSize="xs"
                      >
                        {finding.severity}
                      </Badge>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" fontWeight="medium">
                          {finding.title || finding.type || 'Finding'}
                        </Text>
                        {finding.description && (
                          <Text fontSize="xs" color="gray.500" noOfLines={2}>
                            {finding.description}
                          </Text>
                        )}
                      </VStack>
                    </Td>
                    <Td>
                      <Text fontSize="xs" fontFamily="mono">
                        {finding.file
                          ? `${finding.file}${finding.line ? `:${finding.line}` : ''}`
                          : '--'}
                      </Text>
                    </Td>
                    <Td>
                      {finding.confidence !== undefined ? (
                        <Text fontSize="sm">
                          {Math.round(finding.confidence * 100)}%
                        </Text>
                      ) : (
                        <Text fontSize="sm" color="gray.400">--</Text>
                      )}
                    </Td>
                    <Td>
                      {finding.falsePositive ? (
                        <Tag size="sm" colorScheme="red" variant="subtle">
                          false positive
                        </Tag>
                      ) : finding.verified ? (
                        <Tag size="sm" colorScheme="green" variant="subtle">
                          verified
                        </Tag>
                      ) : (
                        <Tag size="sm" variant="subtle">
                          unverified
                        </Tag>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>
    </VStack>
  );
}
