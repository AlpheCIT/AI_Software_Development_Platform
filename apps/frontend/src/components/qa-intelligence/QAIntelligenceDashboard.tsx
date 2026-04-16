/**
 * QAIntelligenceDashboard - Main dashboard container for AI-powered QA Intelligence
 * Layout:
 *   Top:    QARunControl (repo input, start button, status)
 *   Left:   AgentPipeline (live agent activity) + AgentLogStream
 *   Right:  TestResultsPanel (results + mutation gauge)
 *   Bottom: Intelligence tabs (Risk Heatmap, Mutation Trends placeholders)
 */

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import {
  Box,
  Grid,
  GridItem,
  VStack,
  HStack,
  Text,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Button,
  IconButton,
  Select,
  useColorModeValue,
  Flex,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Spinner,
  Skeleton,
  SkeletonText,
  Center,
} from '@chakra-ui/react';
import {
  Shield,
  FlaskConical,
  Activity,
  TrendingUp,
  BarChart3,
  Target,
  Briefcase,
  FileText,
  Terminal,
  Bell,
  Heart,
  Play,
  Brain,
  History,
  BookOpen,
  GitCompare,
  GitBranch,
} from 'lucide-react';

import QARunControl from './QARunControl';
import AgentLogStream from './AgentLogStream';
import TestResultsPanel from './TestResultsPanel';
import ActionableSummary from './ActionableSummary';
import AgentControlRoom from './AgentControlRoom';

// Lazy-load heavy below-fold components to prevent scroll freeze
const AgentPipeline = React.lazy(() => import('./AgentPipeline'));
const ActionCenter = React.lazy(() => import('./ActionCenter'));
const RiskHeatmap = React.lazy(() => import('./RiskHeatmap'));
const MutationTrends = React.lazy(() => import('./MutationTrends'));
const CumulativeReport = React.lazy(() => import('./CumulativeReport'));
import OperatorTerminal from './OperatorTerminal';
import RunReplayPlayer from './RunReplayPlayer';
import NotificationBell from './NotificationBell';
import BehaviorExportButton from './BehaviorExportButton';
import AgentSpawningTree from './AgentSpawningTree';
import AgentReasoningTimeline from './AgentReasoningTimeline';

// Lazy-load tab content components (only rendered when tab is clicked)
const HealthScoreDashboard = React.lazy(() => import('./HealthScoreDashboard'));
const AgentReportsTab = React.lazy(() => import('./AgentReportsTab'));
const AgentDebateView = React.lazy(() => import('./AgentDebateView'));
const LearningsPanel = React.lazy(() => import('./LearningsPanel'));
const BehaviorSpecsTab = React.lazy(() => import('./BehaviorSpecsTab'));
const BehaviorChangesTab = React.lazy(() => import('./BehaviorChangesTab'));
import { useQARun } from '../../hooks/useQARun';
import { useAgentStream } from '../../hooks/useAgentStream';
import { useNotifications } from '../../hooks/useNotifications';
import { useQARunStore } from '../../stores/qa-run-store';

// ── Placeholder Components for Bottom Tabs ─────────────────────────────────

const RiskHeatmapPlaceholder: React.FC = () => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const emptyStateBg = useColorModeValue('gray.50', 'gray.700');

  return (
    <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6}>
      <VStack spacing={4}>
        <HStack spacing={2}>
          <Target size={20} />
          <Text fontSize="lg" fontWeight="bold">Risk Heatmap</Text>
          <Badge colorScheme="purple" variant="subtle" fontSize="xs">Coming Soon</Badge>
        </HStack>
        <Text fontSize="sm" color={subtextColor} textAlign="center" maxW="500px">
          Visualize risk concentration across your codebase. Files with low test coverage,
          high complexity, and frequent changes will glow red. Powered by the Strategist agent analysis.
        </Text>

        {/* Empty state — no fake data */}
        <Box py={4} px={6} bg={emptyStateBg} borderRadius="md" maxW="500px">
          <Text fontSize="sm" color={subtextColor} textAlign="center">
            Run a QA analysis to generate real risk data from your codebase.
            The heatmap will show actual complexity, test coverage, and failure patterns.
          </Text>
        </Box>

        <Text fontSize="xs" color={subtextColor}>
          Available after first QA run completes
        </Text>
      </VStack>
    </Box>
  );
};

