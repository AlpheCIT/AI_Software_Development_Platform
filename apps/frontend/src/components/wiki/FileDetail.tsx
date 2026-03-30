/**
 * FileDetail - Right pane detail view for a selected file in the Repo Wiki
 *
 * Shows file metadata, entities table, test coverage, code smells,
 * documentation status, and missing-docs warnings.
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Icon,
  Alert,
  AlertIcon,
  Tag,
  useColorModeValue,
  Divider,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Heading,
  Spinner,
  Collapse,
} from '@chakra-ui/react';
import {
  FileCode,
  AlertTriangle,
  CheckCircle,
  Book,
  Code,
  Shield,
  Eye,
  GitBranch,
} from 'lucide-react';
import type { WikiFile, WikiEntity } from '../../hooks/useRepoWiki';

// ── Types ──────────────────────────────────────────────────────────────────

interface FileDetailProps {
  file: WikiFile;
  entities: WikiEntity[];
  testCount: number;
}

// ── Language badge color ───────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  typescript: 'blue',
  javascript: 'yellow',
  python: 'green',
  java: 'orange',
  csharp: 'purple',
  go: 'cyan',
  rust: 'red',
  ruby: 'red',
  php: 'purple',
  vue: 'green',
  svelte: 'orange',
  json: 'gray',
  yaml: 'gray',
  markdown: 'gray',
};

// ── Entity type badge ──────────────────────────────────────────────────────

const ENTITY_COLORS: Record<string, string> = {
  function: 'blue',
  class: 'purple',
  interface: 'teal',
  type: 'cyan',
  enum: 'orange',
  method: 'green',
};

// ── Risk label ─────────────────────────────────────────────────────────────

function riskLabel(score: number): { text: string; color: string } {
  if (score >= 60) return { text: 'High Risk', color: 'red' };
  if (score >= 30) return { text: 'Medium Risk', color: 'yellow' };
  return { text: 'Low Risk', color: 'green' };
}

// ── Severity badge ─────────────────────────────────────────────────────────

function severityColor(sev: string): string {
  if (sev === 'error') return 'red';
  if (sev === 'warning') return 'orange';
  return 'gray';
}

const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || '';

// ── Behavior data types ───────────────────────────────────────────────────

interface FileBehavior {
  description?: string;
  gherkinScenarios?: string[];
  flows?: Array<{ name: string; stepCount: number }>;
}

// ── Component ──────────────────────────────────────────────────────────────

const FileDetail: React.FC<FileDetailProps> = ({ file, entities, testCount }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const codeBg = useColorModeValue('gray.50', 'gray.900');

  // ── Behavioral data for this file ────────────────────────────────────
  const [behavior, setBehavior] = useState<FileBehavior | null>(null);
  const [behaviorLoading, setBehaviorLoading] = useState(false);

  useEffect(() => {
    if (!QA_ENGINE_URL) {
      setBehavior(null);
      setBehaviorLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function loadFileBehavior() {
      setBehaviorLoading(true);
      setBehavior(null);
      try {
        // Find latest completed run
        const runsRes = await fetch(`${QA_ENGINE_URL}/qa/runs`, { signal: controller.signal });
        if (!runsRes.ok || cancelled) { setBehaviorLoading(false); return; }
        const runsData = await runsRes.json();
        const completed = (runsData.runs || []).filter((r: any) => r.status === 'completed');
        if (!completed[0] || cancelled) { setBehaviorLoading(false); return; }
        const runId = completed[0]._key || completed[0].runId;

        // Skip behavioral-specs (404), go directly to product endpoint
        const response = await fetch(`${QA_ENGINE_URL}/qa/product/${runId}`, { signal: controller.signal });
        if (!response.ok || cancelled) { if (!cancelled) setBehaviorLoading(false); return; }

        const data = await response.json();
        if (cancelled) return;
        const specs = data.behavioralSpecs || data.specs || data;
        const filePath = file.path.toLowerCase();

        // Extract behavior relevant to this file
        const result: FileBehavior = {};

        // Check frontend screens
        for (const screen of specs.frontend?.screens || []) {
          if (screen.path?.toLowerCase().includes(filePath) || filePath.includes(screen.path?.toLowerCase() || '')) {
            result.description = screen.description || `Screen: ${screen.name} with ${screen.elements?.length || 0} interactive elements`;
            const scenarios = (screen.elements || []).map(
              (el: any) => `Scenario: User interacts with ${el.name}\n  Given the user is on "${screen.name}"\n  Then they see "${el.name}" (${el.type})`
            );
            if (scenarios.length > 0) result.gherkinScenarios = scenarios;
            break;
          }
        }

        // Check backend routes
        if (!result.description) {
          for (const rf of specs.backend?.routes || []) {
            if (rf.filePath?.toLowerCase().includes(filePath) || filePath.includes(rf.filePath?.toLowerCase() || '')) {
              result.description = `Route handler with ${rf.endpoints?.length || 0} endpoints`;
              break;
            }
          }
        }

        // Find flows this file participates in
        const matchingFlows = (specs.flows || []).filter((flow: any) =>
          flow.steps?.some((step: any) => step.filePath?.toLowerCase().includes(filePath))
        );
        if (matchingFlows.length > 0) {
          result.flows = matchingFlows.map((f: any) => ({ name: f.name, stepCount: f.steps?.length || 0 }));
        }

        if (!cancelled && (result.description || result.gherkinScenarios || result.flows)) {
          setBehavior(result);
        }
      } catch { /* ignore errors silently */ }
      finally { if (!cancelled) setBehaviorLoading(false); }
    }

    loadFileBehavior();
    return () => { cancelled = true; controller.abort(); };
  }, [file.path]);

  const risk = riskLabel(file.riskScore);
  const langColor = LANG_COLORS[file.language] || 'gray';

  // Generate a "What this file does" summary from entity names
  const fileSummary = useMemo(() => {
    if (entities.length === 0) return 'No code entities detected in this file.';

    const classes = entities.filter((e) => e.type === 'class');
    const functions = entities.filter((e) => e.type === 'function');
    const interfaces = entities.filter((e) => e.type === 'interface');
    const types = entities.filter((e) => e.type === 'type');

    const parts: string[] = [];
    if (classes.length > 0) {
      parts.push(
        `Defines ${classes.length} class${classes.length > 1 ? 'es' : ''}: ${classes
          .slice(0, 5)
          .map((c) => c.name)
          .join(', ')}${classes.length > 5 ? '...' : ''}`,
      );
    }
    if (interfaces.length > 0) {
      parts.push(
        `${interfaces.length} interface${interfaces.length > 1 ? 's' : ''}: ${interfaces
          .slice(0, 5)
          .map((i) => i.name)
          .join(', ')}${interfaces.length > 5 ? '...' : ''}`,
      );
    }
    if (types.length > 0) {
      parts.push(
        `${types.length} type alias${types.length > 1 ? 'es' : ''}: ${types
          .slice(0, 5)
          .map((t) => t.name)
          .join(', ')}${types.length > 5 ? '...' : ''}`,
      );
    }
    if (functions.length > 0) {
      parts.push(
        `${functions.length} function${functions.length > 1 ? 's' : ''}: ${functions
          .slice(0, 5)
          .map((f) => f.name)
          .join(', ')}${functions.length > 5 ? '...' : ''}`,
      );
    }

    return parts.join('. ') + '.';
  }, [entities]);

  return (
    <VStack spacing={4} align="stretch" p={4} overflowY="auto" h="100%">
      {/* Header */}
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
        <HStack spacing={3} mb={2}>
          <Icon as={FileCode} boxSize={5} color={`${langColor}.500`} />
          <Text fontSize="lg" fontWeight="bold" wordBreak="break-all">
            {file.path}
          </Text>
        </HStack>
        <HStack spacing={2} flexWrap="wrap">
          <Badge colorScheme={langColor} variant="subtle">
            {file.language}
          </Badge>
          <Badge colorScheme={risk.color} variant="subtle">
            {risk.text} ({file.riskScore})
          </Badge>
          {file.hasDocumentation && (
            <Badge colorScheme="green" variant="subtle">
              Documented
            </Badge>
          )}
          {file.lineCount > 0 && (
            <Text fontSize="xs" color={subtextColor}>
              ~{file.lineCount} lines
            </Text>
          )}
        </HStack>
      </Box>

      {/* Stats row */}
      <SimpleGrid columns={4} spacing={3}>
        <Stat size="sm" bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Entities</StatLabel>
          <StatNumber fontSize="lg">{file.entityCount}</StatNumber>
          <StatHelpText fontSize="xs" mb={0}>
            {entities.filter((e) => e.type === 'function').length} functions
          </StatHelpText>
        </Stat>
        <Stat size="sm" bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Tests</StatLabel>
          <StatNumber fontSize="lg" color={testCount > 0 ? 'green.500' : 'red.400'}>
            {testCount}
          </StatNumber>
          <StatHelpText fontSize="xs" mb={0}>
            {testCount > 0 ? 'covered' : 'no tests'}
          </StatHelpText>
        </Stat>
        <Stat size="sm" bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Smells</StatLabel>
          <StatNumber fontSize="lg" color={file.smells.length > 0 ? 'orange.500' : 'green.500'}>
            {file.smells.length}
          </StatNumber>
          <StatHelpText fontSize="xs" mb={0}>
            code issues
          </StatHelpText>
        </Stat>
        <Stat size="sm" bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Risk</StatLabel>
          <StatNumber fontSize="lg" color={`${risk.color}.500`}>
            {file.riskScore}
          </StatNumber>
          <StatHelpText fontSize="xs" mb={0}>
            /100
          </StatHelpText>
        </Stat>
      </SimpleGrid>

      {/* Missing docs warning */}
      {file.entityCount >= 3 && !file.hasDocumentation && (
        <Alert status="warning" borderRadius="md" fontSize="sm">
          <AlertIcon />
          This file has {file.entityCount} entities but no documentation indicators.
          Consider adding JSDoc comments or a module-level description.
        </Alert>
      )}

      {/* What this file does */}
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
        <HStack spacing={2} mb={2}>
          <Icon as={Book} boxSize={4} color="blue.400" />
          <Heading size="sm">What this file does</Heading>
        </HStack>
        <Text fontSize="sm" color={subtextColor}>
          {fileSummary}
        </Text>
      </Box>

      {/* Behavior section */}
      {behaviorLoading && (
        <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
          <HStack spacing={2}>
            <Spinner size="sm" />
            <Text fontSize="sm" color={subtextColor}>Loading behavioral data...</Text>
          </HStack>
        </Box>
      )}
      {!behaviorLoading && behavior && (
        <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
          <HStack spacing={2} mb={3}>
            <Icon as={Eye} boxSize={4} color="purple.400" />
            <Heading size="sm">Behavior</Heading>
          </HStack>

          {/* User-facing description */}
          {behavior.description && (
            <Text fontSize="sm" color={subtextColor} mb={3}>
              {behavior.description}
            </Text>
          )}

          {/* Gherkin scenarios */}
          {behavior.gherkinScenarios && behavior.gherkinScenarios.length > 0 && (
            <Box mb={3}>
              <Text fontSize="xs" fontWeight="bold" mb={1}>Gherkin Scenarios</Text>
              <VStack spacing={1} align="stretch">
                {behavior.gherkinScenarios.slice(0, 5).map((scenario, idx) => (
                  <Box
                    key={idx}
                    p={2}
                    bg={codeBg}
                    borderRadius="md"
                    fontFamily="mono"
                    fontSize="xs"
                    whiteSpace="pre-wrap"
                  >
                    {scenario}
                  </Box>
                ))}
                {behavior.gherkinScenarios.length > 5 && (
                  <Text fontSize="xs" color={subtextColor}>
                    +{behavior.gherkinScenarios.length - 5} more scenarios
                  </Text>
                )}
              </VStack>
            </Box>
          )}

          {/* End-to-end flows */}
          {behavior.flows && behavior.flows.length > 0 && (
            <Box>
              <Text fontSize="xs" fontWeight="bold" mb={1}>End-to-End Flows</Text>
              <VStack spacing={1} align="stretch">
                {behavior.flows.map((flow, idx) => (
                  <HStack key={idx} spacing={2} p={2} bg={codeBg} borderRadius="md">
                    <Icon as={GitBranch} boxSize={3} color="purple.400" />
                    <Text fontSize="sm" fontWeight="medium">{flow.name}</Text>
                    <Badge colorScheme="purple" fontSize="2xs">{flow.stepCount} steps</Badge>
                  </HStack>
                ))}
              </VStack>
            </Box>
          )}
        </Box>
      )}

      {/* Entities table */}
      {entities.length > 0 && (
        <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
          <HStack spacing={2} mb={3}>
            <Icon as={Code} boxSize={4} color="purple.400" />
            <Heading size="sm">Entities ({entities.length})</Heading>
          </HStack>
          <Box overflowX="auto" maxH="300px" overflowY="auto">
            <Table size="sm" variant="simple">
              <Thead position="sticky" top={0} bg={cardBg} zIndex={1}>
                <Tr>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Signature</Th>
                </Tr>
              </Thead>
              <Tbody>
                {entities.map((entity, idx) => (
                  <Tr key={`${entity.name}-${entity.type}-${idx}`}>
                    <Td fontWeight="medium" fontSize="sm">
                      {entity.name}
                    </Td>
                    <Td>
                      <Tag
                        size="sm"
                        colorScheme={ENTITY_COLORS[entity.type] || 'gray'}
                        variant="subtle"
                      >
                        {entity.type}
                      </Tag>
                    </Td>
                    <Td>
                      {entity.signature ? (
                        <Text
                          fontSize="xs"
                          fontFamily="mono"
                          bg={codeBg}
                          px={2}
                          py={1}
                          borderRadius="md"
                          isTruncated
                          maxW="400px"
                          title={entity.signature}
                        >
                          {entity.signature}
                        </Text>
                      ) : (
                        <Text fontSize="xs" color={subtextColor}>
                          --
                        </Text>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
      )}

      {/* Test Coverage */}
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
        <HStack spacing={2} mb={2}>
          <Icon as={Shield} boxSize={4} color="green.400" />
          <Heading size="sm">Test Coverage</Heading>
        </HStack>
        {testCount > 0 ? (
          <HStack spacing={2}>
            <Icon as={CheckCircle} boxSize={4} color="green.500" />
            <Text fontSize="sm">
              {testCount} test{testCount > 1 ? 's' : ''} target this file
            </Text>
          </HStack>
        ) : (
          <HStack spacing={2}>
            <Icon as={AlertTriangle} boxSize={4} color="yellow.500" />
            <Text fontSize="sm" color={subtextColor}>
              No tests found targeting this file
            </Text>
          </HStack>
        )}
      </Box>

      {/* Code Smells */}
      {file.smells.length > 0 && (
        <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
          <HStack spacing={2} mb={3}>
            <Icon as={AlertTriangle} boxSize={4} color="orange.400" />
            <Heading size="sm">Code Smells ({file.smells.length})</Heading>
          </HStack>
          <VStack spacing={2} align="stretch">
            {file.smells.map((smell, idx) => (
              <HStack
                key={idx}
                spacing={2}
                p={2}
                bg={codeBg}
                borderRadius="md"
                fontSize="sm"
              >
                <Badge colorScheme={severityColor(smell.severity)} size="sm" flexShrink={0}>
                  {smell.severity}
                </Badge>
                <Text flex={1}>{smell.message}</Text>
                {smell.line > 0 && (
                  <Text fontSize="xs" color={subtextColor} flexShrink={0}>
                    L{smell.line}
                  </Text>
                )}
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      {/* Documentation Status */}
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
        <HStack spacing={2} mb={2}>
          <Icon as={Book} boxSize={4} color="teal.400" />
          <Heading size="sm">Documentation Status</Heading>
        </HStack>
        <VStack spacing={1} align="start">
          <HStack spacing={2}>
            <Text fontSize="sm" fontWeight="medium" w="140px">
              Has documentation:
            </Text>
            {file.hasDocumentation ? (
              <HStack spacing={1}>
                <Icon as={CheckCircle} boxSize={4} color="green.500" />
                <Text fontSize="sm" color="green.500">
                  Yes
                </Text>
              </HStack>
            ) : (
              <HStack spacing={1}>
                <Icon as={AlertTriangle} boxSize={4} color="yellow.500" />
                <Text fontSize="sm" color="yellow.500">
                  No
                </Text>
              </HStack>
            )}
          </HStack>
          <HStack spacing={2}>
            <Text fontSize="sm" fontWeight="medium" w="140px">
              TODOs found:
            </Text>
            <Text fontSize="sm">
              {file.smells.filter(
                (s) =>
                  s.type === 'todo' ||
                  s.type === 'TODO' ||
                  s.message.toLowerCase().includes('todo'),
              ).length}
            </Text>
          </HStack>
        </VStack>
      </Box>
    </VStack>
  );
};

export default FileDetail;
