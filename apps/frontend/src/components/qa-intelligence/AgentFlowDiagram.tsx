/**
 * AgentFlowDiagram - Plant Manager Control Room
 * Two-track flow diagram showing all 13 agents and their data flow connections.
 * Track 1: QA Pipeline (horizontal)
 * Track 2: Intelligence Pipeline (branching fan-out)
 */

import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Tooltip,
  Flex,
  Icon,
  useColorModeValue,
  SimpleGrid,
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
  ArrowRight,
  ArrowDown,
  RotateCcw,
  Briefcase,
  Search,
  Wrench,
  Shield,
  Layers,
} from 'lucide-react';
import type { AgentState, AgentName } from '../../services/qaService';
import type { AgentStreamingState, HandoffInfo } from '../../hooks/useAgentStream';
import { useQARunStore } from '../../stores/qa-run-store';

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
    label: 'Code Quality',
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

// ── Track definitions ──────────────────────────────────────────────────────

const TRACK_1_AGENTS = ['repo-ingester', 'strategist', 'generator', 'critic', 'executor', 'mutation'];
const TRACK_2_ROW_1 = ['product-manager', 'research-assistant'];
const TRACK_2_ROW_2 = ['code-quality-architect', 'self-healer', 'api-validator', 'coverage-auditor', 'ui-ux-analyst'];

// ── Props ──────────────────────────────────────────────────────────────────

interface AgentFlowDiagramProps {
  agents: AgentState[];
  runId?: string;
  streamingState?: AgentStreamingState | null;
  activeAgent?: AgentName | null;
  handoffData?: Record<string, HandoffInfo>;
  onAgentClick: (agentName: string) => void;
  selectedAgent: string | null;
}

// ── Helper: get agent state ────────────────────────────────────────────────

function getAgentState(agents: AgentState[], name: string): AgentState {
  return (
    agents.find((a) => a.name === name) || {
      name: name as AgentName,
      status: 'idle' as const,
      progress: 0,
      message: AGENT_CONFIG[name]?.description || '',
    }
  );
}

// ── Agent Node ─────────────────────────────────────────────────────────────

interface AgentNodeProps {
  agentName: string;
  agents: AgentState[];
  selectedAgent: string | null;
  onAgentClick: (name: string) => void;
  isSkipped?: boolean;
  skipReason?: string;
}

