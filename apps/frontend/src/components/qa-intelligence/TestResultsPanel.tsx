/**
 * TestResultsPanel - Right panel showing test results, progress, and mutation score
 */

import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Progress,
  Badge,
  Flex,
  Collapse,
  IconButton,
  useColorModeValue,
  Divider,
  Tooltip,
  Code,
} from '@chakra-ui/react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Activity,
} from 'lucide-react';
import type { TestResult, MutationResult, TestStatus } from '../../services/qaService';
import MutationScoreGauge from './MutationScoreGauge';

// ── Status Config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TestStatus, { icon: React.ElementType; color: string; label: string }> = {
  passed: { icon: CheckCircle, color: 'green', label: 'Passed' },
  failed: { icon: XCircle, color: 'red', label: 'Failed' },
  skipped: { icon: AlertTriangle, color: 'yellow', label: 'Skipped' },
  pending: { icon: Clock, color: 'gray', label: 'Pending' },
  error: { icon: XCircle, color: 'red', label: 'Error' },
};

// ── Count Badge ────────────────────────────────────────────────────────────

const CountBadge: React.FC<{ count: number; label: string; color: string }> = ({ count, label, color }) => (
  <VStack spacing={0} align="center">
    <Text fontSize="xl" fontWeight="bold" color={`${color}.500`}>
      {count}
    </Text>
    <Text fontSize="2xs" color={useColorModeValue('gray.500', 'gray.400')} textTransform="uppercase" letterSpacing="wide">
      {label}
    </Text>
  </VStack>
);

// ── Individual Test Result Row ─────────────────────────────────────────────

interface TestResultRowProps {
  result: TestResult;
}

const TestResultRow: React.FC<TestResultRowProps> = ({ result }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = STATUS_CONFIG[result.status];
  const StatusIcon = config.icon;
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const errorBg = useColorModeValue('red.50', 'red.900');

  return (
    <Box>
      <HStack
        spacing={2}
        py={1.5}
        px={2}
        borderRadius="md"
        cursor={result.error ? 'pointer' : 'default'}
        onClick={() => result.error && setIsExpanded(!isExpanded)}
        _hover={{ bg: useColorModeValue('gray.50', 'gray.750') }}
        transition="background 0.15s"
      >
        <StatusIcon size={14} color={`var(--chakra-colors-${config.color}-500)`} />

        <Text fontSize="xs" color={textColor} flex={1} noOfLines={1} fontFamily="mono">
          {result.name}
        </Text>

        <Text fontSize="2xs" color={subtextColor}>
          {result.duration}ms
        </Text>

        {result.error && (
          <IconButton
            aria-label="Toggle error details"
            icon={isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            size="xs"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          />
        )}
      </HStack>

      {/* Error details */}
      <Collapse in={isExpanded}>
        <Box
          ml={6}
          mr={2}
          mb={2}
          p={2}
          bg={errorBg}
          borderRadius="md"
          fontSize="xs"
          fontFamily="mono"
        >
          <Text color="red.600" whiteSpace="pre-wrap" wordBreak="break-word">
            {result.error}
          </Text>
          {result.stackTrace && (
            <Code
              display="block"
              mt={1}
              p={2}
              fontSize="2xs"
              bg="transparent"
              color="red.400"
              whiteSpace="pre-wrap"
              maxH="150px"
              overflowY="auto"
            >
              {result.stackTrace}
            </Code>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

// ── Main Panel ─────────────────────────────────────────────────────────────

interface TestResultsPanelProps {
  testResults: TestResult[];
  mutation: MutationResult;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  isRunning: boolean;
}

const TestResultsPanel: React.FC<TestResultsPanelProps> = ({
  testResults,
  mutation,
  totalTests,
  passedTests,
  failedTests,
  skippedTests,
  isRunning,
}) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const headerColor = useColorModeValue('gray.700', 'gray.200');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  const pendingTests = totalTests - passedTests - failedTests - skippedTests;
  const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      p={4}
      height="100%"
      overflowY="auto"
      css={{
        '&::-webkit-scrollbar': { width: '6px' },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': {
          background: useColorModeValue('#CBD5E0', '#4A5568'),
          borderRadius: '3px',
        },
      }}
    >
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <HStack spacing={2}>
          <FlaskConical size={18} />
          <Text fontSize="md" fontWeight="bold" color={headerColor}>
            Test Results
          </Text>
          {isRunning && (
            <Badge colorScheme="blue" variant="solid" fontSize="2xs" borderRadius="full">
              Live
            </Badge>
          )}
        </HStack>

        {/* Overall Progress */}
        <Box>
          <HStack justify="space-between" mb={1}>
            <Text fontSize="xs" color={subtextColor}>
              Overall Progress
            </Text>
            <Text fontSize="xs" fontWeight="semibold" color={headerColor}>
              {totalTests > 0 ? `${passRate}% pass rate` : 'No tests yet'}
            </Text>
          </HStack>
          <Box position="relative">
            <Progress value={100} size="sm" colorScheme="gray" borderRadius="full" />
            {/* Stacked progress overlay */}
            <Box position="absolute" top={0} left={0} right={0} bottom={0}>
              <Flex height="100%" borderRadius="full" overflow="hidden">
                {passedTests > 0 && (
                  <Box
                    bg="green.400"
                    width={`${(passedTests / Math.max(totalTests, 1)) * 100}%`}
                    transition="width 0.5s ease"
                  />
                )}
                {failedTests > 0 && (
                  <Box
                    bg="red.400"
                    width={`${(failedTests / Math.max(totalTests, 1)) * 100}%`}
                    transition="width 0.5s ease"
                  />
                )}
                {skippedTests > 0 && (
                  <Box
                    bg="yellow.400"
                    width={`${(skippedTests / Math.max(totalTests, 1)) * 100}%`}
                    transition="width 0.5s ease"
                  />
                )}
              </Flex>
            </Box>
          </Box>
        </Box>

        {/* Count Badges */}
        <Flex justify="space-around" py={2}>
          <CountBadge count={passedTests} label="Passed" color="green" />
          <CountBadge count={failedTests} label="Failed" color="red" />
          <CountBadge count={skippedTests} label="Skipped" color="yellow" />
          <CountBadge count={pendingTests > 0 ? pendingTests : 0} label="Pending" color="gray" />
        </Flex>

        <Divider />

        {/* Mutation Score Gauge */}
        <VStack spacing={2}>
          <HStack spacing={2}>
            <Activity size={14} />
            <Text fontSize="sm" fontWeight="semibold" color={headerColor}>
              Mutation Testing
            </Text>
          </HStack>
          <MutationScoreGauge
            score={mutation.score}
            totalMutants={mutation.totalMutants}
            killed={mutation.killed}
            survived={mutation.survived}
          />
        </VStack>

        <Divider />

        {/* Individual Test Results */}
        <Box>
          <HStack spacing={2} mb={2}>
            <Text fontSize="sm" fontWeight="semibold" color={headerColor}>
              Test Details
            </Text>
            <Badge colorScheme="gray" variant="subtle" fontSize="2xs">
              {testResults.length}
            </Badge>
          </HStack>

          {testResults.length === 0 ? (
            <Flex justify="center" py={6}>
              <Text fontSize="xs" color={subtextColor}>
                {isRunning ? 'Tests are being generated...' : 'Run a QA analysis to see results'}
              </Text>
            </Flex>
          ) : (
            <VStack spacing={0} align="stretch">
              {testResults.map((result) => (
                <TestResultRow key={result.id} result={result} />
              ))}
            </VStack>
          )}
        </Box>
      </VStack>
    </Box>
  );
};

export default TestResultsPanel;
