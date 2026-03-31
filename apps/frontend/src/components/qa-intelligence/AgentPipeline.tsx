/**
 * AgentPipeline - Live agent pipeline visualization
 * The showstopper component: shows 5 agents working in sequence with animated transitions
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Progress,
  Badge,
  Icon,
  useColorModeValue,
  Flex,
  Collapse,
  Tooltip,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Code,
  MessageSquare,
  Play,
  Bug,
  CheckCircle,
  XCircle,
  Circle,
  RefreshCw,
  ArrowDown,
  RotateCcw,
  Briefcase,
  Search,
  Wrench,
  Shield,
  Layers,
} from 'lucide-react';
import type { AgentState, AgentName } from '../../services/qaService';
import type { AgentStreamingState } from '../../hooks/useAgentStream';
import { useQARunStore } from '../../stores/qa-run-store';
import AgentConversationPanel from './AgentConversationPanel';
import LiveReasoningStream from './LiveReasoningStream';

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

// ── Agent Config ───────────────────────────────────────────────────────────

interface AgentConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

const AGENT_CONFIG: Record<string, AgentConfig> = {
  'repo-ingester': {
    label: 'Repo Ingester',
    icon: Code,
    color: 'gray',
    description: 'Clones repository and extracts code files + entities',
  },
  strategist: {
    label: 'Strategist',
    icon: Brain,
    color: 'blue',
    description: 'Analyzes codebase and plans test strategy',
  },
  generator: {
    label: 'Generator',
    icon: Code,
    color: 'green',
    description: 'Generates test cases from strategy',
  },
  critic: {
    label: 'Critic',
    icon: MessageSquare,
    color: 'orange',
    description: 'Reviews and critiques test quality',
  },
  executor: {
    label: 'Executor',
    icon: Play,
    color: 'purple',
    description: 'Runs tests and collects results',
  },
  mutation: {
    label: 'Mutation Verifier',
    icon: Bug,
    color: 'red',
    description: 'Applies mutations to verify test strength',
  },
  'product-manager': {
    label: 'Product Manager',
    icon: Briefcase,
    color: 'teal',
    description: 'Analyzes features, gaps, and builds product roadmap',
  },
  'research-assistant': {
    label: 'Research Assistant',
    icon: Search,
    color: 'cyan',
    description: 'Researches trends and competitive landscape',
  },
  'code-quality-architect': {
    label: 'Code Quality Architect',
    icon: Code,
    color: 'yellow',
    description: 'Audits code quality, finds smells, duplication, and refactoring opportunities',
  },
  'self-healer': {
    label: 'Self-Healer',
    icon: Wrench,
    color: 'pink',
    description: 'Detects cross-file type mismatches, broken imports, and config issues',
  },
  'api-validator': {
    label: 'API Validator',
    icon: Shield,
    color: 'orange',
    description: 'Validates API endpoints for security, error handling, and completeness',
  },
  'coverage-auditor': {
    label: 'Coverage Auditor',
    icon: Layers,
    color: 'linkedin',
    description: 'Cross-references backend APIs with frontend consumers to find gaps',
  },
  'ui-ux-analyst': {
    label: 'UI/UX Analyst',
    icon: MessageSquare,
    color: 'purple',
    description: 'Audits accessibility, UX patterns, and user flow quality',
  },
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  idle: Circle,
  active: RefreshCw,
  completed: CheckCircle,
  failed: XCircle,
  looping: RotateCcw,
};

// ── Pulsing Dot Animation ──────────────────────────────────────────────────

const PulsingDot: React.FC<{ color: string }> = React.memo(({ color }) => (
  <MotionBox
    w="10px"
    h="10px"
    borderRadius="full"
    bg={`${color}.400`}
    animate={{
      scale: [1, 1.4, 1],
      opacity: [1, 0.6, 1],
    }}
    transition={{
      duration: 1.2,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  />
));

// ── Arrow Connector ────────────────────────────────────────────────────────

const PipelineConnector: React.FC<{ isActive: boolean }> = React.memo(({ isActive }) => {
  const arrowColor = useColorModeValue(
    isActive ? 'blue.400' : 'gray.300',
    isActive ? 'blue.300' : 'gray.600'
  );

  return (
    <Flex justify="center" py={1}>
      <MotionBox
        animate={isActive ? { opacity: [0.5, 1, 0.5] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <ArrowDown size={16} color="currentColor" style={{ color: arrowColor }} />
      </MotionBox>
    </Flex>
  );
});

// ── Loop Indicator ─────────────────────────────────────────────────────────

const LoopIndicator: React.FC<{ from: string; to: string; iteration?: number }> = React.memo(({
  from,
  to,
  iteration,
}) => {
  return (
    <MotionFlex
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      justify="flex-end"
      align="center"
      position="absolute"
      right="-8px"
      top="50%"
      transform="translateY(-50%)"
    >
      <HStack
        spacing={1}
        bg="orange.50"
        border="1px solid"
        borderColor="orange.200"
        borderRadius="full"
        px={2}
        py={0.5}
      >
        <MotionBox
          animate={{ rotate: [0, -360] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <RotateCcw size={10} />
        </MotionBox>
        <Text fontSize="2xs" color="orange.600" fontWeight="medium">
          Loop {iteration || ''}
        </Text>
      </HStack>
    </MotionFlex>
  );
});

// ── Single Agent Row ───────────────────────────────────────────────────────

interface AgentRowProps {
  agent: AgentState;
  config: AgentConfig;
  isActive: boolean;
}

const AgentRow: React.FC<AgentRowProps> = React.memo(({ agent, config, isActive }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const activeBg = useColorModeValue(`${config.color}.50`, `${config.color}.900`);
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const activeBorder = useColorModeValue(`${config.color}.300`, `${config.color}.500`);
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  const StatusIcon = STATUS_ICONS[agent.status] || Circle;
  const AgentIcon = config.icon;

  const statusColorMap: Record<string, string> = {
    idle: 'gray',
    active: config.color,
    completed: 'green',
    failed: 'red',
    looping: 'orange',
  };
  const statusColor = statusColorMap[agent.status] || 'gray';

  return (
    <MotionBox
      layout
      initial={false}
      animate={{
        borderColor: isActive ? activeBorder : borderColor,
        backgroundColor: isActive ? activeBg : cardBg,
      }}
      transition={{ duration: 0.3 }}
      position="relative"
      border="1px solid"
      borderRadius="lg"
      p={3}
      _hover={{ shadow: 'sm' }}
    >
      <HStack spacing={3} align="flex-start">
        {/* Status indicator */}
        <Flex
          w="36px"
          h="36px"
          borderRadius="lg"
          bg={`${config.color}.100`}
          align="center"
          justify="center"
          flexShrink={0}
        >
          {isActive ? (
            <PulsingDot color={config.color} />
          ) : (
            <AgentIcon size={18} color={`var(--chakra-colors-${config.color}-500)`} />
          )}
        </Flex>

        {/* Agent info */}
        <Box flex={1} minW={0}>
          <HStack spacing={2} mb={1}>
            <Text fontSize="sm" fontWeight="bold" color={textColor}>
              {config.label}
            </Text>
            <Badge
              colorScheme={statusColor}
              variant={isActive ? 'solid' : 'subtle'}
              fontSize="2xs"
              px={1.5}
              borderRadius="full"
            >
              <HStack spacing={1}>
                {isActive ? (
                  <MotionBox
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    display="inline-flex"
                  >
                    <StatusIcon size={10} />
                  </MotionBox>
                ) : (
                  <StatusIcon size={10} />
                )}
                <Text>{agent.status}</Text>
              </HStack>
            </Badge>
          </HStack>

          {/* Progress bar */}
          {(isActive || agent.status === 'completed') && (
            <Progress
              value={agent.progress}
              size="xs"
              colorScheme={config.color}
              borderRadius="full"
              mb={1}
              hasStripe={isActive}
              isAnimated={isActive}
            />
          )}

          {/* Message */}
          <Text fontSize="xs" color={subtextColor} noOfLines={2}>
            {agent.message}
          </Text>
        </Box>

        {/* Progress percentage */}
        {agent.progress > 0 && (
          <Text fontSize="xs" fontWeight="semibold" color={`${config.color}.500`} flexShrink={0}>
            {Math.round(agent.progress)}%
          </Text>
        )}
      </HStack>

      {/* Loop indicator */}
      <AnimatePresence>
        {agent.status === 'looping' && (
          <LoopIndicator
            from={agent.name}
            to="generator"
            iteration={agent.iterationCount}
          />
        )}
      </AnimatePresence>
    </MotionBox>
  );
});

