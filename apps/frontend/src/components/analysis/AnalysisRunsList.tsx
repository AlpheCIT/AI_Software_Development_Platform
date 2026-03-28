/**
 * AnalysisRunsList - Displays analysis runs from the AI Orchestration service
 *
 * Fetches runs from GET /api/v1/ai-orchestration/runs and displays them
 * in a sortable table with status badges and finding counts.
 */

import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  Button,
  IconButton,
  Tooltip
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { apiClient } from '../../lib/api/client';
import AnalysisRunDetail from './AnalysisRunDetail';

interface AnalysisRun {
  id: string;
  runId?: string;
  repositoryId?: string;
  repositoryUrl?: string;
  branch?: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  findings?: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    total?: number;
  };
  debateMetrics?: {
    rounds?: number;
    convergenceScore?: number;
    falsePositivesEliminated?: number;
  };
}

const statusColorMap: Record<string, string> = {
  completed: 'green',
  running: 'blue',
  failed: 'red',
  pending: 'gray',
  queued: 'yellow',
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

function formatDate(dateStr?: string): string {
  if (!dateStr) return '--';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export default function AnalysisRunsList() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['analysis-runs'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/ai-orchestration/runs?limit=50');
      return response.data;
    },
    refetchInterval: 15000, // Poll every 15 seconds for updates
    retry: 2,
  });

  const runs: AnalysisRun[] = data?.runs || [];

  if (selectedRunId) {
    return (
      <Box>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSelectedRunId(null)}
          mb={4}
        >
          Back to Runs List
        </Button>
        <AnalysisRunDetail runId={selectedRunId} />
      </Box>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between" align="center">
        <Heading size="lg">Analysis Runs</Heading>
        <HStack spacing={2}>
          {isFetching && !isLoading && <Spinner size="sm" color="blue.500" />}
          <Tooltip label="Refresh">
            <IconButton
              aria-label="Refresh runs"
              icon={<RefreshCw size={16} />}
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              isLoading={isFetching}
            />
          </Tooltip>
        </HStack>
      </HStack>

      {isLoading ? (
        <HStack spacing={3} justify="center" py={12}>
          <Spinner size="lg" color="blue.500" />
          <Text>Loading analysis runs...</Text>
        </HStack>
      ) : isError ? (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">Could not load analysis runs</Text>
            <Text fontSize="sm">
              {error instanceof Error ? error.message : 'AI Orchestration service may be offline.'}
            </Text>
            <Text fontSize="sm" mt={1}>
              Ensure the AI Orchestration service is running on port 8003.
            </Text>
          </Box>
        </Alert>
      ) : runs.length === 0 ? (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Text>No analysis runs found. Trigger an analysis from the ingestion pipeline to see results here.</Text>
        </Alert>
      ) : (
        <Box overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Run ID</Th>
                <Th>Repository</Th>
                <Th>Branch</Th>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th>Findings</Th>
                <Th>Duration</Th>
              </Tr>
            </Thead>
            <Tbody>
              {runs.map((run) => {
                const runId = run.runId || run.id;
                const findings = run.findings || {};
                const totalFindings = findings.total ??
                  ((findings.critical || 0) + (findings.high || 0) + (findings.medium || 0) + (findings.low || 0));

                return (
                  <Tr
                    key={runId}
                    cursor="pointer"
                    _hover={{ bg: 'gray.50' }}
                    onClick={() => setSelectedRunId(runId)}
                  >
                    <Td>
                      <Text fontFamily="mono" fontSize="xs" isTruncated maxW="120px">
                        {runId}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontSize="sm" isTruncated maxW="200px">
                        {run.repositoryUrl
                          ? run.repositoryUrl.split('/').pop()?.replace('.git', '')
                          : run.repositoryId || '--'}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontSize="sm">{run.branch || 'main'}</Text>
                    </Td>
                    <Td>
                      <Text fontSize="sm">{formatDate(run.startedAt)}</Text>
                    </Td>
                    <Td>
                      <Badge colorScheme={statusColorMap[run.status] || 'gray'}>
                        {run.status}
                      </Badge>
                    </Td>
                    <Td>
                      <HStack spacing={1}>
                        {(findings.critical || 0) > 0 && (
                          <Badge colorScheme="red" variant="solid" fontSize="xs">
                            C:{findings.critical}
                          </Badge>
                        )}
                        {(findings.high || 0) > 0 && (
                          <Badge colorScheme="orange" fontSize="xs">
                            H:{findings.high}
                          </Badge>
                        )}
                        {(findings.medium || 0) > 0 && (
                          <Badge colorScheme="yellow" fontSize="xs">
                            M:{findings.medium}
                          </Badge>
                        )}
                        {(findings.low || 0) > 0 && (
                          <Badge colorScheme="blue" fontSize="xs">
                            L:{findings.low}
                          </Badge>
                        )}
                        {totalFindings === 0 && (
                          <Text fontSize="xs" color="gray.400">None</Text>
                        )}
                      </HStack>
                    </Td>
                    <Td>
                      <Text fontSize="sm">{formatDuration(run.duration)}</Text>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      )}
    </VStack>
  );
}
