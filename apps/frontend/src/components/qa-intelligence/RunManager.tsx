/**
 * RunManager - Shows a matrix of which repos have been analyzed and which agents ran.
 * Provides a table of repos grouped from run history, with expandable per-run details
 * and an agent matrix showing which agents executed in each run.
 *
 * Fetches from: QA_ENGINE_URL/qa/runs
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Heading,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Spinner,
  Alert,
  AlertIcon,
  Icon,
  IconButton,
  Tooltip,
  Collapse,
  useColorModeValue,
  SimpleGrid,
  Divider,
  Tag,
  Flex,
} from '@chakra-ui/react';
import {
  RefreshCw,
  Play,
  Eye,
  ChevronDown,
  ChevronUp,
  Clock,
  GitBranch,
  Database,
  CheckCircle,
  XCircle,
  Loader,
  BarChart3,
  Shield,
  FlaskConical,
  Users,
  Search,
  Code,
  Briefcase,
  Zap,
  Target,
  Bug,
  FileText,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface RunData {
  id: string;
  runId?: string;
  _key?: string;
  repoUrl: string;
  branch: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  testsGenerated?: number;
  testsPassed?: number;
  testsFailed?: number;
  mutationScore?: number;
  mutation?: { score: number };
  agents?: any[];
  agentsRun?: string[];
  codeHealthGrade?: string;
  codeHealthScore?: number;
  duration?: number;
}

interface RepoGroup {
  repoUrl: string;
  branch: string;
  runs: RunData[];
  latestRun: RunData;
  totalRuns: number;
  avgMutationScore: number;
  totalTestsGenerated: number;
  bestGrade: string | null;
}



const AGENT_NAMES = [
  { key: 'ingester', label: 'Ingester', icon: Database },
  { key: 'strategist', label: 'Strategist', icon: Target },
  { key: 'generator', label: 'Generator', icon: Code },
  { key: 'critic', label: 'Critic', icon: Search },
  { key: 'executor', label: 'Executor', icon: Play },
  { key: 'mutation', label: 'Mutation', icon: Bug },
  { key: 'product-manager', label: 'PM', icon: Briefcase },
  { key: 'research-assistant', label: 'Research', icon: Search },
  { key: 'code-quality-architect', label: 'Code Quality', icon: Shield },
  { key: 'self-healer', label: 'Self-Heal', icon: Shield },
  { key: 'api-validator', label: 'API Valid', icon: Shield },
  { key: 'coverage-auditor', label: 'Coverage', icon: Search },
  { key: 'ui-ux-analyst', label: 'UI/UX', icon: Search },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRepoName(url: string): string {
  if (!url) return 'Unknown';
  const parts = url.replace(/\.git$/, '').split('/');
  return parts.slice(-2).join('/') || url;
}

function formatDuration(startedAt: string, completedAt?: string): string {
  if (!startedAt) return '--';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}m`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'completed': return 'green';
    case 'running': return 'blue';
    case 'queued': return 'yellow';
    case 'failed': return 'red';
    default: return 'gray';
  }
}

function getMutationColor(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

function getGradeColor(grade: string): string {
  if (grade === 'A' || grade === 'A+') return 'green';
  if (grade === 'B' || grade === 'B+') return 'blue';
  if (grade === 'C' || grade === 'C+') return 'yellow';
  if (grade === 'D') return 'orange';
  return 'red';
}

function groupRunsByRepo(runs: RunData[]): RepoGroup[] {
  const groups: Record<string, RunData[]> = {};

  for (const run of runs) {
    const key = `${run.repoUrl || 'unknown'}|${run.branch || 'main'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(run);
  }

  return Object.entries(groups).map(([key, groupRuns]) => {
    const [repoUrl, branch] = key.split('|');
    // Sort by startedAt descending
    groupRuns.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    const latestRun = groupRuns[0];
    const completedRuns = groupRuns.filter(r => r.status === 'completed');

    const mutationScores = completedRuns
      .map(r => r.mutationScore ?? r.mutation?.score ?? 0)
      .filter(s => s > 0);
    const avgMutationScore = mutationScores.length > 0
      ? mutationScores.reduce((a, b) => a + b, 0) / mutationScores.length
      : 0;

    const totalTestsGenerated = groupRuns.reduce(
      (sum, r) => sum + (r.testsGenerated || r.totalTests || 0), 0
    );

    const bestGrade = completedRuns
      .map(r => r.codeHealthGrade)
      .filter(Boolean)
      .sort()[0] || null;

    return {
      repoUrl,
      branch,
      runs: groupRuns,
      latestRun,
      totalRuns: groupRuns.length,
      avgMutationScore,
      totalTestsGenerated,
      bestGrade,
    };
  }).sort((a, b) => new Date(b.latestRun.startedAt).getTime() - new Date(a.latestRun.startedAt).getTime());
}

function getAgentsFromRun(run: RunData): Set<string> {
  const agents = new Set<string>();
  if (run.agentsRun) {
    run.agentsRun.forEach(a => agents.add(a.toLowerCase()));
  }
  if (run.agents) {
    run.agents.forEach((a: any) => {
      if (a.status && a.status !== 'idle') {
        agents.add((a.name || '').toLowerCase());
      }
    });
  }
  // If no agent info but run is completed, assume all pipeline agents ran
  if (agents.size === 0 && run.status === 'completed') {
    ['ingester', 'strategist', 'generator', 'critic', 'executor'].forEach(a => agents.add(a));
    if ((run.mutationScore ?? run.mutation?.score ?? 0) > 0) agents.add('mutation');
    // Product intelligence agents run after QA pipeline
    ['product-manager', 'research-assistant', 'code-quality-architect',
     'self-healer', 'api-validator', 'coverage-auditor', 'ui-ux-analyst'].forEach(a => agents.add(a));
  }
  return agents;
}

// ── Run History Row ──────────────────────────────────────────────────────────

const RunHistoryRow: React.FC<{
  run: RunData;
  onViewResults?: (runId: string) => void;
}> = ({ run, onViewResults }) => {
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const runId = run._key || run.runId || run.id;
  const mutScore = run.mutationScore ?? run.mutation?.score ?? 0;
  const tests = run.testsGenerated || run.totalTests || 0;
  const agentsRan = getAgentsFromRun(run);

  return (
    <Tr fontSize="xs">
      <Td fontFamily="mono" maxW="120px" isTruncated>
        <Tooltip label={runId}><Text>{runId}</Text></Tooltip>
      </Td>
      <Td>{formatDate(run.startedAt)}</Td>
      <Td>
        <Badge colorScheme={getStatusColor(run.status)} fontSize="2xs">
          {run.status}
        </Badge>
      </Td>
      <Td isNumeric>{tests}</Td>
      <Td isNumeric>
        {mutScore > 0 ? (
          <Badge colorScheme={getMutationColor(mutScore)} fontSize="2xs">
            {Math.round(mutScore)}%
          </Badge>
        ) : '--'}
      </Td>
      <Td>{formatDuration(run.startedAt, run.completedAt)}</Td>
      <Td>
        {/* Mini agent badges */}
        <HStack spacing={0.5} flexWrap="wrap">
          {AGENT_NAMES.map(({ key, label }) => (
            <Tooltip key={key} label={label}>
              <Badge
                fontSize="3xs"
                colorScheme={agentsRan.has(key) ? 'green' : 'gray'}
                variant={agentsRan.has(key) ? 'solid' : 'outline'}
                px={1}
              >
                {agentsRan.has(key) ? 'OK' : '--'}
              </Badge>
            </Tooltip>
          ))}
        </HStack>
      </Td>
      <Td>
        {onViewResults && (
          <IconButton
            aria-label="View results"
            icon={<Eye size={14} />}
            size="xs"
            variant="ghost"
            onClick={() => onViewResults(runId)}
          />
        )}
      </Td>
    </Tr>
  );
};