// ── Main Pipeline Component ────────────────────────────────────────────────

// ── Typing Indicator ──────────────────────────────────────────────────────

const TypingIndicator: React.FC = React.memo(() => (
  <HStack spacing={1} px={1}>
    {[0, 1, 2].map(i => (
      <MotionBox
        key={i}
        w="4px"
        h="4px"
        borderRadius="full"
        bg="gray.400"
        animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
        transition={{
          duration: 0.6,
          repeat: Infinity,
          delay: i * 0.15,
          ease: 'easeInOut',
        }}
      />
    ))}
  </HStack>
));

interface AgentPipelineProps {
  agents: AgentState[];
  runId?: string;
  streamingState?: AgentStreamingState | null;
}

const AgentPipeline: React.FC<AgentPipelineProps> = ({ agents: propAgents, runId, streamingState }) => {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(!streamingState);
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const headerColor = useColorModeValue('gray.700', 'gray.200');
  const skippedBg = useColorModeValue('gray.50', 'gray.900');
  const idlePanelBg = useColorModeValue('gray.50', 'gray.700');

  // Merge store statuses with prop agents for persistence
  const storeAgentStatuses = useQARunStore(s => s.agentStatuses);
  const storeSelectedAgents = useQARunStore(s => s.selectedAgents);
  const storeSkippedAgents = useQARunStore(s => s.skippedAgents);
  const agents = useMemo(() => propAgents.map(a => {
    const storeStatus = storeAgentStatuses[a.name];
    if (storeStatus && a.status === 'idle' && storeStatus.status === 'completed') {
      return { ...a, status: 'completed' as const, progress: 100 };
    }
    if (storeStatus && a.status === 'idle' && storeStatus.status === 'running') {
      return { ...a, status: 'active' as const };
    }
    return a;
  }), [propAgents, storeAgentStatuses]);

  // Build skipped agent lookup
  const skippedAgentMap = new Map(
    storeSkippedAgents.map(a => [a.id, a.reason])
  );
  const hasDynamicSelection = storeSelectedAgents.length > 0;
  const isAgentSkipped = (name: string) => hasDynamicSelection && skippedAgentMap.has(name);
  const getSkipReason = (name: string) => skippedAgentMap.get(name) || 'requirements not met';

  // All 13 agents in pipeline order
  const allAgents: string[] = [
    'repo-ingester', 'strategist', 'generator', 'critic', 'executor', 'mutation',
    'product-manager', 'research-assistant', 'code-quality-architect',
    'self-healer', 'api-validator', 'coverage-auditor', 'ui-ux-analyst',
  ];

  const getAgent = (name: string): AgentState => {
    return (
      agents.find((a) => a.name === name) || {
        name,
        status: 'idle',
        progress: 0,
        message: AGENT_CONFIG[name]?.description || '',
      }
    );
  };

  const activeCount = allAgents.filter(n => getAgent(n).status === 'active').length;
  const completedCount = allAgents.filter(n => getAgent(n).status === 'completed').length;
  const anyRunning = activeCount > 0;
  const totalRegisteredAgents = hasDynamicSelection
    ? storeSelectedAgents.length + storeSkippedAgents.length
    : allAgents.length;

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      p={3}
    >
      <HStack mb={isCollapsed ? 0 : 3} spacing={2} cursor="pointer" onClick={() => setIsCollapsed(c => !c)}>
        <Brain size={16} />
        <Text fontSize="sm" fontWeight="bold" color={headerColor}>
          Agent Pipeline
        </Text>
        {hasDynamicSelection ? (
          <Badge colorScheme="purple" variant="subtle" fontSize="2xs">
            {storeSelectedAgents.length} of {totalRegisteredAgents} agents selected
          </Badge>
        ) : (
          <Badge colorScheme="purple" variant="subtle" fontSize="2xs">
            {allAgents.length} Agents
          </Badge>
        )}
        {completedCount > 0 && (
          <Badge colorScheme="green" variant="subtle" fontSize="2xs">
            {completedCount} done
          </Badge>
        )}
        {activeCount > 0 && (
          <Badge colorScheme="blue" variant="solid" fontSize="2xs">
            {activeCount} active
          </Badge>
        )}
        <Text fontSize="xs" color="gray.400" ml="auto">{isCollapsed ? '▶ Show' : '▼ Hide'}</Text>
      </HStack>

      {/* Compact grid — 3 columns on desktop, 2 on tablet, 1 on mobile */}
      {!isCollapsed && <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }}
        gap={2}
      >
        {allAgents.map((name) => {
          const agent = getAgent(name);
          const config = AGENT_CONFIG[name];
          if (!config) return null;
          const skipped = isAgentSkipped(name);
          const isActive = !skipped && agent.status === 'active';
          const StatusIcon = skipped ? Circle : (STATUS_ICONS[agent.status] || Circle);
          const statusColor = skipped ? 'gray' : agent.status === 'completed' ? 'green' : agent.status === 'active' ? config.color : agent.status === 'failed' ? 'red' : agent.status === 'looping' ? 'orange' : 'gray';
          const AgentIcon = config.icon;

          const isExpanded = expandedAgent === name;
          const isClickable = !skipped && agent.status !== 'idle';
          const isStreaming = streamingState?.agent === name || streamingState?.agent === (name === 'mutation' ? 'mutation-verifier' : name);

          const tooltipLabel = skipped
            ? `Skipped: ${getSkipReason(name)}`
            : isActive
            ? 'Click to watch live reasoning'
            : agent.status === 'completed'
            ? 'Click to view conversation & chat'
            : agent.status === 'idle'
            ? config.description
            : `Click to view ${config.label} details`;

          return (
            <Tooltip
              key={name}
              label={tooltipLabel}
              placement="top"
              fontSize="xs"
              hasArrow
            >
            <MotionBox
              border="1px solid"
              borderColor={skipped ? borderColor : isExpanded ? `${config.color}.500` : isActive ? `${config.color}.300` : borderColor}
              bg={skipped ? skippedBg : isExpanded ? `${config.color}.50` : isActive ? `${config.color}.50` : cardBg}
              borderRadius="md"
              p={2}
              cursor={isClickable ? 'pointer' : 'default'}
              opacity={skipped ? 0.45 : 1}
              onClick={() => {
                if (isClickable) {
                  setExpandedAgent(isExpanded ? null : name);
                }
              }}
              _hover={isClickable ? { shadow: 'md', borderColor: `${config.color}.400` } : { shadow: 'sm' }}
            >
              <HStack spacing={2}>
                <Flex
                  w="28px"
                  h="28px"
                  borderRadius="md"
                  bg={skipped ? 'gray.100' : `${config.color}.100`}
                  align="center"
                  justify="center"
                  flexShrink={0}
                >
                  {isActive ? (
                    <PulsingDot color={config.color} />
                  ) : (
                    <AgentIcon size={14} color={skipped ? 'var(--chakra-colors-gray-400)' : undefined} />
                  )}
                </Flex>
                <Box flex={1} minW={0}>
                  <HStack spacing={1}>
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      noOfLines={1}
                      textDecoration={skipped ? 'line-through' : undefined}
                      color={skipped ? 'gray.400' : undefined}
                    >
                      {config.label}
                    </Text>
                    <Badge
                      colorScheme={statusColor}
                      variant={isActive ? 'solid' : 'subtle'}
                      fontSize="2xs"
                      px={1}
                      borderRadius="full"
                    >
                      {skipped ? (
                        <StatusIcon size={8} />
                      ) : isActive ? (
                        <MotionBox
                          animate={{ rotate: [0, 360] }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          display="inline-flex"
                        >
                          <StatusIcon size={8} />
                        </MotionBox>
                      ) : (
                        <StatusIcon size={8} />
                      )}
                    </Badge>
                  </HStack>
                  {skipped && (
                    <Text fontSize="2xs" color="gray.400" noOfLines={1}>skipped</Text>
                  )}
                  {!skipped && isActive && agent.progress > 0 && (
                    <Progress
                      value={agent.progress}
                      size="xs"
                      colorScheme={config.color}
                      borderRadius="full"
                      mt={1}
                      hasStripe
                      isAnimated
                    />
                  )}
                  {/* Streaming preview */}
                  {!skipped && isActive && isStreaming && streamingState && (
                    <HStack spacing={1} mt={1}>
                      <TypingIndicator />
                      <Text fontSize="2xs" color="gray.500" noOfLines={1} flex={1}>
                        {streamingState.currentFile
                          ? `Analyzing ${streamingState.currentFile}${streamingState.fileTotal ? ` (${streamingState.fileIndex}/${streamingState.fileTotal})` : ''}`
                          : streamingState.text?.substring(0, 60)}
                      </Text>
                    </HStack>
                  )}
                  {!skipped && isActive && !isStreaming && (
                    <HStack spacing={1} mt={1}>
                      <TypingIndicator />
                      <Text fontSize="2xs" color="gray.500">Thinking...</Text>
                    </HStack>
                  )}
                </Box>
                {!skipped && agent.progress > 0 && isActive && (
                  <Text fontSize="2xs" fontWeight="bold" color={`${config.color}.500`}>
                    {Math.round(agent.progress)}%
                  </Text>
                )}
              </HStack>
            </MotionBox>
            </Tooltip>
          );
        })}
      </Box>}

      {/* Expanded panel — shows live reasoning OR conversation based on agent status */}
      {expandedAgent && AGENT_CONFIG[expandedAgent] && (() => {
        const expandedAgentState = getAgent(expandedAgent);
        const expandedConfig = AGENT_CONFIG[expandedAgent];
        const backendName = expandedAgent === 'mutation' ? 'mutation-verifier' : expandedAgent;
        const agentIsActive = expandedAgentState.status === 'active';
        const agentIsStreaming = streamingState?.agent === backendName || streamingState?.agent === expandedAgent;

        return (
          <Box mt={3}>
            {/* Active agent: show live reasoning stream */}
            {agentIsActive && (
              <LiveReasoningStream
                agentName={expandedAgent as any}
                agentLabel={expandedConfig.label}
                agentColor={expandedConfig.color}
                streamingState={agentIsStreaming ? streamingState! : null}
                streamingBuffer={agentIsStreaming ? (streamingState?.text || '') : ''}
                isActive={true}
              />
            )}

            {/* Completed/failed agent: show conversation panel with chat */}
            {!agentIsActive && runId && (
              <AgentConversationPanel
                runId={runId}
                agent={backendName}
                agentLabel={expandedConfig.label}
                agentColor={expandedConfig.color}
                onClose={() => setExpandedAgent(null)}
              />
            )}

            {/* Idle agent with no runId: just show description */}
            {!agentIsActive && !runId && (
              <Box p={4} bg={idlePanelBg} borderRadius="md" border="1px solid" borderColor={borderColor}>
                <Text fontSize="sm" color="gray.500">{expandedConfig.description}</Text>
                <Text fontSize="xs" color="gray.400" mt={1}>Start a QA run to see this agent in action.</Text>
              </Box>
            )}
          </Box>
        );
      })()}
    </Box>
  );
};

export default AgentPipeline;
