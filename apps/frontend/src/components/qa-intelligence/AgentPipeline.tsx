/**
 * AgentPipeline - Live agent pipeline visualization
 * The showstopper component: shows 5 agents working in sequence with animated transitions
 */

import React from 'react';
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
} from 'lucide-react';
import type { AgentState, AgentName } from '../../services/qaService';

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

// ── Agent Config ───────────────────────────────────────────────────────────

interface AgentConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

const AGENT_CONFIG: Record<AgentName, AgentConfig> = {
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
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  idle: Circle,
  active: RefreshCw,
  completed: CheckCircle,
  failed: XCircle,
  looping: RotateCcw,
};

// ── Pulsing Dot Animation ──────────────────────────────────────────────────

const PulsingDot: React.FC<{ color: string }> = ({ color }) => (
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
);

// ── Arrow Connector ────────────────────────────────────────────────────────

const PipelineConnector: React.FC<{ isActive: boolean }> = ({ isActive }) => {
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
};

// ── Loop Indicator ─────────────────────────────────────────────────────────

const LoopIndicator: React.FC<{ from: string; to: string; iteration?: number }> = ({
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
};

// ── Single Agent Row ───────────────────────────────────────────────────────

interface AgentRowProps {
  agent: AgentState;
  config: AgentConfig;
  isActive: boolean;
}

const AgentRow: React.FC<AgentRowProps> = ({ agent, config, isActive }) => {
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
};

// ── Main Pipeline Component ────────────────────────────────────────────────

interface AgentPipelineProps {
  agents: AgentState[];
}

const AgentPipeline: React.FC<AgentPipelineProps> = ({ agents }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const headerColor = useColorModeValue('gray.700', 'gray.200');

  // Use the canonical order
  const orderedAgents: AgentName[] = ['strategist', 'generator', 'critic', 'executor', 'mutation'];

  const getAgent = (name: AgentName): AgentState => {
    return (
      agents.find((a) => a.name === name) || {
        name,
        status: 'idle',
        progress: 0,
        message: AGENT_CONFIG[name].description,
      }
    );
  };

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      p={4}
      height="100%"
    >
      <HStack mb={4} spacing={2}>
        <Brain size={18} />
        <Text fontSize="md" fontWeight="bold" color={headerColor}>
          Agent Pipeline
        </Text>
        <Badge colorScheme="purple" variant="subtle" fontSize="2xs">
          5 Agents
        </Badge>
      </HStack>

      <VStack spacing={0} align="stretch">
        {orderedAgents.map((name, index) => {
          const agent = getAgent(name);
          const config = AGENT_CONFIG[name];
          const isActive = agent.status === 'active';

          return (
            <React.Fragment key={name}>
              <AgentRow agent={agent} config={config} isActive={isActive} />
              {index < orderedAgents.length - 1 && (
                <PipelineConnector
                  isActive={
                    agent.status === 'completed' ||
                    getAgent(orderedAgents[index + 1]).status === 'active'
                  }
                />
              )}
            </React.Fragment>
          );
        })}
      </VStack>
    </Box>
  );
};

export default AgentPipeline;
