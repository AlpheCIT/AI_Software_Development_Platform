/**
 * AgentSpawningTree - Real-time agent execution tree visualization
 * Shows agents, their steps, and sub-agent spawning as a flexbox-based tree.
 * Data: useQARunStore().productData?.executionLog for completed runs,
 *       WebSocket events for live runs.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Icon,
  Tooltip,
  Collapse,
  useColorModeValue,
  Spinner,
  Flex,
} from '@chakra-ui/react';
import {
  Shield,
  Monitor,
  Server,
  Zap,
  Search,
  GitBranch,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Pause,
} from 'lucide-react';
import { useQARunStore } from '../../stores/qa-run-store';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgentStep {
  stepNumber: number;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  durationMs?: number;
  tokensUsed?: number;
  spawnedAgents?: SubAgent[];
}

export interface SubAgent {
  id: string;
  name: string;
  domain: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps?: AgentStep[];
  durationMs?: number;
}

export interface AgentSession {
  id: string;
  name: string;
  domain: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  steps: AgentStep[];
  totalSteps: number;
  completedSteps: number;
  durationMs?: number;
  tokensUsed?: number;
  subAgents?: SubAgent[];
}

interface AgentSpawningTreeProps {
  runId?: string;
  sessions?: AgentSession[];
  liveEvents?: boolean;
}

// ── Domain color/icon mapping ────────────────────────────────────────────────

const DOMAIN_CONFIG: Record<string, { color: string; icon: any }> = {
  security: { color: 'red', icon: Shield },
  frontend: { color: 'blue', icon: Monitor },
  backend: { color: 'green', icon: Server },
  performance: { color: 'orange', icon: Zap },
  quality: { color: 'purple', icon: Search },
  architecture: { color: 'teal', icon: GitBranch },
  default: { color: 'gray', icon: Play },
};

function getDomainConfig(domain: string) {
  return DOMAIN_CONFIG[domain?.toLowerCase()] || DOMAIN_CONFIG.default;
}

// ── Status badge helper ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    idle: 'gray',
    pending: 'gray',
    running: 'blue',
    completed: 'green',
    failed: 'red',
  };
  const iconMap: Record<string, any> = {
    idle: Clock,
    pending: Clock,
    running: Spinner,
    completed: CheckCircle,
    failed: XCircle,
  };
  const LucideIcon = iconMap[status] || Clock;

  return (
    <Badge
      colorScheme={colorMap[status] || 'gray'}
      variant="subtle"
      fontSize="2xs"
      px={1.5}
      borderRadius="full"
      display="flex"
      alignItems="center"
      gap={1}
    >
      {status === 'running' ? (
        <Spinner size="xs" speed="0.8s" />
      ) : (
        <Icon as={LucideIcon} boxSize={3} />
      )}
      {status}
    </Badge>
  );
}

// ── Step node ────────────────────────────────────────────────────────────────

function StepNode({ step, isLast }: { step: AgentStep; isLast: boolean }) {
  const borderColor = useColorModeValue('gray.300', 'gray.600');
  const stepBg = useColorModeValue('gray.50', 'gray.700');
  const completedBg = useColorModeValue('green.50', 'green.900');
  const failedBg = useColorModeValue('red.50', 'red.900');
  const runningBg = useColorModeValue('blue.50', 'blue.900');

  const bg =
    step.status === 'completed' ? completedBg :
    step.status === 'failed' ? failedBg :
    step.status === 'running' ? runningBg :
    stepBg;

  return (
    <HStack spacing={0} align="flex-start">
      {/* Connector line */}
      <Box position="relative" w="24px" flexShrink={0}>
        <Box
          position="absolute"
          top="50%"
          left="0"
          w="24px"
          h="2px"
          bg={borderColor}
        />
        {!isLast && (
          <Box
            position="absolute"
            top="50%"
            left="0"
            w="2px"
            h="calc(100% + 8px)"
            bg={borderColor}
          />
        )}
      </Box>

      <Tooltip
        label={
          step.durationMs
            ? `${(step.durationMs / 1000).toFixed(1)}s${step.tokensUsed ? `, ${step.tokensUsed.toLocaleString()} tokens` : ''}`
            : undefined
        }
        placement="top"
        hasArrow
      >
        <Box
          bg={bg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="md"
          px={2}
          py={1}
          fontSize="xs"
          minW="120px"
          cursor="default"
        >
          <HStack spacing={1}>
            <Text fontWeight="medium" color={step.status === 'completed' ? 'green.600' : undefined}>
              Step {step.stepNumber}
            </Text>
            {step.status === 'completed' && <Icon as={CheckCircle} boxSize={3} color="green.500" />}
            {step.status === 'failed' && <Icon as={XCircle} boxSize={3} color="red.500" />}
            {step.status === 'running' && <Spinner size="xs" color="blue.500" />}
          </HStack>
          {step.label && (
            <Text fontSize="2xs" color="gray.500" noOfLines={1}>
              {step.label}
            </Text>
          )}
        </Box>
      </Tooltip>
    </HStack>
  );
}

