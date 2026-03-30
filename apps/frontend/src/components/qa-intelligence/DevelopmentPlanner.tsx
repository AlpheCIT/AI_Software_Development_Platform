/**
 * DevelopmentPlanner - Interactive planning tool based on behavioral specs
 *
 * Search through flows and components by keyword to find related elements,
 * then see the blast radius (impact analysis) of potential changes.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Code,
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
  Alert,
  AlertIcon,
  useColorModeValue,
  Heading,
  Tag,
  Divider,
  SimpleGrid,
} from '@chakra-ui/react';
import { Search, Target, AlertTriangle, Layers, Monitor, Server, GitBranch } from 'lucide-react';

const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || '';

// ── Types ──────────────────────────────────────────────────────────────────

interface ScreenElement {
  name: string;
  type: string;
  description: string;
}

interface Screen {
  name: string;
  path: string;
  elements: ScreenElement[];
  description?: string;
}

interface Endpoint {
  method: string;
  path: string;
  description: string;
}

interface RouteFile {
  filePath: string;
  endpoints: Endpoint[];
}

interface FlowStep {
  stepNumber: number;
  layer: string;
  action: string;
  filePath?: string;
}

interface EndToEndFlow {
  name: string;
  description?: string;
  steps: FlowStep[];
}

interface BehavioralSpecs {
  frontend?: { screens: Screen[] };
  backend?: { routes: RouteFile[] };
  flows?: EndToEndFlow[];
}

interface DevelopmentPlannerProps {
  runId?: string;
}

interface SearchResult {
  type: 'screen' | 'endpoint' | 'flow' | 'element';
  name: string;
  context: string;
  filePath?: string;
  flowName?: string;
}

interface ImpactResult {
  component: string;
  type: string;
  affectedFlows: string[];
  riskLevel: 'high' | 'medium' | 'low';
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DevelopmentPlanner({ runId }: DevelopmentPlannerProps) {
  const [specs, setSpecs] = useState<BehavioralSpecs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [impactTarget, setImpactTarget] = useState('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const codeBg = useColorModeValue('gray.50', 'gray.900');

  useEffect(() => {
    if (!QA_ENGINE_URL) {
      setSpecs(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function loadSpecs() {
      setLoading(true);
      setError(null);
      try {
        let effectiveRunId = runId;
        if (!effectiveRunId) {
          try {
            const runsRes = await fetch(`${QA_ENGINE_URL}/qa/runs`, { signal: controller.signal });
            if (runsRes.ok) {
              const runsData = await runsRes.json();
              const completed = (runsData.runs || []).filter((r: any) => r.status === 'completed');
              if (completed[0]) effectiveRunId = completed[0]._key || completed[0].runId;
            }
          } catch { /* ignore */ }
        }
        if (!effectiveRunId || cancelled) {
          if (!cancelled) setSpecs(null);
          return;
        }

        // Skip behavioral-specs (404), go directly to product endpoint
        const response = await fetch(`${QA_ENGINE_URL}/qa/product/${effectiveRunId}`, { signal: controller.signal });
        if (cancelled) return;
        if (response.ok) {
          const data = await response.json();
          setSpecs(data.behavioralSpecs || data.specs || data);
        } else {
          setError('No behavioral specs available for planning.');
        }
      } catch {
        if (!cancelled) setError('Failed to load behavioral specs for planning.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSpecs();
    return () => { cancelled = true; controller.abort(); };
  }, [runId]);

  // ── Search results ─────────────────────────────────────────────────────

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!specs || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Search frontend screens and elements
    for (const screen of specs.frontend?.screens || []) {
      if (screen.name.toLowerCase().includes(q) || screen.description?.toLowerCase().includes(q)) {
        results.push({ type: 'screen', name: screen.name, context: screen.path, filePath: screen.path });
      }
      for (const el of screen.elements || []) {
        if (el.name.toLowerCase().includes(q) || el.description.toLowerCase().includes(q)) {
          results.push({
            type: 'element',
            name: `${screen.name} > ${el.name}`,
            context: el.description,
            filePath: screen.path,
          });
        }
      }
    }

    // Search backend endpoints
    for (const rf of specs.backend?.routes || []) {
      for (const ep of rf.endpoints || []) {
        if (ep.path.toLowerCase().includes(q) || ep.description.toLowerCase().includes(q)) {
          results.push({
            type: 'endpoint',
            name: `${ep.method} ${ep.path}`,
            context: ep.description,
            filePath: rf.filePath,
          });
        }
      }
    }

    // Search flows
    for (const flow of specs.flows || []) {
      const matchesFlow =
        flow.name.toLowerCase().includes(q) ||
        flow.description?.toLowerCase().includes(q) ||
        flow.steps.some(s => s.action.toLowerCase().includes(q));
      if (matchesFlow) {
        results.push({
          type: 'flow',
          name: flow.name,
          context: flow.description || `${flow.steps.length} steps`,
          flowName: flow.name,
        });
      }
    }

    return results.slice(0, 50);
  }, [specs, searchQuery]);

  // ── Impact analysis ────────────────────────────────────────────────────

  const impactResults = useMemo<ImpactResult[]>(() => {
    if (!specs || !impactTarget.trim()) return [];
    const q = impactTarget.toLowerCase();
    const results: ImpactResult[] = [];
    const seenComponents = new Set<string>();

    // Find all flows that mention the target
    const affectedFlowNames: string[] = [];
    for (const flow of specs.flows || []) {
      const matches = flow.steps.some(
        s =>
          s.action.toLowerCase().includes(q) ||
          s.filePath?.toLowerCase().includes(q)
      );
      if (matches) affectedFlowNames.push(flow.name);
    }

    // Find screens that match
    for (const screen of specs.frontend?.screens || []) {
      if (
        screen.name.toLowerCase().includes(q) ||
        screen.path.toLowerCase().includes(q) ||
        screen.elements.some(e => e.name.toLowerCase().includes(q))
      ) {
        const key = `screen:${screen.name}`;
        if (!seenComponents.has(key)) {
          seenComponents.add(key);
          const flowsForScreen = (specs.flows || [])
            .filter(f => f.steps.some(s => s.action.toLowerCase().includes(screen.name.toLowerCase())))
            .map(f => f.name);

          results.push({
            component: screen.name,
            type: 'Frontend Screen',
            affectedFlows: [...new Set([...affectedFlowNames, ...flowsForScreen])],
            riskLevel: flowsForScreen.length > 2 ? 'high' : flowsForScreen.length > 0 ? 'medium' : 'low',
          });
        }
      }
    }

    // Find endpoints that match
    for (const rf of specs.backend?.routes || []) {
      for (const ep of rf.endpoints || []) {
        if (
          ep.path.toLowerCase().includes(q) ||
          ep.description.toLowerCase().includes(q) ||
          rf.filePath.toLowerCase().includes(q)
        ) {
          const key = `endpoint:${ep.method}:${ep.path}`;
          if (!seenComponents.has(key)) {
            seenComponents.add(key);
            const flowsForEndpoint = (specs.flows || [])
              .filter(f => f.steps.some(s =>
                s.action.toLowerCase().includes(ep.path.toLowerCase()) ||
                s.filePath?.toLowerCase().includes(rf.filePath.toLowerCase())
              ))
              .map(f => f.name);

            results.push({
              component: `${ep.method} ${ep.path}`,
              type: 'Backend Endpoint',
              affectedFlows: [...new Set([...affectedFlowNames, ...flowsForEndpoint])],
              riskLevel: flowsForEndpoint.length > 2 ? 'high' : flowsForEndpoint.length > 0 ? 'medium' : 'low',
            });
          }
        }
      }
    }

    // If no specific components found, still show affected flows
    if (results.length === 0 && affectedFlowNames.length > 0) {
      results.push({
        component: impactTarget,
        type: 'Search Term',
        affectedFlows: affectedFlowNames,
        riskLevel: affectedFlowNames.length > 3 ? 'high' : affectedFlowNames.length > 1 ? 'medium' : 'low',
      });
    }

    return results;
  }, [specs, impactTarget]);

  const RISK_COLORS: Record<string, string> = { high: 'red', medium: 'orange', low: 'green' };
  const TYPE_ICONS: Record<string, React.ReactNode> = {
    screen: <Monitor size={12} />,
    endpoint: <Server size={12} />,
    flow: <GitBranch size={12} />,
    element: <Layers size={12} />,
  };

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={8} textAlign="center">
        <VStack spacing={3}>
          <Spinner size="lg" color="blue.500" />
          <Text fontSize="sm" color={subtextColor}>Loading behavioral specs for planning...</Text>
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

  if (!specs) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6}>
        <VStack spacing={3}>
          <Target size={24} />
          <Text fontWeight="bold">No Data for Planning</Text>
          <Text fontSize="sm" color={subtextColor} textAlign="center" maxW="400px">
            Run a QA analysis to generate behavioral specs. The planner uses these specs
            to help you understand the impact of changes across your codebase.
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {/* Search section */}
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
        <Heading size="sm" mb={3}>
          <HStack spacing={2}>
            <Search size={16} />
            <Text>Find Components and Flows</Text>
          </HStack>
        </Heading>
        <InputGroup size="sm">
          <InputLeftElement>
            <Search size={14} />
          </InputLeftElement>
          <Input
            placeholder='Search flows and components (e.g., "authentication", "checkout")...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>

        {/* Search results */}
        {searchResults.length > 0 && (
          <VStack spacing={2} align="stretch" mt={3} maxH="300px" overflowY="auto">
            <Text fontSize="xs" color={subtextColor}>{searchResults.length} results</Text>
            {searchResults.map((result, idx) => (
              <HStack
                key={idx}
                spacing={2}
                p={2}
                bg={codeBg}
                borderRadius="md"
                fontSize="sm"
                cursor="pointer"
                onClick={() => setImpactTarget(result.name.split(' > ').pop() || result.name)}
                _hover={{ borderColor: 'blue.300', borderWidth: '1px' }}
              >
                {TYPE_ICONS[result.type] || <Layers size={12} />}
                <Badge
                  colorScheme={
                    result.type === 'screen' ? 'blue' :
                    result.type === 'endpoint' ? 'green' :
                    result.type === 'flow' ? 'purple' : 'gray'
                  }
                  fontSize="2xs"
                  variant="subtle"
                >
                  {result.type}
                </Badge>
                <Text fontWeight="medium" fontSize="sm" isTruncated>{result.name}</Text>
                <Text fontSize="xs" color={subtextColor} isTruncated flex={1}>{result.context}</Text>
                {result.filePath && (
                  <Code fontSize="xs" flexShrink={0}>{result.filePath.split('/').pop()}</Code>
                )}
              </HStack>
            ))}
          </VStack>
        )}

        {searchQuery.trim() && searchResults.length === 0 && (
          <Text fontSize="sm" color={subtextColor} mt={2}>No results found.</Text>
        )}
      </Box>

      {/* Impact analysis section */}
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
        <Heading size="sm" mb={3}>
          <HStack spacing={2}>
            <Target size={16} />
            <Text>Impact Analysis</Text>
          </HStack>
        </Heading>
        <Text fontSize="xs" color={subtextColor} mb={2}>
          Enter a component name or file path to see the blast radius of changes.
        </Text>
        <InputGroup size="sm">
          <InputLeftElement>
            <AlertTriangle size={14} />
          </InputLeftElement>
          <Input
            placeholder="What are you changing? (e.g., LoginForm, /api/auth, auth.ts)"
            value={impactTarget}
            onChange={(e) => setImpactTarget(e.target.value)}
          />
        </InputGroup>

        {/* Impact results */}
        {impactResults.length > 0 && (
          <VStack spacing={3} align="stretch" mt={4}>
            <Text fontSize="xs" color={subtextColor}>
              {impactResults.length} component{impactResults.length !== 1 ? 's' : ''} affected
            </Text>

            {impactResults.map((impact, idx) => (
              <Box
                key={idx}
                p={3}
                border="1px solid"
                borderColor={borderColor}
                borderLeft="4px solid"
                borderLeftColor={`${RISK_COLORS[impact.riskLevel]}.400`}
                borderRadius="md"
              >
                <HStack spacing={2} mb={2}>
                  <Badge colorScheme={RISK_COLORS[impact.riskLevel]} fontSize="2xs">
                    {impact.riskLevel} risk
                  </Badge>
                  <Text fontWeight="medium" fontSize="sm">{impact.component}</Text>
                  <Tag size="sm" variant="subtle">{impact.type}</Tag>
                </HStack>

                {impact.affectedFlows.length > 0 && (
                  <VStack align="start" spacing={1}>
                    <Text fontSize="xs" fontWeight="medium" color={subtextColor}>
                      Affected flows ({impact.affectedFlows.length}):
                    </Text>
                    <HStack spacing={1} flexWrap="wrap">
                      {impact.affectedFlows.map((flow, fIdx) => (
                        <Tag key={fIdx} size="sm" colorScheme="purple" variant="subtle">
                          {flow}
                        </Tag>
                      ))}
                    </HStack>
                  </VStack>
                )}

                {impact.affectedFlows.length === 0 && (
                  <Text fontSize="xs" color="green.500">
                    No end-to-end flows affected. Low blast radius.
                  </Text>
                )}
              </Box>
            ))}
          </VStack>
        )}

        {impactTarget.trim() && impactResults.length === 0 && (
          <Text fontSize="sm" color={subtextColor} mt={3}>
            No matching components or flows found for this search term.
          </Text>
        )}
      </Box>
    </VStack>
  );
}
