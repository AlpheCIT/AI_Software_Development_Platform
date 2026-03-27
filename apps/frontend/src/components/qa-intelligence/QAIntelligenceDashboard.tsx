/**
 * QAIntelligenceDashboard - Main dashboard container for AI-powered QA Intelligence
 * Layout:
 *   Top:    QARunControl (repo input, start button, status)
 *   Left:   AgentPipeline (live agent activity) + AgentLogStream
 *   Right:  TestResultsPanel (results + mutation gauge)
 *   Bottom: Intelligence tabs (Risk Heatmap, Mutation Trends placeholders)
 */

import React from 'react';
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
  useColorModeValue,
  Flex,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
} from '@chakra-ui/react';
import {
  Shield,
  FlaskConical,
  Activity,
  TrendingUp,
  BarChart3,
  Target,
  Briefcase,
} from 'lucide-react';

import QARunControl from './QARunControl';
import AgentPipeline from './AgentPipeline';
import AgentLogStream from './AgentLogStream';
import TestResultsPanel from './TestResultsPanel';
import ActionCenter from './ActionCenter';
import ActionableSummary from './ActionableSummary';
import RiskHeatmap from './RiskHeatmap';
import MutationTrends from './MutationTrends';
import { useQARun } from '../../hooks/useQARun';
import { useAgentStream } from '../../hooks/useAgentStream';

// ── Placeholder Components for Bottom Tabs ─────────────────────────────────

const RiskHeatmapPlaceholder: React.FC = () => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

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

        {/* Placeholder grid */}
        <SimpleGrid columns={8} spacing={1} w="100%" maxW="600px" py={4}>
          {Array.from({ length: 64 }, (_, i) => {
            const heat = Math.random();
            const color = heat > 0.8 ? 'red' : heat > 0.5 ? 'orange' : heat > 0.3 ? 'yellow' : 'green';
            return (
              <Box
                key={i}
                h="24px"
                borderRadius="sm"
                bg={`${color}.${Math.floor(heat * 4 + 1) * 100}`}
                opacity={0.3 + heat * 0.7}
              />
            );
          })}
        </SimpleGrid>

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
  mutationScore: number;
}> = ({ totalTests, passedTests, failedTests, mutationScore }) => {
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
          <StatLabel fontSize="xs">Pass Rate</StatLabel>
          <StatNumber fontSize="2xl" color="green.500">
            {totalTests > 0 ? `${Math.round((passedTests / totalTests) * 100)}%` : '--'}
          </StatNumber>
          <StatHelpText fontSize="xs">{passedTests} of {totalTests} passed</StatHelpText>
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
            {mutationScore > 0 ? `${Math.round(mutationScore)}%` : '--'}
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

  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const headerColor = useColorModeValue('gray.800', 'gray.100');

  return (
    <Box bg={bgColor} minH="100%" p={4}>
      <VStack spacing={4} align="stretch">
        {/* Page Header */}
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

        {/* Run Summary Stats */}
        <RunSummaryStats
          totalTests={qaRun.totalTests}
          passedTests={qaRun.passedTests}
          failedTests={qaRun.failedTests}
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

        {/* Main Content: Pipeline (left) + Results (right) */}
        <Grid
          templateColumns={{ base: '1fr', lg: '3fr 2fr' }}
          gap={4}
          minH="500px"
        >
          {/* Left Panel: Agent Pipeline + Log Stream */}
          <GridItem>
            <VStack spacing={4} align="stretch" height="100%">
              <AgentPipeline agents={qaRun.agents} />
              <AgentLogStream
                logs={agentStream.logs}
                onClear={agentStream.clearLogs}
                maxHeight="250px"
              />
            </VStack>
          </GridItem>

          {/* Right Panel: Test Results */}
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

        {/* Bottom Intelligence Tabs */}
        <Tabs variant="enclosed" colorScheme="blue" size="sm">
          <TabList>
            <Tab>
              <HStack spacing={1}>
                <Briefcase size={14} />
                <Text>Action Center</Text>
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
          </TabList>

          <TabPanels>
            <TabPanel px={0}>
              <ActionCenter runId={qaRun.runId} />
            </TabPanel>
            <TabPanel px={0}>
              <RiskHeatmap runId={qaRun.runId} />
            </TabPanel>
            <TabPanel px={0}>
              <MutationTrends />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Box>
  );
};

export default QAIntelligenceDashboard;