// ── Sub-agent node ───────────────────────────────────────────────────────────

function SubAgentNode({ agent }: { agent: SubAgent }) {
  const [expanded, setExpanded] = useState(false);
  const borderColor = useColorModeValue('gray.300', 'gray.600');
  const subBg = useColorModeValue('gray.50', 'gray.750');
  const config = getDomainConfig(agent.domain);

  return (
    <Box ml={8} mt={1}>
      <HStack spacing={0}>
        {/* Branch connector */}
        <Box position="relative" w="16px" flexShrink={0}>
          <Box position="absolute" top="0" left="0" w="2px" h="50%" bg={borderColor} />
          <Box position="absolute" top="50%" left="0" w="16px" h="2px" bg={borderColor} />
        </Box>

        <HStack
          bg={subBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="md"
          px={2}
          py={1}
          spacing={2}
          cursor={agent.steps?.length ? 'pointer' : 'default'}
          onClick={() => agent.steps?.length && setExpanded(!expanded)}
          _hover={agent.steps?.length ? { borderColor: `${config.color}.400` } : undefined}
          transition="border-color 0.15s"
        >
          <Icon as={GitBranch} boxSize={3} color={`${config.color}.400`} />
          <Text fontSize="xs" fontWeight="medium">{agent.name}</Text>
          <Text fontSize="2xs" color="gray.500">(sub)</Text>
          <StatusBadge status={agent.status} />
          {agent.steps?.length ? (
            <Icon as={expanded ? ChevronDown : ChevronRight} boxSize={3} color="gray.400" />
          ) : null}
        </HStack>
      </HStack>

      <Collapse in={expanded} animateOpacity>
        <VStack align="stretch" spacing={1} ml={6} mt={1}>
          {agent.steps?.map((step, idx) => (
            <StepNode
              key={`sub-step-${idx}`}
              step={step}
              isLast={idx === (agent.steps?.length || 0) - 1}
            />
          ))}
        </VStack>
      </Collapse>
    </Box>
  );
}

// ── Agent row ────────────────────────────────────────────────────────────────

function AgentRow({ session }: { session: AgentSession }) {
  const [expanded, setExpanded] = useState(true);
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const cardBg = useColorModeValue('white', 'gray.800');
  const config = getDomainConfig(session.domain);
  const DomainIcon = config.icon;

  const stepCount = `${session.completedSteps}/${session.totalSteps} steps`;

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      p={3}
      transition="all 0.2s"
    >
      {/* Agent header */}
      <HStack
        spacing={3}
        cursor="pointer"
        onClick={() => setExpanded(!expanded)}
        _hover={{ opacity: 0.85 }}
      >
        <Tooltip label={session.domain || 'agent'} placement="top" hasArrow>
          <Box
            bg={`${config.color}.100`}
            p={1.5}
            borderRadius="md"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Icon as={DomainIcon} boxSize={4} color={`${config.color}.600`} />
          </Box>
        </Tooltip>

        <Text fontWeight="semibold" fontSize="sm">{session.name}</Text>
        <StatusBadge status={session.status} />

        <Badge variant="outline" colorScheme="gray" fontSize="2xs">
          {stepCount}
        </Badge>

        {session.subAgents && session.subAgents.length > 0 && (
          <Badge variant="subtle" colorScheme={config.color} fontSize="2xs">
            {session.subAgents.length} sub-agent{session.subAgents.length !== 1 ? 's' : ''}
          </Badge>
        )}

        {session.durationMs && (
          <Text fontSize="2xs" color="gray.500">
            {(session.durationMs / 1000).toFixed(1)}s
          </Text>
        )}

        {session.tokensUsed && (
          <Text fontSize="2xs" color="gray.500">
            {session.tokensUsed.toLocaleString()} tokens
          </Text>
        )}

        <Box flex={1} />
        <Icon
          as={expanded ? ChevronDown : ChevronRight}
          boxSize={4}
          color="gray.400"
        />
      </HStack>

      {/* Steps + sub-agents */}
      <Collapse in={expanded} animateOpacity>
        <Box mt={3} ml={2}>
          {/* Step pipeline (horizontal flow) */}
          <Flex wrap="wrap" gap={2} align="flex-start">
            {session.steps.map((step, idx) => (
              <VStack key={`step-${idx}`} spacing={1} align="stretch">
                <StepNode step={step} isLast={idx === session.steps.length - 1} />

                {/* Sub-agents spawned at this step */}
                {step.spawnedAgents?.map((sub) => (
                  <SubAgentNode key={sub.id} agent={sub} />
                ))}
              </VStack>
            ))}
          </Flex>

          {/* Standalone sub-agents (not attached to a step) */}
          {session.subAgents?.filter(sub => {
            const stepSpawned = session.steps.some(s =>
              s.spawnedAgents?.some(sa => sa.id === sub.id)
            );
            return !stepSpawned;
          }).map((sub) => (
            <SubAgentNode key={sub.id} agent={sub} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AgentSpawningTree({ runId, sessions: externalSessions, liveEvents = false }: AgentSpawningTreeProps) {
  const productData = useQARunStore(s => s.productData);
  const [liveSessions, setLiveSessions] = useState<AgentSession[]>([]);

  // Build sessions from product data execution log
  const storedSessions = useMemo(() => {
    if (externalSessions?.length) return externalSessions;

    const execLog = productData?.executionLog;
    if (!execLog || !Array.isArray(execLog)) return [];

    return execLog.map((entry: any, idx: number): AgentSession => {
      const steps: AgentStep[] = (entry.steps || []).map((s: any, sIdx: number) => ({
        stepNumber: sIdx + 1,
        label: s.label || s.name || `Step ${sIdx + 1}`,
        status: s.status || 'completed',
        durationMs: s.durationMs,
        tokensUsed: s.tokensUsed,
        spawnedAgents: (s.spawnedAgents || []).map((sub: any) => ({
          id: sub.id || `sub-${idx}-${sIdx}-${Math.random().toString(36).slice(2, 6)}`,
          name: sub.name || 'Sub-Agent',
          domain: sub.domain || entry.domain || 'default',
          status: sub.status || 'completed',
          steps: (sub.steps || []).map((ss: any, ssIdx: number) => ({
            stepNumber: ssIdx + 1,
            label: ss.label || ss.name || `Step ${ssIdx + 1}`,
            status: ss.status || 'completed',
            durationMs: ss.durationMs,
            tokensUsed: ss.tokensUsed,
          })),
          durationMs: sub.durationMs,
        })),
      }));

      const completedSteps = steps.filter(s => s.status === 'completed').length;

      return {
        id: entry.id || entry.agent || `agent-${idx}`,
        name: entry.name || entry.agent || `Agent ${idx + 1}`,
        domain: entry.domain || 'default',
        status: entry.status || 'completed',
        steps,
        totalSteps: steps.length || entry.totalSteps || 0,
        completedSteps,
        durationMs: entry.durationMs,
        tokensUsed: entry.tokensUsed,
        subAgents: entry.subAgents,
      };
    });
  }, [externalSessions, productData]);

  // WebSocket listener for live events
  useEffect(() => {
    if (!liveEvents || !runId) return;

    // Listen for custom agent spawn events on window
    const handleAgentEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.runId !== runId) return;

      setLiveSessions(prev => {
        const existing = prev.find(s => s.id === detail.agentId);
        if (detail.type === 'agent.spawn') {
          if (existing) return prev;
          return [...prev, {
            id: detail.agentId,
            name: detail.agentName || detail.agentId,
            domain: detail.domain || 'default',
            status: 'running',
            steps: [],
            totalSteps: detail.totalSteps || 0,
            completedSteps: 0,
          }];
        }
        if (detail.type === 'agent.step' && existing) {
          return prev.map(s => s.id === detail.agentId ? {
            ...s,
            steps: [...s.steps, {
              stepNumber: s.steps.length + 1,
              label: detail.label || '',
              status: detail.status || 'completed',
              durationMs: detail.durationMs,
              tokensUsed: detail.tokensUsed,
            }],
            completedSteps: s.completedSteps + (detail.status === 'completed' ? 1 : 0),
          } : s);
        }
        if (detail.type === 'agent.complete' && existing) {
          return prev.map(s => s.id === detail.agentId ? {
            ...s,
            status: 'completed',
            durationMs: detail.durationMs,
          } : s);
        }
        if (detail.type === 'agent.sub-spawn' && existing) {
          const subAgent: SubAgent = {
            id: detail.subAgentId || `sub-${Date.now()}`,
            name: detail.subAgentName || 'Sub-Agent',
            domain: detail.domain || existing.domain,
            status: 'running',
            steps: [],
          };
          return prev.map(s => s.id === detail.agentId ? {
            ...s,
            steps: s.steps.map((step, idx) =>
              idx === s.steps.length - 1
                ? { ...step, spawnedAgents: [...(step.spawnedAgents || []), subAgent] }
                : step
            ),
          } : s);
        }
        return prev;
      });
    };

    window.addEventListener('qa-agent-tree', handleAgentEvent);
    return () => window.removeEventListener('qa-agent-tree', handleAgentEvent);
  }, [liveEvents, runId]);

  const sessions = liveSessions.length > 0 ? liveSessions : storedSessions;

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  // Empty state
  if (!sessions.length) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6}>
        <VStack spacing={3}>
          <HStack spacing={2}>
            <Icon as={GitBranch} boxSize={5} color="gray.400" />
            <Text fontWeight="bold" fontSize="md">Agent Spawning Tree</Text>
            <Badge colorScheme="gray" variant="subtle" fontSize="xs">No Data</Badge>
          </HStack>
          <Text fontSize="sm" color={subtextColor} textAlign="center" maxW="400px">
            Run a QA analysis to see the agent execution tree. Agents will appear
            here as they spawn, execute steps, and create sub-agents.
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box>
      <HStack spacing={2} mb={2}>
        <Icon as={GitBranch} boxSize={4} color="blue.400" />
        <Text fontWeight="bold" fontSize="sm">Agent Spawning Tree</Text>
        <Badge colorScheme="blue" variant="subtle" fontSize="2xs">
          {sessions.length} agent{sessions.length !== 1 ? 's' : ''}
        </Badge>
        {liveEvents && (
          <Badge colorScheme="green" variant="solid" fontSize="2xs" borderRadius="full">
            Live
          </Badge>
        )}
      </HStack>

      <VStack spacing={2} align="stretch">
        {sessions.map((session) => (
          <AgentRow key={session.id} session={session} />
        ))}
      </VStack>
    </Box>
  );
}