const MutationTrendsPlaceholder: React.FC = () => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  return (
    <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6}>
      <VStack spacing={4}>
        <HStack spacing={2}>
          <TrendingUp size={20} />
          <Text fontSize="lg" fontWeight="bold">Mutation Score Trends</Text>
          <Badge colorScheme="teal" variant="subtle" fontSize="xs">Coming Soon</Badge>
        </HStack>
        <Text fontSize="sm" color={subtextColor} textAlign="center" maxW="500px">
          Track mutation score improvements over time. See how your test suite strength
          evolves across runs with detailed breakdowns by module, file, and test type.
        </Text>

        {/* Placeholder chart */}
        <Flex align="flex-end" spacing={1} h="120px" w="100%" maxW="600px" justify="center" gap={1} py={4}>
          {[45, 52, 58, 55, 62, 68, 72, 75, 71, 78, 82, 85].map((val, i) => (
            <Box
              key={i}
              w="40px"
              h={`${val}%`}
              bg={val >= 80 ? 'green.400' : val >= 60 ? 'yellow.400' : 'red.400'}
              borderRadius="sm"
              opacity={0.3 + (i / 12) * 0.7}
            />
          ))}
        </Flex>

        <Text fontSize="xs" color={subtextColor}>
          Requires multiple completed QA runs for trend data
        </Text>
      </VStack>
    </Box>
  );
};

const RunSummaryStats: React.FC<{
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests?: number;
  mutationScore: number;
}> = ({ totalTests, passedTests, failedTests, skippedTests = 0, mutationScore }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
        <Stat>
          <StatLabel fontSize="xs">Total Tests</StatLabel>
          <StatNumber fontSize="2xl" color="blue.500">{totalTests}</StatNumber>
          <StatHelpText fontSize="xs">Generated by AI agents</StatHelpText>
        </Stat>
      </Box>
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
        <Stat>
          <StatLabel fontSize="xs">Syntax Valid</StatLabel>
          <StatNumber fontSize="2xl" color={passedTests > 0 ? 'green.500' : 'yellow.500'}>
            {totalTests > 0 ? `${Math.round((passedTests / totalTests) * 100)}%` : '--'}
          </StatNumber>
          <StatHelpText fontSize="xs">{passedTests} of {totalTests} compiled{skippedTests > 0 ? ` (${skippedTests} need project context)` : ''}</StatHelpText>
        </Stat>
      </Box>
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
        <Stat>
          <StatLabel fontSize="xs">Failed</StatLabel>
          <StatNumber fontSize="2xl" color="red.500">{failedTests}</StatNumber>
          <StatHelpText fontSize="xs">Tests need attention</StatHelpText>
        </Stat>
      </Box>
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
        <Stat>
          <StatLabel fontSize="xs">Mutation Score</StatLabel>
          <StatNumber fontSize="2xl" color={mutationScore >= 80 ? 'green.500' : mutationScore >= 60 ? 'yellow.500' : 'red.500'}>
            {totalTests > 0 || mutationScore > 0 ? `${Math.round(mutationScore || 0)}%` : '--'}
          </StatNumber>
          <StatHelpText fontSize="xs">Test suite strength</StatHelpText>
        </Stat>
      </Box>
    </SimpleGrid>
  );
};

// ── Main Dashboard Component ───────────────────────────────────────────────

