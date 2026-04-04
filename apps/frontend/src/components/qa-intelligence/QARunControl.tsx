/**
 * QARunControl - Top control bar for starting and monitoring QA runs
 */

import React, { useState } from 'react';
import {
  Box,
  HStack,
  VStack,
  Input,
  Button,
  Badge,
  Text,
  Checkbox,
  CheckboxGroup,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  FormControl,
  FormLabel,
  Tooltip,
  useColorModeValue,
  Wrap,
  WrapItem,
  IconButton,
  Collapse,
  useDisclosure,
  Progress,
} from '@chakra-ui/react';
import {
  Play,
  Square,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  GitBranch,
  Link,
} from 'lucide-react';
import type { QARunStatus, QARunConfig } from '../../services/qaService';

interface QARunControlProps {
  status: QARunStatus;
  isRunning: boolean;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  onStartRun: (config: QARunConfig) => Promise<void>;
  onCancelRun: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

const STATUS_CONFIG: Record<QARunStatus, { color: string; label: string }> = {
  idle: { color: 'gray', label: 'Idle' },
  queued: { color: 'yellow', label: 'Queued' },
  running: { color: 'blue', label: 'Running' },
  completed: { color: 'green', label: 'Completed' },
  failed: { color: 'red', label: 'Failed' },
};

const QARunControl: React.FC<QARunControlProps> = ({
  status,
  isRunning,
  startedAt,
  completedAt,
  error,
  onStartRun,
  onCancelRun,
  onRefresh,
}) => {
  const [repoUrl, setRepoUrl] = useState('https://github.com/AlpheCIT/MES');
  const [branch, setBranch] = useState('dev');
  const [testTypes, setTestTypes] = useState<string[]>(['unit']);
  const [maxTests, setMaxTests] = useState(20);
  const { isOpen: showAdvanced, onToggle: toggleAdvanced } = useDisclosure();

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');

  const statusConfig = STATUS_CONFIG[status];

  const [isStarting, setIsStarting] = useState(false);

  const handleStartRun = async () => {
    setIsStarting(true);
    try {
      await onStartRun({
        repoUrl,
        branch,
        testTypes: testTypes as QARunConfig['testTypes'],
        maxTests,
      });
    } finally {
      setIsStarting(false);
    }
  };

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return '--';
    return new Date(ts).toLocaleString();
  };

  const getElapsedTime = () => {
    if (!startedAt) return '';
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const seconds = Math.floor((end - start) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
  };

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      p={4}
    >
      {/* Main control row */}
      <HStack spacing={3} flexWrap="wrap">
        {/* Repo URL */}
        <FormControl flex="1" minW="250px" maxW="400px">
          <HStack spacing={1}>
            <Link size={14} />
            <FormLabel fontSize="xs" mb={0} fontWeight="medium">
              Repository
            </FormLabel>
          </HStack>
          <Input
            size="sm"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/org/repo"
            isDisabled={isRunning}
            fontFamily="mono"
            fontSize="xs"
          />
        </FormControl>

        {/* Branch */}
        <FormControl w="120px" flexShrink={0}>
          <HStack spacing={1}>
            <GitBranch size={14} />
            <FormLabel fontSize="xs" mb={0} fontWeight="medium">
              Branch
            </FormLabel>
          </HStack>
          <Input
            size="sm"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            isDisabled={isRunning}
            fontSize="xs"
          />
        </FormControl>

        {/* Max Tests */}
        <FormControl w="100px" flexShrink={0}>
          <FormLabel fontSize="xs" mb={0} fontWeight="medium">
            Max Tests
          </FormLabel>
          <NumberInput
            size="sm"
            min={1}
            max={100}
            value={maxTests}
            onChange={(_, val) => setMaxTests(val)}
            isDisabled={isRunning}
          >
            <NumberInputField fontSize="xs" />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </FormControl>

        {/* Start / Cancel */}
        <VStack spacing={1} pt={4}>
          {isRunning ? (
            <Button
              colorScheme="red"
              size="sm"
              leftIcon={<Square size={14} />}
              onClick={onCancelRun}
              variant="solid"
            >
              Cancel
            </Button>
          ) : (
            <Button
              colorScheme="green"
              size="md"
              leftIcon={<Play size={16} />}
              onClick={handleStartRun}
              isDisabled={!repoUrl}
              isLoading={isStarting}
              loadingText="Starting..."
              fontWeight="bold"
              px={6}
              _hover={{ transform: 'translateY(-1px)', shadow: 'lg' }}
              transition="all 0.2s"
            >
              Start QA Run
            </Button>
          )}
        </VStack>

        {/* Status + Info */}
        <VStack spacing={1} align="flex-end" pt={2} ml="auto">
          <HStack spacing={2}>
            <Badge
              colorScheme={statusConfig.color}
              variant={status === 'running' ? 'solid' : 'subtle'}
              fontSize="xs"
              px={2}
              py={1}
              borderRadius="full"
            >
              {statusConfig.label}
            </Badge>
            <Tooltip label="Refresh status">
              <IconButton
                aria-label="Refresh"
                icon={<RefreshCw size={14} />}
                size="xs"
                variant="ghost"
                onClick={onRefresh}
                isLoading={isRunning}
              />
            </Tooltip>
          </HStack>
          {startedAt && (
            <Text fontSize="xs" color={subtextColor}>
              {isRunning ? `Elapsed: ${getElapsedTime()}` : `Last run: ${formatTimestamp(completedAt || startedAt)}`}
            </Text>
          )}
        </VStack>
      </HStack>

      {/* Progress bar during run */}
      {isRunning && <Progress size="xs" isIndeterminate colorScheme="blue" mt={2} borderRadius="full" />}

      {/* Advanced options toggle */}
      <Button
        variant="ghost"
        size="xs"
        mt={2}
        onClick={toggleAdvanced}
        rightIcon={showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        color={subtextColor}
      >
        Advanced Options
      </Button>

      <Collapse in={showAdvanced}>
        <Box mt={2} pt={2} borderTop="1px solid" borderColor={borderColor}>
          <HStack spacing={6}>
            <FormControl>
              <FormLabel fontSize="xs" fontWeight="medium">
                <HStack spacing={1}>
                  <FlaskConical size={12} />
                  <Text>Test Types</Text>
                </HStack>
              </FormLabel>
              <CheckboxGroup
                value={testTypes}
                onChange={(vals) => setTestTypes(vals as string[])}
              >
                <Wrap spacing={4}>
                  <WrapItem>
                    <Checkbox value="unit" size="sm" isDisabled={isRunning}>
                      Unit Tests
                    </Checkbox>
                  </WrapItem>
                  <WrapItem>
                    <Checkbox value="e2e" size="sm" isDisabled={isRunning}>
                      E2E Tests
                    </Checkbox>
                  </WrapItem>
                  <WrapItem>
                    <Checkbox value="api" size="sm" isDisabled={isRunning}>
                      API Tests
                    </Checkbox>
                  </WrapItem>
                </Wrap>
              </CheckboxGroup>
            </FormControl>
          </HStack>
        </Box>
      </Collapse>

      {/* Error display */}
      {error && (
        <Box mt={2} p={2} bg="red.50" borderRadius="md" border="1px solid" borderColor="red.200">
          <Text fontSize="xs" color="red.600">
            {error}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default QARunControl;
