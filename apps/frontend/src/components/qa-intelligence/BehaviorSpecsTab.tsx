/**
 * BehaviorSpecsTab - Displays behavioral documentation from the latest QA run
 *
 * Shows frontend screens, backend routes, middleware, end-to-end flows,
 * and full-stack audit results in a tabbed accordion layout.
 * Fetches from /qa/behavioral-specs/:runId or /qa/product/:runId.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tag,
  Code,
  Spinner,
  Alert,
  AlertIcon,
  useColorModeValue,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import {
  Monitor,
  Server,
  Layers,
  GitBranch,
  AlertTriangle,
  Layout,
} from 'lucide-react';

const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || '';

// ── Types ──────────────────────────────────────────────────────────────────

interface ScreenElement {
  name: string;
  type: string;
  description: string;
  interactions?: string[];
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
  params?: string[];
  responseType?: string;
}

interface RouteFile {
  filePath: string;
  endpoints: Endpoint[];
}

interface MiddlewareEntry {
  name: string;
  scope: 'global' | 'route';
  appliesTo?: string[];
  description: string;
}

interface FlowStep {
  stepNumber: number;
  layer: 'FRONTEND' | 'MIDDLEWARE' | 'BACKEND' | 'DATABASE';
  action: string;
  detail?: string;
  filePath?: string;
}

interface EndToEndFlow {
  name: string;
  description?: string;
  steps: FlowStep[];
  triggers?: string[];
}

interface AuditMismatch {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  frontend?: string;
  backend?: string;
  suggestion?: string;
}

interface BehavioralSpecs {
  summary?: {
    totalElements?: number;
    screenCount?: number;
    routeCount?: number;
    flowCount?: number;
    middlewareCount?: number;
  };
  frontend?: {
    screens: Screen[];
  };
  backend?: {
    routes: RouteFile[];
  };
  middleware?: {
    global: MiddlewareEntry[];
    perRoute: MiddlewareEntry[];
  };
  flows?: EndToEndFlow[];
  audit?: {
    mismatches: AuditMismatch[];
  };
}

interface BehaviorSpecsTabProps {
  runId?: string;
}

// ── Layer badge colors ─────────────────────────────────────────────────────

const LAYER_COLORS: Record<string, string> = {
  FRONTEND: 'blue',
  MIDDLEWARE: 'orange',
  BACKEND: 'green',
  DATABASE: 'purple',
};

const METHOD_COLORS: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  PATCH: 'yellow',
  DELETE: 'red',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
};

// ── Component ──────────────────────────────────────────────────────────────

export default function BehaviorSpecsTab({ runId }: BehaviorSpecsTabProps) {
  const [specs, setSpecs] = useState<BehavioralSpecs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const codeBg = useColorModeValue('gray.50', 'gray.900');

  useEffect(() => {
    loadSpecs();
  }, [runId]);

  async function loadSpecs() {
    setLoading(true);
    setError(null);
    try {
      let effectiveRunId = runId;

      // If no runId, fetch latest completed run
      if (!effectiveRunId) {
        try {
          const runsRes = await fetch(`${QA_ENGINE_URL}/qa/runs`);
          if (runsRes.ok) {
            const runsData = await runsRes.json();
            const completed = (runsData.runs || []).filter((r: any) => r.status === 'completed');
            if (completed[0]) {
              effectiveRunId = completed[0]._key || completed[0].runId;
            }
          }
        } catch { /* ignore */ }
      }

      if (!effectiveRunId) {
        setSpecs(null);
        setLoading(false);
        return;
      }

      // Try behavioral-specs endpoint first, fall back to product
      let response = await fetch(`${QA_ENGINE_URL}/qa/behavioral-specs/${effectiveRunId}`);
      if (!response.ok) {
        response = await fetch(`${QA_ENGINE_URL}/qa/product/${effectiveRunId}`);
      }

      if (response.ok) {
        const data = await response.json();
        setSpecs(data.behavioralSpecs || data.specs || data);
      } else {
        setError('No behavioral specs available for this run.');
      }
    } catch (err) {
      setError('Failed to load behavioral specs.');
    } finally {
      setLoading(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={8} textAlign="center">
        <VStack spacing={3}>
          <Spinner size="lg" color="blue.500" />
          <Text fontSize="sm" color={subtextColor}>Loading behavioral specifications...</Text>
        </VStack>
      </Box>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────

  if (error) {
    return (
      <Alert status="info" borderRadius="lg">
        <AlertIcon />
        <Text fontSize="sm">{error}</Text>
      </Alert>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────

  if (!specs) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6}>
        <VStack spacing={3}>
          <Layout size={24} />
          <Text fontWeight="bold">No Behavioral Specs Yet</Text>
          <Text fontSize="sm" color={subtextColor} textAlign="center" maxW="400px">
            Run a QA analysis to generate behavioral documentation for your codebase.
            The specs will document screens, routes, middleware, and end-to-end flows.
          </Text>
        </VStack>
      </Box>
    );
  }

  // ── Summary stats ──────────────────────────────────────────────────────

  const summary = specs.summary || {};
  const screenCount = summary.screenCount || specs.frontend?.screens?.length || 0;
  const routeCount = summary.routeCount || specs.backend?.routes?.reduce((s, r) => s + r.endpoints.length, 0) || 0;
  const flowCount = summary.flowCount || specs.flows?.length || 0;
  const middlewareCount = summary.middlewareCount ||
    ((specs.middleware?.global?.length || 0) + (specs.middleware?.perRoute?.length || 0));

  // Show info alert when all data is zeros (DSPy service not available)
  if (screenCount === 0 && routeCount === 0 && flowCount === 0) {
    return (
      <Alert status="info" borderRadius="lg" variant="left-accent">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold" fontSize="sm">Behavioral specs require the DSPy service</Text>
          <Text fontSize="sm" mt={1}>
            The DSPy-powered behavioral analysis service must be running to generate screen, route, and flow documentation.
            Start the DSPy service and re-run the QA pipeline to populate behavioral specifications.
          </Text>
        </Box>
      </Alert>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {/* Summary banner */}
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
        <Text fontSize="sm" color={subtextColor} mb={3}>
          {summary.totalElements || (screenCount + routeCount + flowCount)} elements documented across{' '}
          {screenCount} screens, {routeCount} backend routes, {flowCount} end-to-end flows
        </Text>
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
          <Stat size="sm">
            <StatLabel fontSize="xs">Screens</StatLabel>
            <StatNumber fontSize="xl" color="blue.500">{screenCount}</StatNumber>
          </Stat>
          <Stat size="sm">
            <StatLabel fontSize="xs">Routes</StatLabel>
            <StatNumber fontSize="xl" color="green.500">{routeCount}</StatNumber>
          </Stat>
          <Stat size="sm">
            <StatLabel fontSize="xs">Flows</StatLabel>
            <StatNumber fontSize="xl" color="purple.500">{flowCount}</StatNumber>
          </Stat>
          <Stat size="sm">
            <StatLabel fontSize="xs">Middleware</StatLabel>
            <StatNumber fontSize="xl" color="orange.500">{middlewareCount}</StatNumber>
          </Stat>
        </SimpleGrid>
      </Box>

      {/* Tabbed content */}
      <Tabs variant="soft-rounded" colorScheme="blue" size="sm">
        <TabList flexWrap="wrap" gap={1}>
          <Tab>
            <HStack spacing={1}>
              <Monitor size={12} />
              <Text>Frontend</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={1}>
              <Server size={12} />
              <Text>Backend</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={1}>
              <Layers size={12} />
              <Text>Middleware</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={1}>
              <GitBranch size={12} />
              <Text>End-to-End Flows</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={1}>
              <AlertTriangle size={12} />
              <Text>Full Stack Audit</Text>
            </HStack>
          </Tab>
        </TabList>

        <TabPanels>
          {/* ── Frontend Tab ─────────────────────────────────────────── */}
          <TabPanel px={0}>
            {specs.frontend?.screens && specs.frontend.screens.length > 0 ? (
              <Accordion allowMultiple>
                {specs.frontend.screens.map((screen, idx) => (
                  <AccordionItem key={idx} border="1px solid" borderColor={borderColor} borderRadius="lg" mb={2}>
                    <AccordionButton>
                      <HStack flex={1} spacing={2}>
                        <Monitor size={14} />
                        <Text fontWeight="medium" fontSize="sm">{screen.name}</Text>
                        <Code fontSize="xs">{screen.path}</Code>
                        <Badge colorScheme="blue" fontSize="2xs">{screen.elements.length} elements</Badge>
                      </HStack>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel>
                      {screen.description && (
                        <Text fontSize="sm" color={subtextColor} mb={3}>{screen.description}</Text>
                      )}
                      <Table size="sm" variant="simple">
                        <Thead>
                          <Tr>
                            <Th>Element</Th>
                            <Th>Type</Th>
                            <Th>Description</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {screen.elements.map((el, elIdx) => (
                            <Tr key={elIdx}>
                              <Td fontWeight="medium" fontSize="sm">{el.name}</Td>
                              <Td><Tag size="sm" colorScheme="blue" variant="subtle">{el.type}</Tag></Td>
                              <Td fontSize="sm" color={subtextColor}>{el.description}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <Box p={4} bg={codeBg} borderRadius="md">
                <Text fontSize="sm" color={subtextColor}>No frontend screens documented yet.</Text>
              </Box>
            )}
          </TabPanel>

          {/* ── Backend Tab ──────────────────────────────────────────── */}
          <TabPanel px={0}>
            {specs.backend?.routes && specs.backend.routes.length > 0 ? (
              <Accordion allowMultiple>
                {specs.backend.routes.map((routeFile, idx) => (
                  <AccordionItem key={idx} border="1px solid" borderColor={borderColor} borderRadius="lg" mb={2}>
                    <AccordionButton>
                      <HStack flex={1} spacing={2}>
                        <Server size={14} />
                        <Code fontSize="xs">{routeFile.filePath}</Code>
                        <Badge colorScheme="green" fontSize="2xs">{routeFile.endpoints.length} endpoints</Badge>
                      </HStack>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel>
                      <Table size="sm" variant="simple">
                        <Thead>
                          <Tr>
                            <Th>Method</Th>
                            <Th>Path</Th>
                            <Th>Description</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {routeFile.endpoints.map((ep, epIdx) => (
                            <Tr key={epIdx}>
                              <Td>
                                <Badge colorScheme={METHOD_COLORS[ep.method] || 'gray'} fontSize="xs">
                                  {ep.method}
                                </Badge>
                              </Td>
                              <Td><Code fontSize="xs">{ep.path}</Code></Td>
                              <Td fontSize="sm" color={subtextColor}>{ep.description}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <Box p={4} bg={codeBg} borderRadius="md">
                <Text fontSize="sm" color={subtextColor}>No backend routes documented yet.</Text>
              </Box>
            )}
          </TabPanel>

          {/* ── Middleware Tab ───────────────────────────────────────── */}
          <TabPanel px={0}>
            <VStack spacing={4} align="stretch">
              {/* Global middleware */}
              <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
                <Heading size="sm" mb={3}>Global Middleware</Heading>
                {specs.middleware?.global && specs.middleware.global.length > 0 ? (
                  <VStack spacing={2} align="stretch">
                    {specs.middleware.global.map((mw, idx) => (
                      <HStack key={idx} p={2} bg={codeBg} borderRadius="md" spacing={3}>
                        <Badge colorScheme="orange" variant="subtle">{mw.name}</Badge>
                        <Text fontSize="sm" color={subtextColor}>{mw.description}</Text>
                      </HStack>
                    ))}
                  </VStack>
                ) : (
                  <Text fontSize="sm" color={subtextColor}>No global middleware documented.</Text>
                )}
              </Box>

              {/* Per-route middleware */}
              <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
                <Heading size="sm" mb={3}>Per-Route Middleware</Heading>
                {specs.middleware?.perRoute && specs.middleware.perRoute.length > 0 ? (
                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Middleware</Th>
                        <Th>Applies To</Th>
                        <Th>Description</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {specs.middleware.perRoute.map((mw, idx) => (
                        <Tr key={idx}>
                          <Td><Badge colorScheme="orange" variant="subtle">{mw.name}</Badge></Td>
                          <Td>
                            <Wrap spacing={1}>
                              {(mw.appliesTo || []).map((route, rIdx) => (
                                <WrapItem key={rIdx}>
                                  <Code fontSize="xs">{route}</Code>
                                </WrapItem>
                              ))}
                            </Wrap>
                          </Td>
                          <Td fontSize="sm" color={subtextColor}>{mw.description}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                ) : (
                  <Text fontSize="sm" color={subtextColor}>No per-route middleware documented.</Text>
                )}
              </Box>
            </VStack>
          </TabPanel>

          {/* ── End-to-End Flows Tab ────────────────────────────────── */}
          <TabPanel px={0}>
            {specs.flows && specs.flows.length > 0 ? (
              <VStack spacing={4} align="stretch">
                {specs.flows.map((flow, fIdx) => (
                  <Box key={fIdx} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
                    <HStack spacing={2} mb={3}>
                      <GitBranch size={16} />
                      <Heading size="sm">{flow.name}</Heading>
                    </HStack>
                    {flow.description && (
                      <Text fontSize="sm" color={subtextColor} mb={3}>{flow.description}</Text>
                    )}
                    <VStack spacing={2} align="stretch">
                      {flow.steps.map((step, sIdx) => (
                        <HStack
                          key={sIdx}
                          spacing={3}
                          p={2}
                          bg={codeBg}
                          borderRadius="md"
                          align="start"
                        >
                          <Badge
                            minW="24px"
                            textAlign="center"
                            colorScheme="gray"
                            variant="solid"
                            fontSize="xs"
                          >
                            {step.stepNumber}
                          </Badge>
                          <Badge
                            colorScheme={LAYER_COLORS[step.layer] || 'gray'}
                            variant="subtle"
                            fontSize="xs"
                            minW="80px"
                            textAlign="center"
                          >
                            {step.layer}
                          </Badge>
                          <VStack spacing={0} align="start" flex={1}>
                            <Text fontSize="sm">{step.action}</Text>
                            {step.filePath && (
                              <Code fontSize="xs" color={subtextColor}>{step.filePath}</Code>
                            )}
                          </VStack>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Box p={4} bg={codeBg} borderRadius="md">
                <Text fontSize="sm" color={subtextColor}>No end-to-end flows documented yet.</Text>
              </Box>
            )}
          </TabPanel>

          {/* ── Full Stack Audit Tab ─────────────────────────────────── */}
          <TabPanel px={0}>
            {specs.audit?.mismatches && specs.audit.mismatches.length > 0 ? (
              <VStack spacing={3} align="stretch">
                {specs.audit.mismatches.map((mismatch, idx) => (
                  <Box
                    key={idx}
                    bg={cardBg}
                    border="1px solid"
                    borderColor={borderColor}
                    borderLeft="4px solid"
                    borderLeftColor={`${SEVERITY_COLORS[mismatch.severity] || 'gray'}.400`}
                    borderRadius="lg"
                    p={4}
                  >
                    <HStack spacing={2} mb={2}>
                      <Badge colorScheme={SEVERITY_COLORS[mismatch.severity] || 'gray'} fontSize="xs">
                        {mismatch.severity}
                      </Badge>
                      <Tag size="sm" variant="subtle">{mismatch.type}</Tag>
                    </HStack>
                    <Text fontSize="sm" mb={2}>{mismatch.description}</Text>
                    {(mismatch.frontend || mismatch.backend) && (
                      <HStack spacing={4} fontSize="xs" color={subtextColor}>
                        {mismatch.frontend && <Text>Frontend: <Code fontSize="xs">{mismatch.frontend}</Code></Text>}
                        {mismatch.backend && <Text>Backend: <Code fontSize="xs">{mismatch.backend}</Code></Text>}
                      </HStack>
                    )}
                    {mismatch.suggestion && (
                      <Text fontSize="xs" color="blue.400" mt={2}>{mismatch.suggestion}</Text>
                    )}
                  </Box>
                ))}
              </VStack>
            ) : (
              <Box p={4} bg={codeBg} borderRadius="md">
                <VStack spacing={2}>
                  <AlertTriangle size={20} />
                  <Text fontSize="sm" color={subtextColor}>No integration mismatches detected.</Text>
                </VStack>
              </Box>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
    </VStack>
  );
}