// ── Repo Row with Expandable History ─────────────────────────────────────────

const RepoRow: React.FC<{
  group: RepoGroup;
  onRerun?: (repoUrl: string, branch: string) => void;
  onViewResults?: (runId: string) => void;
}> = ({ group, onRerun, onViewResults }) => {
  const [expanded, setExpanded] = useState(false);
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const expandedBg = useColorModeValue('gray.50', 'gray.900');

  const { latestRun } = group;
  const mutScore = group.avgMutationScore;
  const latestRunId = latestRun._key || latestRun.runId || latestRun.id;

  return (
    <>
      <Tr
        bg={cardBg}
        _hover={{ bg: hoverBg }}
        cursor="pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <Td>
          <VStack align="start" spacing={0}>
            <HStack spacing={2}>
              <Icon as={Database} boxSize={4} color="blue.400" />
              <Text fontWeight="bold" fontSize="sm">{getRepoName(group.repoUrl)}</Text>
            </HStack>
            <HStack spacing={1} ml={6}>
              <Icon as={GitBranch} boxSize={3} color={subtextColor} />
              <Text fontSize="xs" color={subtextColor}>{group.branch}</Text>
            </HStack>
          </VStack>
        </Td>
        <Td>
          <VStack align="start" spacing={0}>
            <Text fontSize="xs">{formatDate(latestRun.startedAt)}</Text>
            <Text fontSize="2xs" color={subtextColor}>
              {formatDuration(latestRun.startedAt, latestRun.completedAt)}
            </Text>
          </VStack>
        </Td>
        <Td>
          <Badge colorScheme={getStatusColor(latestRun.status)} fontSize="xs">
            {latestRun.status}
          </Badge>
        </Td>
        <Td isNumeric>
          <Text fontWeight="bold">{group.totalTestsGenerated}</Text>
          <Text fontSize="2xs" color={subtextColor}>{group.totalRuns} runs</Text>
        </Td>
        <Td isNumeric>
          {mutScore > 0 ? (
            <Badge colorScheme={getMutationColor(mutScore)} fontSize="sm" px={2}>
              {Math.round(mutScore)}%
            </Badge>
          ) : (
            <Text fontSize="xs" color={subtextColor}>--</Text>
          )}
        </Td>
        <Td>
          {group.bestGrade ? (
            <Badge colorScheme={getGradeColor(group.bestGrade)} fontSize="sm" px={2}>
              {group.bestGrade}
            </Badge>
          ) : (
            <Text fontSize="xs" color={subtextColor}>--</Text>
          )}
        </Td>
        <Td>
          <HStack spacing={1}>
            {onRerun && (
              <Tooltip label="Re-run analysis">
                <IconButton
                  aria-label="Re-run"
                  icon={<Play size={14} />}
                  size="xs"
                  colorScheme="green"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRerun(group.repoUrl, group.branch);
                  }}
                />
              </Tooltip>
            )}
            {onViewResults && (
              <Tooltip label="View latest results">
                <IconButton
                  aria-label="View results"
                  icon={<Eye size={14} />}
                  size="xs"
                  colorScheme="blue"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewResults(latestRunId);
                  }}
                />
              </Tooltip>
            )}
            <Icon
              as={expanded ? ChevronUp : ChevronDown}
              boxSize={4}
              color={subtextColor}
            />
          </HStack>
        </Td>
      </Tr>

      {/* Expanded Run History */}
      {expanded && (
        <Tr>
          <Td colSpan={7} p={0}>
            <Box bg={expandedBg} px={4} py={3}>
              <Text fontSize="xs" fontWeight="bold" mb={2} color={subtextColor}>
                Run History ({group.runs.length} runs)
              </Text>
              <Box overflowX="auto">
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th fontSize="2xs">Run ID</Th>
                      <Th fontSize="2xs">Date</Th>
                      <Th fontSize="2xs">Status</Th>
                      <Th fontSize="2xs" isNumeric>Tests</Th>
                      <Th fontSize="2xs" isNumeric>Mutation</Th>
                      <Th fontSize="2xs">Duration</Th>
                      <Th fontSize="2xs">Agents</Th>
                      <Th fontSize="2xs"></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {group.runs.map((run) => (
                      <RunHistoryRow
                        key={run._key || run.runId || run.id}
                        run={run}
                        onViewResults={onViewResults}
                      />
                    ))}
                  </Tbody>
                </Table>
              </Box>

              {/* Agent Matrix */}
              <Box mt={4}>
                <Text fontSize="xs" fontWeight="bold" mb={2} color={subtextColor}>
                  Agent Matrix
                </Text>
                <Box overflowX="auto">
                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr>
                        <Th fontSize="2xs">Run</Th>
                        {AGENT_NAMES.map(({ key, label, icon: AgIcon }) => (
                          <Th key={key} fontSize="2xs" textAlign="center">
                            <Tooltip label={label}>
                              <VStack spacing={0}>
                                <Icon as={AgIcon} boxSize={3} />
                                <Text>{label.substring(0, 3)}</Text>
                              </VStack>
                            </Tooltip>
                          </Th>
                        ))}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {group.runs.slice(0, 5).map((run) => {
                        const ranAgents = getAgentsFromRun(run);
                        const rId = run._key || run.runId || run.id;
                        return (
                          <Tr key={rId}>
                            <Td fontSize="2xs" fontFamily="mono" maxW="80px" isTruncated>
                              {rId.substring(0, 8)}
                            </Td>
                            {AGENT_NAMES.map(({ key }) => (
                              <Td key={key} textAlign="center" px={1}>
                                {run.status === 'running' && !ranAgents.has(key) ? (
                                  <Text fontSize="xs" title="Pending">&#9203;</Text>
                                ) : ranAgents.has(key) ? (
                                  <Text fontSize="xs" color="green.500" title="Ran">&#9989;</Text>
                                ) : (
                                  <Text fontSize="xs" color="red.400" title="Did not run">&#10060;</Text>
                                )}
                              </Td>
                            ))}
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </Box>
              </Box>
            </Box>
          </Td>
        </Tr>
      )}
    </>
  );
};

// ── Main RunManager Component ────────────────────────────────────────────────

const RunManager: React.FC = () => {
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const theadBg = useColorModeValue('gray.50', 'gray.700');

  const fetchRuns = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setRefreshing(true);
    try {
      const response = await fetch(`/qa/runs?limit=50`);
      if (!response.ok) {
        throw new Error(`Failed to fetch runs: ${response.status}`);
      }
      const data = await response.json();
      const mappedRuns = (data.runs || []).map((r: any) => ({
        ...r,
        id: r._key || r.runId || r.id,
        totalTests: r.testsGenerated || r.totalTests || 0,
        passedTests: r.testsPassed || r.passedTests || 0,
        failedTests: r.testsFailed || r.failedTests || 0,
        mutationScore: r.mutationScore ?? r.mutation?.score,
      }));
      setRuns(mappedRuns);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load runs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(() => {
      // Only poll if there's an active run; otherwise single fetch on mount is enough
      const hasActiveRun = runs.some(r => r.status === 'running' || r.status === 'queued');
      if (hasActiveRun) fetchRuns();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchRuns]); // eslint-disable-line react-hooks/exhaustive-deps

  const repoGroups = groupRunsByRepo(runs);

  const handleRerun = (repoUrl: string, branch: string) => {
    // Dispatch a custom event that QARunControl can listen to, or navigate
    const event = new CustomEvent('qa-rerun', { detail: { repoUrl, branch } });
    window.dispatchEvent(event);
  };

  const handleViewResults = (runId: string) => {
    const event = new CustomEvent('qa-view-run', { detail: { runId } });
    window.dispatchEvent(event);
  };

  // Summary stats
  const totalRepos = repoGroups.length;
  const totalRuns = runs.length;
  const completedRuns = runs.filter(r => r.status === 'completed').length;
  const runningRuns = runs.filter(r => r.status === 'running').length;

  return (
    <Box bg={bgColor} minH="100%" p={4}>
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <HStack justify="space-between" flexWrap="wrap">
          <HStack spacing={3}>
            <Icon as={BarChart3} boxSize={6} color="blue.500" />
            <Heading size="md">Run Manager</Heading>
            <Badge colorScheme="blue" variant="subtle" fontSize="xs">
              {totalRepos} repos
            </Badge>
          </HStack>
          <HStack spacing={2}>
            <Tooltip label="Refresh">
              <IconButton
                aria-label="Refresh runs"
                icon={<RefreshCw size={16} />}
                size="sm"
                variant="outline"
                isLoading={refreshing}
                onClick={() => fetchRuns(true)}
              />
            </Tooltip>
          </HStack>
        </HStack>

        {/* Summary Stats */}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
          <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3} textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color="blue.500">{totalRepos}</Text>
            <Text fontSize="xs" color={subtextColor}>Repositories</Text>
          </Box>
          <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3} textAlign="center">
            <Text fontSize="2xl" fontWeight="bold">{totalRuns}</Text>
            <Text fontSize="xs" color={subtextColor}>Total Runs</Text>
          </Box>
          <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3} textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color="green.500">{completedRuns}</Text>
            <Text fontSize="xs" color={subtextColor}>Completed</Text>
          </Box>
          <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3} textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color={runningRuns > 0 ? 'blue.500' : 'gray.400'}>
              {runningRuns}
            </Text>
            <Text fontSize="xs" color={subtextColor}>Running</Text>
          </Box>
        </SimpleGrid>

        {/* Loading */}
        {loading && (
          <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6} textAlign="center">
            <Spinner size="lg" color="blue.500" />
            <Text mt={3} color={subtextColor}>Loading run history...</Text>
          </Box>
        )}

        {/* Error */}
        {error && !loading && (
          <Alert status="warning" borderRadius="lg">
            <AlertIcon />
            <Text>{error}</Text>
          </Alert>
        )}

        {/* No runs */}
        {!loading && !error && runs.length === 0 && (
          <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6} textAlign="center">
            <VStack spacing={3}>
              <Icon as={FlaskConical} boxSize={8} color={subtextColor} />
              <Text color={subtextColor}>No QA runs found. Start your first analysis from the QA Intelligence dashboard.</Text>
            </VStack>
          </Box>
        )}

        {/* Repo Table */}
        {!loading && repoGroups.length > 0 && (
          <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" overflow="hidden">
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead bg={theadBg}>
                  <Tr>
                    <Th>Repository</Th>
                    <Th>Last Run</Th>
                    <Th>Status</Th>
                    <Th isNumeric>Tests</Th>
                    <Th isNumeric>Mutation Score</Th>
                    <Th>Code Health</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {repoGroups.map((group) => (
                    <RepoRow
                      key={`${group.repoUrl}|${group.branch}`}
                      group={group}
                      onRerun={handleRerun}
                      onViewResults={handleViewResults}
                    />
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default RunManager;