const QAIntelligenceDashboard: React.FC = () => {
  const qaRun = useQARun();
  const agentStream = useAgentStream(qaRun.runId);
  const notifications = useNotifications(agentStream.agentTimeline);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showReplay, setShowReplay] = useState(false);

  // Auto-show terminal when a run starts (most impressive feature should be visible)
  useEffect(() => {
    if (qaRun.status === 'running' && !showTerminal) setShowTerminal(true);
  }, [qaRun.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showDebate, setShowDebate] = useState(false);
  const [reasoningAgent, setReasoningAgent] = useState<{ id: string; name: string } | null>(null);

  // Check if any loops occurred (for debate view button)
  const hasLoops = agentStream.agentTimeline.some(e => e.event === 'agent.loop');

  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const headerColor = useColorModeValue('gray.800', 'gray.100');
  const emptyStateBg = useColorModeValue('purple.50', 'gray.700');
  const emptyStateBorder = useColorModeValue('purple.200', 'purple.600');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Listen for qa-view-run events dispatched by RunManager
  useEffect(() => {
    const handleViewRun = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.runId) {
        qaRun.loadRun(detail.runId);
      }
    };
    window.addEventListener('qa-view-run', handleViewRun);
    return () => window.removeEventListener('qa-view-run', handleViewRun);
  }, [qaRun.loadRun]);

  // Escape key closes terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showTerminal) setShowTerminal(false);
      if (e.key === '`' && !showTerminal) setShowTerminal(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTerminal]);

  // Merge real-time agent status from Socket.IO stream + persistent store into agent tiles
  const storeAgentStatuses = useQARunStore(s => s.agentStatuses);
  const liveAgents = useMemo(() => qaRun.agents.map(a => {
    const backendName = a.name === 'mutation' ? 'mutation-verifier' : a.name;
    // Live stream takes priority
    if (agentStream.activeAgent === a.name || agentStream.activeAgent === backendName) {
      return { ...a, status: 'active' as const, message: a.message || `${a.name} is working...` };
    }
    if (agentStream.handoffData[a.name] || agentStream.handoffData[backendName]) {
      return { ...a, status: a.status === 'idle' ? 'completed' as const : a.status, progress: 100 };
    }
    // Fall back to store for persisted statuses (survives navigation)
    const storeStatus = storeAgentStatuses[a.name];
    if (storeStatus && a.status === 'idle') {
      if (storeStatus.status === 'completed') return { ...a, status: 'completed' as const, progress: 100 };
      if (storeStatus.status === 'running') return { ...a, status: 'active' as const };
    }
    return a;
  }), [qaRun.agents, agentStream.activeAgent, agentStream.handoffData, storeAgentStatuses]);

  // Operator Terminal (full-screen overlay)
  if (showTerminal) {
    return (
      <OperatorTerminal
        timeline={agentStream.agentTimeline}
        isRunning={qaRun.isRunning}
        onClose={() => setShowTerminal(false)}
      />
    );
  }

  return (
    <Box bg={bgColor} minH="100%" p={4}>
      <VStack spacing={4} align="stretch">
        {/* ═══ ZONE 1: Command Bar ═══ */}
        <HStack spacing={3} justify="space-between">
          <HStack spacing={3}>
            <Shield size={24} />
            <Text fontSize="xl" fontWeight="bold" color={headerColor}>
              QA Intelligence Dashboard
            </Text>
            <Badge colorScheme="green" variant="subtle" fontSize="xs" px={2} py={0.5} borderRadius="full">
              AI-Powered
            </Badge>
            {agentStream.isConnected && (
              <Badge colorScheme="blue" variant="solid" fontSize="2xs" borderRadius="full">
                Stream Connected
              </Badge>
            )}
          </HStack>

          {/* Past runs selector */}
          {qaRun.recentRuns.length > 0 && (
            <HStack spacing={2}>
              <History size={14} />
              <Select
                placeholder="Load past run..."
                size="sm"
                maxW="400px"
                bg={cardBg}
                borderColor={borderColor}
                value={qaRun.runId || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    qaRun.loadRun(e.target.value);
                  }
                }}
                sx={{ '& option': { bg: cardBg, color: 'inherit' } }}
              >
                {qaRun.recentRuns.map((run) => {
                  const runKey = run.id || (run as any)._key || (run as any).runId;
                  const date = run.startedAt ? new Date(run.startedAt).toLocaleString() : 'Unknown date';
                  const tests = run.totalTests || 0;
                  const mutScore = (run as any).mutationScore ?? run.mutation?.score ?? 0;
                  const health = (run as any).unifiedHealthScore;
                  const grade = health ? ` · ${health.grade} (${health.score}/100)` : '';
                  const statusLabel = run.status === 'completed' ? '' : ` [${run.status}]`;
                  return (
                    <option key={runKey} value={runKey}>
                      {date} — {tests} tests, {Math.round(mutScore)}% mutation{grade}{statusLabel}
                    </option>
                  );
                })}
              </Select>
            </HStack>
          )}

          {/* Right side: Terminal toggle + Notification bell */}
          <HStack spacing={2}>
            {/* Replay button (after run completes) */}
            {qaRun.status === 'completed' && agentStream.agentTimeline.length > 0 && (
              <Button
                size="xs"
                variant="outline"
                colorScheme="blue"
                leftIcon={<Play size={12} />}
                onClick={() => setShowReplay(!showReplay)}
              >
                {showReplay ? 'Hide Replay' : 'Replay'}
              </Button>
            )}

            {/* Debate view (when loops occurred) */}
            {hasLoops && qaRun.runId && (
              <Button
                size="xs"
                variant={showDebate ? 'solid' : 'outline'}
                colorScheme="orange"
                onClick={() => setShowDebate(!showDebate)}
              >
                {showDebate ? 'Hide Debate' : 'Agent Debate'}
              </Button>
            )}

            {/* Export behavioral specs */}
            <BehaviorExportButton runId={qaRun.runId || undefined} />

            {/* Terminal mode */}
            <Button
              size="xs"
              variant={showTerminal ? 'solid' : 'outline'}
              colorScheme="gray"
              leftIcon={<Terminal size={12} />}
              onClick={() => setShowTerminal(true)}
            >
              Terminal
            </Button>

            {/* Notification bell */}
            <NotificationBell
              notifications={notifications.notifications}
              unreadCount={notifications.unreadCount}
              onMarkAllRead={notifications.markAllRead}
              onMarkRead={notifications.markRead}
            />
          </HStack>
        </HStack>

        {/* Run Summary Stats */}
        <RunSummaryStats
          totalTests={qaRun.totalTests}
          passedTests={qaRun.passedTests}
          failedTests={qaRun.failedTests}
          skippedTests={qaRun.skippedTests}
          mutationScore={qaRun.mutation.score}
        />

        {/* QA Run Control */}
        <QARunControl
          status={qaRun.status}
          isRunning={qaRun.isRunning}
          startedAt={qaRun.startedAt}
          completedAt={qaRun.completedAt}
          error={qaRun.error}
          onStartRun={qaRun.startRun}
          onCancelRun={qaRun.cancelRun}
          onRefresh={qaRun.refreshStatus}
        />

        {/* Replay Player (when active) */}
        {showReplay && (
          <RunReplayPlayer
            timeline={agentStream.agentTimeline}
            onReplayEvent={() => {}}
            onClose={() => setShowReplay(false)}
          />
        )}

        {/* Empty state guide for first-time users */}
        {qaRun.recentRuns.length === 0 && qaRun.status === 'idle' && (
          <Box
            bg={emptyStateBg}
            border="2px dashed"
            borderColor={emptyStateBorder}
            borderRadius="xl"
            p={8}
            textAlign="center"
            mb={4}
          >
            <VStack spacing={3}>
              <Text fontSize="xl" fontWeight="bold">
                QA Intelligence
              </Text>
              <Text color="gray.500" maxW="500px">
                Enter your GitHub repository URL above and click "Start QA Run".
                22 AI agents will analyze your code for quality, security, API integrity,
                test coverage, and more. All findings are from real analysis.
              </Text>
              <Text fontSize="sm" color="gray.400">
                Results are stored per-repository. Select a previous run from the
                dropdown to review historical analysis.
              </Text>
            </VStack>
          </Box>
        )}

        {/* ═══ ZONE 2: Agent Control Room ═══ */}
        <AgentControlRoom
          agents={liveAgents}
          runId={qaRun.runId || undefined}
          activeAgent={agentStream.activeAgent}
          streamingState={agentStream.streamingState}
          streamingBuffer={agentStream.streamingBuffer}
          handoffData={agentStream.handoffData}
        />

        {/* Agent Spawning Tree (execution tree with sub-agent spawning) */}
        <AgentSpawningTree
          runId={qaRun.runId || undefined}
          liveEvents={qaRun.isRunning}
        />

        {/* Agent Reasoning Timeline (when an agent is selected) */}
        {reasoningAgent && qaRun.runId && (
          <AgentReasoningTimeline
            agentId={reasoningAgent.id}
            agentName={reasoningAgent.name}
            runId={qaRun.runId}
          />
        )}

        {/* Agent Pipeline (compact fallback — shows all 13 tiles) */}
        <Suspense fallback={<VStack spacing={3} p={4}><Skeleton height="40px" /><Skeleton height="200px" /><HStack><Skeleton height="30px" width="80px" /><Skeleton height="30px" width="80px" /></HStack></VStack>}>
          <AgentPipeline
            agents={liveAgents}
            runId={qaRun.runId}
            streamingState={agentStream.streamingState}
          />
        </Suspense>

        {/* Agent Debate View (when loops occurred and user clicked button) */}
        {showDebate && qaRun.runId && (
          <Suspense fallback={<Skeleton height="120px" borderRadius="lg" />}>
            <AgentDebateView runId={qaRun.runId} onClose={() => setShowDebate(false)} />
          </Suspense>
        )}

        {/* Show test results + log stream when running */}
        {qaRun.isRunning && (
          <Grid templateColumns={{ base: '1fr', lg: '3fr 2fr' }} gap={4}>
            <GridItem>
              <AgentLogStream
                logs={agentStream.logs}
                onClear={agentStream.clearLogs}
                maxHeight="200px"
              />
            </GridItem>
            <GridItem>
              <TestResultsPanel
                testResults={qaRun.testResults}
                mutation={qaRun.mutation}
                totalTests={qaRun.totalTests}
                passedTests={qaRun.passedTests}
                failedTests={qaRun.failedTests}
                skippedTests={qaRun.skippedTests}
                isRunning={qaRun.isRunning}
              />
            </GridItem>
          </Grid>
        )}
        {!qaRun.isRunning && agentStream.logs.length > 0 && (
          <AgentLogStream
            logs={agentStream.logs}
            onClear={agentStream.clearLogs}
            maxHeight="120px"
          />
        )}

        {/* ═══ ZONE 3: Intelligence Panels ═══ */}
        <Suspense fallback={<VStack spacing={3} p={4}><Skeleton height="40px" /><Skeleton height="200px" /><HStack><Skeleton height="30px" width="80px" /><Skeleton height="30px" width="80px" /></HStack></VStack>}>
        <Tabs variant="enclosed" colorScheme="blue" size="sm" isLazy>
          <TabList>
            <Tab>
              <HStack spacing={1}>
                <Briefcase size={14} />
                <Text>Action Center</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack spacing={1}>
                <Heart size={14} />
                <Text>Health Scores</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack spacing={1}>
                <BarChart3 size={14} />
                <Text>Risk Heatmap</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack spacing={1}>
                <Activity size={14} />
                <Text>Mutation Trends</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack spacing={1}>
                <FileText size={14} />
                <Text>Full Report</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack spacing={1}>
                <Shield size={14} />
                <Text>Agent Reports</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack spacing={1}>
                <GitBranch size={14} />
                <Text>Agent Reasoning</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack spacing={1}>
                <Brain size={14} />
                <Text>AI Learnings</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack spacing={1}>
                <BookOpen size={14} />
                <Text>Behavior Specs</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack spacing={1}>
                <GitCompare size={14} />
                <Text>Changes</Text>
              </HStack>
            </Tab>
          </TabList>

          <TabPanels>
            <TabPanel px={0}>
              <ActionCenter runId={qaRun.runId} />
            </TabPanel>
            <TabPanel px={0}>
              <HealthScoreDashboard runId={qaRun.runId || undefined} />
            </TabPanel>
            <TabPanel px={0}>
              <RiskHeatmap runId={qaRun.runId} />
            </TabPanel>
            <TabPanel px={0}>
              <MutationTrends />
            </TabPanel>
            <TabPanel px={0}>
              <CumulativeReport runId={qaRun.runId} />
            </TabPanel>
            <TabPanel px={0}>
              <AgentReportsTab runId={qaRun.runId || undefined} />
            </TabPanel>
            <TabPanel px={0}>
              <VStack spacing={4} align="stretch">
                <HStack spacing={2} flexWrap="wrap">
                  {(qaRun.agents || []).map((agent) => (
                    <Button
                      key={agent.name}
                      size="xs"
                      variant={reasoningAgent?.id === agent.name ? 'solid' : 'outline'}
                      colorScheme={reasoningAgent?.id === agent.name ? 'blue' : 'gray'}
                      onClick={() =>
                        setReasoningAgent(
                          reasoningAgent?.id === agent.name
                            ? null
                            : { id: agent.name, name: agent.name }
                        )
                      }
                    >
                      {agent.name}
                    </Button>
                  ))}
                </HStack>
                {reasoningAgent && qaRun.runId ? (
                  <AgentReasoningTimeline
                    agentId={reasoningAgent.id}
                    agentName={reasoningAgent.name}
                    runId={qaRun.runId}
                  />
                ) : (
                  <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
                    Select an agent above to view its step-by-step reasoning timeline.
                  </Text>
                )}
              </VStack>
            </TabPanel>
            <TabPanel px={0}>
              <LearningsPanel repositoryId={qaRun.runId || undefined} />
            </TabPanel>
            <TabPanel px={0}>
              <BehaviorSpecsTab runId={qaRun.runId || undefined} />
            </TabPanel>
            <TabPanel px={0}>
              <BehaviorChangesTab runId={qaRun.runId || undefined} />
            </TabPanel>
          </TabPanels>
        </Tabs>
        </Suspense>
      </VStack>
    </Box>
  );
};

export default QAIntelligenceDashboard;