const AgentNode: React.FC<AgentNodeProps> = React.memo(
  ({ agentName, agents, selectedAgent, onAgentClick, isSkipped, skipReason }) => {
    const config = AGENT_CONFIG[agentName];
    if (!config) return null;

    const agent = getAgentState(agents, agentName);
    const isActive = agent.status === 'active';
    const isCompleted = agent.status === 'completed';
    const isFailed = agent.status === 'failed';
    const isLooping = agent.status === 'looping';
    const isSelectedAgent = selectedAgent === agentName;

    const cardBg = useColorModeValue('white', 'gray.800');
    const skippedBg = useColorModeValue('gray.50', 'gray.900');
    const idleBorder = useColorModeValue('gray.200', 'gray.600');
    const mutedText = useColorModeValue('gray.400', 'gray.500');
    const AgentIcon = config.icon;

    // Determine border color
    const borderColor = isSkipped
      ? useColorModeValue('gray.200', 'gray.700')
      : isSelectedAgent
      ? `${config.color}.500`
      : isActive || isLooping
      ? `${config.color}.400`
      : isCompleted
      ? 'green.300'
      : isFailed
      ? 'red.300'
      : idleBorder;

    // Determine bg
    const bg = isSkipped
      ? skippedBg
      : isSelectedAgent
      ? useColorModeValue(`${config.color}.50`, `${config.color}.900`)
      : isActive
      ? useColorModeValue(`${config.color}.50`, `${config.color}.900`)
      : cardBg;

    // Status badge color
    const badgeColor = isSkipped
      ? 'gray'
      : isActive
      ? config.color
      : isCompleted
      ? 'green'
      : isFailed
      ? 'red'
      : isLooping
      ? 'orange'
      : 'gray';

    // Glow shadow for active
    const glowShadow = isActive
      ? `0 0 8px var(--chakra-colors-${config.color}-300)`
      : 'none';

    const tooltipLabel = isSkipped
      ? `Skipped: ${skipReason || 'requirements not met'}`
      : config.description;

    return (
      <Tooltip label={tooltipLabel} fontSize="xs" hasArrow placement="top">
        <Box position="relative" display="inline-block" opacity={isSkipped ? 0.45 : 1}>
          <MotionBox
            px={3}
            py={2}
            borderRadius="lg"
            border={isSelectedAgent ? '2px solid' : '1px solid'}
            borderColor={borderColor}
            bg={bg}
            boxShadow={glowShadow}
            cursor={isSkipped ? 'default' : 'pointer'}
            onClick={() => !isSkipped && onAgentClick(agentName)}
            whileHover={isSkipped ? {} : { scale: 1.03 }}
            animate={
              isActive
                ? { scale: [1, 1.05, 1] }
                : {}
            }
            transition={
              isActive
                ? ({ duration: 1.5, repeat: Infinity, ease: 'easeInOut' } as any)
                : ({ duration: 0.2 } as any)
            }
            minW={{ base: '100px', md: '110px' }}
            textAlign="center"
            _hover={isSkipped ? {} : { shadow: 'md' }}
          >
            <VStack spacing={1}>
              <Flex
                w="28px"
                h="28px"
                borderRadius="md"
                bg={isSkipped || agent.status === 'idle' ? 'gray.100' : `${config.color}.100`}
                align="center"
                justify="center"
              >
                <AgentIcon
                  size={14}
                  color={
                    isSkipped || agent.status === 'idle'
                      ? `var(--chakra-colors-gray-400)`
                      : `var(--chakra-colors-${config.color}-500)`
                  }
                />
              </Flex>
              <Text
                fontSize="xs"
                fontWeight="bold"
                color={isSkipped || agent.status === 'idle' ? mutedText : undefined}
                noOfLines={1}
                textDecoration={isSkipped ? 'line-through' : undefined}
              >
                {config.label}
              </Text>
              <Badge
                colorScheme={badgeColor}
                variant={isActive || isLooping ? 'solid' : 'subtle'}
                fontSize="2xs"
                px={1.5}
                borderRadius="full"
              >
                {isSkipped ? 'skipped' : agent.status}
              </Badge>
            </VStack>
          </MotionBox>

          {/* Completed checkmark overlay */}
          {isCompleted && !isSkipped && (
            <Box position="absolute" top="-4px" right="-4px">
              <CheckCircle size={14} color="var(--chakra-colors-green-500)" fill="white" />
            </Box>
          )}

          {/* Failed X overlay */}
          {isFailed && !isSkipped && (
            <Box position="absolute" top="-4px" right="-4px">
              <XCircle size={14} color="var(--chakra-colors-red-500)" fill="white" />
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  }
);

AgentNode.displayName = 'AgentNode';

// ── Horizontal Arrow ───────────────────────────────────────────────────────

interface FlowArrowProps {
  fromAgent?: string;
  toAgent?: string;
  agents: AgentState[];
  handoffData?: Record<string, HandoffInfo>;
  isLoop?: boolean;
}

const FlowArrow: React.FC<FlowArrowProps> = React.memo(
  ({ fromAgent, toAgent, agents, handoffData, isLoop }) => {
    const fromState = fromAgent ? getAgentState(agents, fromAgent) : null;
    const toState = toAgent ? getAgentState(agents, toAgent) : null;
    const isConnectionActive =
      fromState?.status === 'completed' &&
      (toState?.status === 'active' || toState?.status === 'completed');
    const isLooping =
      isLoop && (fromState?.status === 'looping' || toState?.status === 'looping');

    const activeColor = useColorModeValue('blue.400', 'blue.300');
    const inactiveColor = useColorModeValue('gray.300', 'gray.600');
    const color = isLooping ? 'orange.400' : isConnectionActive ? activeColor : inactiveColor;

    const handoff = fromAgent && handoffData?.[fromAgent];

    return (
      <Flex
        align="center"
        justify="center"
        position="relative"
        mx={{ base: 0, md: -1 }}
        my={{ base: 1, md: 0 }}
        flexShrink={0}
      >
        <MotionBox
          animate={
            isConnectionActive || isLooping ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }
          }
          transition={
            isConnectionActive || isLooping
              ? { duration: 1.5, repeat: Infinity }
              : {}
          }
        >
          {isLooping ? (
            <MotionBox
              animate={{ rotate: [0, -360] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              color="orange.400"
            >
              <RotateCcw size={14} />
            </MotionBox>
          ) : (
            <Box
              display={{ base: 'none', md: 'block' }}
              color={color}
            >
              <ArrowRight size={14} />
            </Box>
          )}
          {/* Vertical arrow for mobile */}
          <Box display={{ base: 'block', md: 'none' }} color={color}>
            {isLooping ? null : <ArrowDown size={14} />}
          </Box>
        </MotionBox>

        {/* Handoff badge */}
        {handoff && (
          <Tooltip label={handoff.summary} fontSize="xs" hasArrow placement="top">
            <Badge
              position="absolute"
              top="-14px"
              fontSize="2xs"
              colorScheme="purple"
              variant="subtle"
              borderRadius="full"
              px={1}
              whiteSpace="nowrap"
              maxW="80px"
              overflow="hidden"
              textOverflow="ellipsis"
              cursor="default"
            >
              {handoff.summary}
            </Badge>
          </Tooltip>
        )}
      </Flex>
    );
  }
);

FlowArrow.displayName = 'FlowArrow';

// ── Vertical Connector (Track 1 to Track 2) ───────────────────────────────

const VerticalConnector: React.FC<{ agents: AgentState[] }> = ({ agents }) => {
  const mutationState = getAgentState(agents, 'mutation');
  const pmState = getAgentState(agents, 'product-manager');
  const isActive =
    mutationState.status === 'completed' &&
    (pmState.status === 'active' || pmState.status === 'completed');

  const activeColor = useColorModeValue('blue.400', 'blue.300');
  const inactiveColor = useColorModeValue('gray.300', 'gray.600');

  return (
    <Flex justify="center" py={2}>
      <MotionBox
        animate={isActive ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
        transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
        color={isActive ? activeColor : inactiveColor}
      >
        <ArrowDown size={18} />
      </MotionBox>
    </Flex>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────

const AgentFlowDiagram: React.FC<AgentFlowDiagramProps> = ({
  agents: propAgents,
  runId,
  streamingState,
  activeAgent,
  handoffData,
  onAgentClick,
  selectedAgent,
}) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const headerColor = useColorModeValue('gray.700', 'gray.200');
  const trackLabelColor = useColorModeValue('gray.500', 'gray.400');
  const trackBg = useColorModeValue('gray.50', 'gray.750');

  // Merge store statuses with prop agents — prefer store data if more recent
  const storeAgentStatuses = useQARunStore(s => s.agentStatuses);
  const storeSelectedAgents = useQARunStore(s => s.selectedAgents);
  const storeSkippedAgents = useQARunStore(s => s.skippedAgents);
  const agents = propAgents.map(a => {
    const storeStatus = storeAgentStatuses[a.name];
    if (storeStatus && a.status === 'idle' && storeStatus.status === 'completed') {
      return { ...a, status: 'completed' as const, progress: 100 };
    }
    if (storeStatus && a.status === 'idle' && storeStatus.status === 'running') {
      return { ...a, status: 'active' as const };
    }
    return a;
  });

  // Build a set of skipped agent IDs and their reasons for quick lookup
  const skippedAgentMap = new Map(
    storeSkippedAgents.map(a => [a.id, a.reason])
  );
  const hasDynamicSelection = storeSelectedAgents.length > 0;

  // Helper to check if an agent was skipped
  const isAgentSkipped = (agentName: string) => hasDynamicSelection && skippedAgentMap.has(agentName);
  const getSkipReason = (agentName: string) => skippedAgentMap.get(agentName) || 'requirements not met';

  const allAgents = [...TRACK_1_AGENTS, ...TRACK_2_ROW_1, ...TRACK_2_ROW_2];
  const activeCount = allAgents.filter((n) => getAgentState(agents, n).status === 'active').length;
  const completedCount = allAgents.filter(
    (n) => getAgentState(agents, n).status === 'completed'
  ).length;
  const totalRegisteredAgents = hasDynamicSelection
    ? storeSelectedAgents.length + storeSkippedAgents.length
    : allAgents.length;

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      p={4}
      overflow="hidden"
    >
      {/* Header */}
      <HStack mb={4} spacing={2}>
        <Brain size={16} />
        <Text fontSize="sm" fontWeight="bold" color={headerColor}>
          Agent Flow Diagram
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
      </HStack>

      {/* ── Track 1: QA Pipeline ─────────────────────────────────────────── */}
      <Box
        bg={trackBg}
        borderRadius="md"
        p={3}
        mb={2}
      >
        <Text fontSize="2xs" fontWeight="semibold" color={trackLabelColor} mb={2} textTransform="uppercase" letterSpacing="wider">
          Track 1 &mdash; QA Pipeline
        </Text>

        {/* Desktop: horizontal flow */}
        <Flex
          display={{ base: 'none', md: 'flex' }}
          align="center"
          justify="center"
          wrap="nowrap"
          overflowX="auto"
          gap={0}
        >
          {TRACK_1_AGENTS.map((name, idx) => {
            const isGeneratorCriticLoop =
              (name === 'generator' && TRACK_1_AGENTS[idx + 1] === 'critic') ||
              false;
            return (
              <React.Fragment key={name}>
                <AgentNode
                  agentName={name}
                  agents={agents}
                  selectedAgent={selectedAgent}
                  onAgentClick={onAgentClick}
                />
                {idx < TRACK_1_AGENTS.length - 1 && (
                  <FlowArrow
                    fromAgent={name}
                    toAgent={TRACK_1_AGENTS[idx + 1]}
                    agents={agents}
                    handoffData={handoffData}
                    isLoop={isGeneratorCriticLoop}
                  />
                )}
              </React.Fragment>
            );
          })}
        </Flex>

        {/* Mobile: vertical stack */}
        <VStack
          display={{ base: 'flex', md: 'none' }}
          spacing={1}
          align="center"
        >
          {TRACK_1_AGENTS.map((name, idx) => {
            const isGeneratorCriticLoop =
              name === 'generator' && TRACK_1_AGENTS[idx + 1] === 'critic';
            return (
              <React.Fragment key={name}>
                <AgentNode
                  agentName={name}
                  agents={agents}
                  selectedAgent={selectedAgent}
                  onAgentClick={onAgentClick}
                />
                {idx < TRACK_1_AGENTS.length - 1 && (
                  <FlowArrow
                    fromAgent={name}
                    toAgent={TRACK_1_AGENTS[idx + 1]}
                    agents={agents}
                    handoffData={handoffData}
                    isLoop={isGeneratorCriticLoop}
                  />
                )}
              </React.Fragment>
            );
          })}
        </VStack>
      </Box>

      {/* ── Vertical connector from Track 1 to Track 2 ──────────────────── */}
      <VerticalConnector agents={agents} />

      {/* ── Track 2: Intelligence Pipeline ───────────────────────────────── */}
      <Box
        bg={trackBg}
        borderRadius="md"
        p={3}
      >
        <Text fontSize="2xs" fontWeight="semibold" color={trackLabelColor} mb={2} textTransform="uppercase" letterSpacing="wider">
          Track 2 &mdash; Intelligence Pipeline
        </Text>

        {/* Row 1: Product Manager -> Research Assistant */}
        <Flex
          align="center"
          justify="center"
          mb={3}
          direction={{ base: 'column', md: 'row' }}
          gap={{ base: 1, md: 0 }}
        >
          <AgentNode
            agentName="product-manager"
            agents={agents}
            selectedAgent={selectedAgent}
            onAgentClick={onAgentClick}
            isSkipped={isAgentSkipped('product-manager')}
            skipReason={getSkipReason('product-manager')}
          />
          <FlowArrow
            fromAgent="product-manager"
            toAgent="research-assistant"
            agents={agents}
            handoffData={handoffData}
          />
          <AgentNode
            agentName="research-assistant"
            agents={agents}
            selectedAgent={selectedAgent}
            onAgentClick={onAgentClick}
            isSkipped={isAgentSkipped('research-assistant')}
            skipReason={getSkipReason('research-assistant')}
          />
        </Flex>

        {/* Fan-out arrow from Research Assistant */}
        <Flex justify="center" py={1}>
          <MotionBox
            color={useColorModeValue('gray.300', 'gray.600')}
            animate={
              getAgentState(agents, 'research-assistant').status === 'completed'
                ? { opacity: [0.5, 1, 0.5] }
                : {}
            }
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ArrowDown size={16} />
          </MotionBox>
        </Flex>

        {/* Row 2: Parallel fan-out specialists */}
        <Flex
          display={{ base: 'none', md: 'flex' }}
          align="flex-start"
          justify="center"
          gap={2}
          flexWrap="wrap"
        >
          {TRACK_2_ROW_2.map((name) => (
            <AgentNode
              key={name}
              agentName={name}
              agents={agents}
              selectedAgent={selectedAgent}
              onAgentClick={onAgentClick}
              isSkipped={isAgentSkipped(name)}
              skipReason={getSkipReason(name)}
            />
          ))}
        </Flex>

        {/* Mobile: 2-col grid for specialists */}
        <SimpleGrid
          display={{ base: 'grid', md: 'none' }}
          columns={2}
          spacing={2}
        >
          {TRACK_2_ROW_2.map((name) => (
            <Flex key={name} justify="center">
              <AgentNode
                agentName={name}
                agents={agents}
                selectedAgent={selectedAgent}
                onAgentClick={onAgentClick}
                isSkipped={isAgentSkipped(name)}
                skipReason={getSkipReason(name)}
              />
            </Flex>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
};

export default AgentFlowDiagram;
