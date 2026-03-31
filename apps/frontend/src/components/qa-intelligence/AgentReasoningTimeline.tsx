/**
 * AgentReasoningTimeline - Step-by-step reasoning view for a single agent
 * Shows each LLM conversation step with prompt/response, sub-agent spawning,
 * token usage, and timing. Expandable accordion pattern.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Code,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Divider,
  Icon,
  Spinner,
  useColorModeValue,
  Alert,
  AlertIcon,
  Tooltip,
} from '@chakra-ui/react';
import {
  Search,
  Clock,
  Zap,
  GitBranch,
  CheckCircle,
  XCircle,
  MessageSquare,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import qaService from '../../services/qaService';
import type { AgentConversation } from '../../services/qaService';
import { useQARunStore } from '../../stores/qa-run-store';

// ── Types ────────────────────────────────────────────────────────────────────

interface ReasoningStep {
  stepNumber: number;
  label: string;
  prompt: string;
  response: string;
  durationMs: number;
  tokensUsed: number;
  status: 'completed' | 'failed';
  spawnedSubAgents?: SubAgentReasoning[];
}

interface SubAgentReasoning {
  id: string;
  name: string;
  steps: ReasoningStep[];
  totalDurationMs: number;
  totalTokens: number;
}

interface AgentReasoningTimelineProps {
  agentId: string;
  agentName: string;
  runId?: string;
  conversations?: any[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${tokens}`;
}

function truncateText(text: string, maxLength: number = 200): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// ── Sub-agent reasoning block ────────────────────────────────────────────────

function SubAgentBlock({ subAgent }: { subAgent: SubAgentReasoning }) {
  const borderColor = useColorModeValue('gray.300', 'gray.600');
  const subBg = useColorModeValue('gray.50', 'gray.750');

  return (
    <Box
      ml={6}
      mt={2}
      pl={3}
      borderLeft="2px solid"
      borderLeftColor="blue.300"
    >
      <HStack spacing={2} mb={1}>
        <Icon as={GitBranch} boxSize={3} color="blue.400" />
        <Text fontSize="xs" fontWeight="bold" color="blue.500">
          {subAgent.name}
        </Text>
        <Badge variant="subtle" colorScheme="blue" fontSize="2xs">
          {subAgent.steps.length} step{subAgent.steps.length !== 1 ? 's' : ''}
        </Badge>
        <Text fontSize="2xs" color="gray.500">
          {formatDuration(subAgent.totalDurationMs)}, {formatTokens(subAgent.totalTokens)} tokens
        </Text>
      </HStack>

      <VStack spacing={1} align="stretch">
        {subAgent.steps.map((step) => (
          <HStack
            key={`sub-step-${step.stepNumber}`}
            spacing={2}
            bg={subBg}
            px={2}
            py={1}
            borderRadius="sm"
            fontSize="xs"
          >
            <Icon as={ChevronRight} boxSize={3} color="gray.400" />
            <Text fontWeight="medium">Step {step.stepNumber}:</Text>
            <Text color="gray.600" noOfLines={1} flex={1}>
              {step.label}
            </Text>
            <Text color="gray.400" fontSize="2xs">
              {truncateText(step.response, 60)}
            </Text>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AgentReasoningTimeline({
  agentId,
  agentName,
  runId,
  conversations: externalConversations,
}: AgentReasoningTimelineProps) {
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const codeBg = useColorModeValue('gray.50', 'gray.900');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const promptBg = useColorModeValue('blue.50', 'blue.900');
  const responseBg = useColorModeValue('green.50', 'green.900');

  // Fetch conversations on mount or when runId/agentId changes
  useEffect(() => {
    if (externalConversations?.length) {
      setConversations(externalConversations);
      return;
    }

    if (!runId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    qaService.getConversations(runId, agentId).then((data) => {
      if (cancelled) return;
      setConversations(data.conversations || []);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err.message || 'Failed to load conversations');
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [runId, agentId, externalConversations]);

  // Build reasoning steps from conversations
  const steps = useMemo((): ReasoningStep[] => {
    if (!conversations.length) return [];

    return conversations
      .filter(c => c.agent === agentId || c.agent === agentName)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((conv, idx) => {
        // Detect sub-agent spawning from response content
        const spawnedSubAgents: SubAgentReasoning[] = [];
        const spawnMatch = conv.response?.match(/spawn(?:ing|ed)\s+(?:sub[- ]?agent|agent)/gi);
        // We could parse sub-agent info from structured data if available

        const totalTokens = (conv.tokensUsed?.input || 0) + (conv.tokensUsed?.output || 0);

        return {
          stepNumber: idx + 1,
          label: extractStepLabel(conv.userMessage, idx),
          prompt: conv.userMessage || conv.systemPrompt || '',
          response: conv.response || '',
          durationMs: conv.durationMs || 0,
          tokensUsed: totalTokens,
          status: 'completed' as const,
          spawnedSubAgents: spawnedSubAgents.length > 0 ? spawnedSubAgents : undefined,
        };
      });
  }, [conversations, agentId, agentName]);

  // Aggregate stats
  const totalDuration = steps.reduce((sum, s) => sum + s.durationMs, 0);
  const totalTokens = steps.reduce((sum, s) => sum + s.tokensUsed, 0);
  const subAgentCount = steps.reduce((sum, s) => sum + (s.spawnedSubAgents?.length || 0), 0);

  // Loading state
  if (loading) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6}>
        <HStack spacing={3} justify="center">
          <Spinner size="sm" color="blue.400" />
          <Text fontSize="sm" color={subtextColor}>Loading reasoning timeline...</Text>
        </HStack>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert status="warning" borderRadius="md" fontSize="sm">
        <AlertIcon />
        <Text>{error}</Text>
      </Alert>
    );
  }

  // Empty state
  if (!steps.length) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
        <VStack spacing={2}>
          <HStack spacing={2}>
            <Icon as={MessageSquare} boxSize={4} color="gray.400" />
            <Text fontWeight="medium" fontSize="sm">{agentName} Reasoning</Text>
          </HStack>
          <Text fontSize="xs" color={subtextColor}>
            No conversation data available. Run an analysis to see agent reasoning steps.
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
      {/* Header */}
      <HStack spacing={3} mb={3}>
        <Icon as={Search} boxSize={4} color="blue.500" />
        <Text fontWeight="bold" fontSize="sm">{agentName}</Text>
        <Text fontSize="xs" color={subtextColor}>
          {steps.length} step{steps.length !== 1 ? 's' : ''}
          {subAgentCount > 0 ? `, ${subAgentCount} sub-agent${subAgentCount !== 1 ? 's' : ''}` : ''}
          , {formatDuration(totalDuration)}
          , {formatTokens(totalTokens)} tokens
        </Text>
      </HStack>

      <Divider mb={3} />

      {/* Steps accordion */}
      <Accordion allowMultiple defaultIndex={[0]}>
        {steps.map((step) => (
          <AccordionItem key={`reason-step-${step.stepNumber}`} border="none" mb={2}>
            <AccordionButton
              px={3}
              py={2}
              borderRadius="md"
              _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
            >
              <HStack flex={1} spacing={2}>
                <Icon
                  as={step.status === 'completed' ? CheckCircle : XCircle}
                  boxSize={3.5}
                  color={step.status === 'completed' ? 'green.500' : 'red.500'}
                />
                <Text fontWeight="medium" fontSize="sm">
                  Step {step.stepNumber}: {step.label}
                </Text>
                <HStack spacing={1} ml="auto">
                  {step.durationMs > 0 && (
                    <Tooltip label="Duration" hasArrow>
                      <Badge variant="outline" colorScheme="gray" fontSize="2xs">
                        <HStack spacing={0.5}>
                          <Icon as={Clock} boxSize={2.5} />
                          <Text>{formatDuration(step.durationMs)}</Text>
                        </HStack>
                      </Badge>
                    </Tooltip>
                  )}
                  {step.tokensUsed > 0 && (
                    <Tooltip label="Tokens used" hasArrow>
                      <Badge variant="outline" colorScheme="gray" fontSize="2xs">
                        <HStack spacing={0.5}>
                          <Icon as={Zap} boxSize={2.5} />
                          <Text>{formatTokens(step.tokensUsed)}</Text>
                        </HStack>
                      </Badge>
                    </Tooltip>
                  )}
                  {step.status === 'completed' && (
                    <Icon as={CheckCircle} boxSize={3} color="green.400" />
                  )}
                </HStack>
              </HStack>
              <AccordionIcon ml={2} />
            </AccordionButton>

            <AccordionPanel px={3} pb={3}>
              <VStack spacing={2} align="stretch">
                {/* Prompt */}
                <Box>
                  <Text fontSize="2xs" fontWeight="bold" color="blue.500" mb={1}>
                    Prompt:
                  </Text>
                  <Box
                    bg={promptBg}
                    borderRadius="md"
                    px={3}
                    py={2}
                    fontSize="xs"
                    maxH="150px"
                    overflowY="auto"
                    whiteSpace="pre-wrap"
                    fontFamily="mono"
                  >
                    {truncateText(step.prompt, 500)}
                  </Box>
                </Box>

                {/* Response */}
                <Box>
                  <Text fontSize="2xs" fontWeight="bold" color="green.500" mb={1}>
                    Response:
                  </Text>
                  <Box
                    bg={responseBg}
                    borderRadius="md"
                    px={3}
                    py={2}
                    fontSize="xs"
                    maxH="200px"
                    overflowY="auto"
                    whiteSpace="pre-wrap"
                    fontFamily="mono"
                  >
                    {truncateText(step.response, 800)}
                  </Box>
                </Box>

                {/* Sub-agents spawned in this step */}
                {step.spawnedSubAgents?.map((sub) => (
                  <SubAgentBlock key={sub.id} subAgent={sub} />
                ))}
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </Box>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractStepLabel(prompt: string, index: number): string {
  if (!prompt) return `Analysis ${index + 1}`;

  // Try to extract a meaningful label from the prompt
  const firstLine = prompt.split('\n')[0].trim();
  if (firstLine.length <= 60) return firstLine;

  // Look for common patterns
  const patterns = [
    /(?:map|identify|find|analyze|scan|check|validate|verify|inspect|review|assess)\s+(.{10,50})/i,
    /(?:focus|prioritize|consolidate|merge|report|summarize)\s+(.{10,50})/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match) {
      const label = match[0].slice(0, 50);
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }

  // Fallback: first 50 chars of first line
  return firstLine.slice(0, 50) + (firstLine.length > 50 ? '...' : '');
}
