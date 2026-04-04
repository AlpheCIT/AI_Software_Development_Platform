/**
 * EndToEndFlowViewer - Interactive visualization of full-stack flows
 *
 * Shows numbered steps with swimlane layer labels (FRONTEND, MIDDLEWARE, BACKEND, DATABASE).
 * Each step is expandable to reveal file paths and code references.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Code,
  Collapse,
  Spinner,
  Alert,
  AlertIcon,
  useColorModeValue,
  Heading,
  Tag,
  Input,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import { GitBranch, Search, ChevronDown, ChevronRight } from 'lucide-react';



// ── Types ──────────────────────────────────────────────────────────────────

interface FlowStep {
  stepNumber: number;
  layer: 'FRONTEND' | 'MIDDLEWARE' | 'BACKEND' | 'DATABASE';
  action: string;
  detail?: string;
  filePath?: string;
  codeRef?: string;
}

interface EndToEndFlow {
  name: string;
  description?: string;
  steps: FlowStep[];
  triggers?: string[];
  tags?: string[];
}

interface EndToEndFlowViewerProps {
  runId?: string;
  flows?: EndToEndFlow[];
}

// ── Layer colors ───────────────────────────────────────────────────────────

const LAYER_COLORS: Record<string, string> = {
  FRONTEND: 'blue',
  MIDDLEWARE: 'orange',
  BACKEND: 'green',
  DATABASE: 'purple',
};

const LAYER_BG: Record<string, string> = {
  FRONTEND: 'blue.50',
  MIDDLEWARE: 'orange.50',
  BACKEND: 'green.50',
  DATABASE: 'purple.50',
};

const LAYER_BG_DARK: Record<string, string> = {
  FRONTEND: 'blue.900',
  MIDDLEWARE: 'orange.900',
  BACKEND: 'green.900',
  DATABASE: 'purple.900',
};

// ── Component ──────────────────────────────────────────────────────────────

export default function EndToEndFlowViewer({ runId, flows: propFlows }: EndToEndFlowViewerProps) {
  const [flows, setFlows] = useState<EndToEndFlow[]>(propFlows || []);
  const [loading, setLoading] = useState(!propFlows);
  const [error, setError] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const codeBg = useColorModeValue('gray.50', 'gray.900');

  useEffect(() => {
    if (propFlows) {
      setFlows(propFlows);
      setLoading(false);
      return;
    }
    if (false /* always use proxy */) {
      setFlows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function loadFlows() {
      setLoading(true);
      setError(null);
      try {
        let effectiveRunId = runId;
        if (!effectiveRunId) {
          try {
            const runsRes = await fetch(`/qa/runs`, { signal: controller.signal });
            if (runsRes.ok) {
              const runsData = await runsRes.json();
              const completed = (runsData.runs || []).filter((r: any) => r.status === 'completed');
              if (completed[0]) effectiveRunId = completed[0]._key || completed[0].runId;
            }
          } catch { /* ignore */ }
        }

        if (!effectiveRunId || cancelled) {
          if (!cancelled) setFlows([]);
          return;
        }

        // Skip behavioral-specs (404), go directly to product endpoint
        const response = await fetch(`/qa/product/${effectiveRunId}`, { signal: controller.signal });
        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          const specs = data.behavioralSpecs || data.specs || data;
          setFlows(specs.flows || []);
        } else {
          setError('No flow data available.');
        }
      } catch {
        if (!cancelled) setError('Failed to load end-to-end flows.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFlows();
    return () => { cancelled = true; controller.abort(); };
  }, [runId, propFlows]);

  function toggleStep(flowIdx: number, stepIdx: number) {
    const key = `${flowIdx}-${stepIdx}`;
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Filter flows by search
  const filteredFlows = searchQuery.trim()
    ? flows.filter(flow => {
        const q = searchQuery.toLowerCase();
        return (
          flow.name.toLowerCase().includes(q) ||
          flow.description?.toLowerCase().includes(q) ||
          flow.steps.some(s => s.action.toLowerCase().includes(q) || s.layer.toLowerCase().includes(q)) ||
          flow.tags?.some(t => t.toLowerCase().includes(q))
        );
      })
    : flows;

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={8} textAlign="center">
        <VStack spacing={3}>
          <Spinner size="lg" color="purple.500" />
          <Text fontSize="sm" color={subtextColor}>Loading end-to-end flows...</Text>
        </VStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="info" borderRadius="lg">
        <AlertIcon />
        <Text fontSize="sm">{error}</Text>
      </Alert>
    );
  }

  if (flows.length === 0) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6}>
        <VStack spacing={3}>
          <GitBranch size={24} />
          <Text fontWeight="bold">No End-to-End Flows</Text>
          <Text fontSize="sm" color={subtextColor} textAlign="center" maxW="400px">
            Run a QA analysis to discover and document end-to-end flows across your full stack.
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {/* Search */}
      <InputGroup size="sm">
        <InputLeftElement>
          <Search size={14} />
        </InputLeftElement>
        <Input
          placeholder="Search flows by name, step, or tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </InputGroup>

      {/* Flow count */}
      <Text fontSize="xs" color={subtextColor}>
        Showing {filteredFlows.length} of {flows.length} flows
      </Text>

      {/* Flow cards */}
      {filteredFlows.map((flow, fIdx) => (
        <Box key={fIdx} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
          <HStack spacing={2} mb={1}>
            <GitBranch size={16} />
            <Heading size="sm">{flow.name}</Heading>
            <Badge colorScheme="purple" fontSize="2xs">{flow.steps.length} steps</Badge>
          </HStack>

          {flow.description && (
            <Text fontSize="sm" color={subtextColor} mb={2} ml={6}>{flow.description}</Text>
          )}

          {flow.tags && flow.tags.length > 0 && (
            <HStack spacing={1} mb={3} ml={6} flexWrap="wrap">
              {flow.tags.map((tag, tIdx) => (
                <Tag key={tIdx} size="sm" variant="subtle" colorScheme="gray">{tag}</Tag>
              ))}
            </HStack>
          )}

          {/* Steps */}
          <VStack spacing={1} align="stretch" ml={2}>
            {flow.steps.map((step, sIdx) => {
              const stepKey = `${fIdx}-${sIdx}`;
              const isExpanded = expandedSteps.has(stepKey);
              const hasDetails = step.detail || step.filePath || step.codeRef;

              return (
                <Box key={sIdx}>
                  <HStack
                    spacing={3}
                    p={2}
                    borderRadius="md"
                    cursor={hasDetails ? 'pointer' : 'default'}
                    onClick={() => hasDetails && toggleStep(fIdx, sIdx)}
                    _hover={hasDetails ? { bg: codeBg } : undefined}
                    align="start"
                  >
                    {/* Step number */}
                    <Badge
                      minW="24px"
                      textAlign="center"
                      colorScheme="gray"
                      variant="solid"
                      fontSize="xs"
                      mt="2px"
                    >
                      {step.stepNumber}
                    </Badge>

                    {/* Layer badge */}
                    <Badge
                      colorScheme={LAYER_COLORS[step.layer] || 'gray'}
                      variant="subtle"
                      fontSize="xs"
                      minW="90px"
                      textAlign="center"
                      mt="2px"
                    >
                      {step.layer}
                    </Badge>

                    {/* Action text */}
                    <Text fontSize="sm" flex={1}>{step.action}</Text>

                    {/* Expand indicator */}
                    {hasDetails && (
                      isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    )}
                  </HStack>

                  {/* Expanded details */}
                  <Collapse in={isExpanded} animateOpacity>
                    <Box ml="120px" p={3} bg={codeBg} borderRadius="md" mb={1}>
                      {step.detail && (
                        <Text fontSize="xs" color={subtextColor} mb={1}>{step.detail}</Text>
                      )}
                      {step.filePath && (
                        <HStack spacing={1} mb={1}>
                          <Text fontSize="xs" fontWeight="medium">File:</Text>
                          <Code fontSize="xs">{step.filePath}</Code>
                        </HStack>
                      )}
                      {step.codeRef && (
                        <Box
                          mt={1}
                          p={2}
                          bg={useColorModeValue('gray.100', 'gray.700')}
                          borderRadius="sm"
                          fontFamily="mono"
                          fontSize="xs"
                          whiteSpace="pre-wrap"
                        >
                          {step.codeRef}
                        </Box>
                      )}
                    </Box>
                  </Collapse>

                  {/* Connector line between steps */}
                  {sIdx < flow.steps.length - 1 && (
                    <Box ml="22px" h="8px" borderLeft="2px dashed" borderColor={borderColor} />
                  )}
                </Box>
              );
            })}
          </VStack>
        </Box>
      ))}
    </VStack>
  );
}
