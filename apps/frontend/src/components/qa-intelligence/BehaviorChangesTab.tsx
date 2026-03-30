/**
 * BehaviorChangesTab - Shows behavioral changes between QA runs
 *
 * Displays new, changed, and removed behaviors with diff-style presentation,
 * commit range header, and regression risk warnings.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
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
  Divider,
  Tag,
  Collapse,
  Button,
} from '@chakra-ui/react';
import {
  GitCommit,
  Plus,
  Minus,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || '';

// ── Types ──────────────────────────────────────────────────────────────────

interface BehaviorChange {
  component: string;
  filePath?: string;
  description: string;
  gherkinScenario?: string;
}

interface ChangedBehavior {
  component: string;
  filePath?: string;
  changeType: 'modified' | 'refactored' | 'renamed';
  before: string;
  after: string;
  description?: string;
}

interface RemovedBehavior {
  component: string;
  filePath?: string;
  description: string;
  removedAt?: string;
}

interface RegressionRisk {
  severity: 'high' | 'medium' | 'low';
  description: string;
  affectedFlows?: string[];
  suggestion?: string;
}

interface BehaviorChangesData {
  commitRange?: {
    from: string;
    to: string;
    fromDate?: string;
    toDate?: string;
  };
  summary?: {
    newCount: number;
    changedCount: number;
    removedCount: number;
    unchangedCount: number;
  };
  newBehaviors: BehaviorChange[];
  changedBehaviors: ChangedBehavior[];
  removedBehaviors: RemovedBehavior[];
  regressionRisks: RegressionRisk[];
}

interface BehaviorChangesTabProps {
  runId?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function BehaviorChangesTab({ runId }: BehaviorChangesTabProps) {
  const [changes, setChanges] = useState<BehaviorChangesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNew, setExpandedNew] = useState<Set<number>>(new Set());
  const [expandedChanged, setExpandedChanged] = useState<Set<number>>(new Set());

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const codeBg = useColorModeValue('gray.50', 'gray.900');

  useEffect(() => {
    if (!QA_ENGINE_URL) {
      setChanges(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function loadChanges() {
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
              if (completed[0]) {
                effectiveRunId = completed[0]._key || completed[0].runId;
              }
            }
          } catch { /* ignore */ }
        }

        if (!effectiveRunId || cancelled) {
          if (!cancelled) setChanges(null);
          return;
        }

        // behavioral-changes endpoint does not exist yet - show info message instead of 404 loop
        if (!cancelled) {
          setError('No behavioral changes data available. Run two analyses to see diffs.');
        }
      } catch {
        if (!cancelled) setError('Failed to load behavioral changes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadChanges();
    return () => { cancelled = true; controller.abort(); };
  }, [runId]);

  function toggleNew(idx: number) {
    setExpandedNew(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function toggleChanged(idx: number) {
    setExpandedChanged(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={8} textAlign="center">
        <VStack spacing={3}>
          <Spinner size="lg" color="blue.500" />
          <Text fontSize="sm" color={subtextColor}>Loading behavioral changes...</Text>
        </VStack>
      </Box>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <Alert status="info" borderRadius="lg">
        <AlertIcon />
        <Text fontSize="sm">{error}</Text>
      </Alert>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────

  if (!changes) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6}>
        <VStack spacing={3}>
          <GitCommit size={24} />
          <Text fontWeight="bold">No Changes Detected</Text>
          <Text fontSize="sm" color={subtextColor} textAlign="center" maxW="400px">
            Run two QA analyses on different commits to see behavioral changes between versions.
          </Text>
        </VStack>
      </Box>
    );
  }

  const summary = changes.summary || {
    newCount: changes.newBehaviors?.length || 0,
    changedCount: changes.changedBehaviors?.length || 0,
    removedCount: changes.removedBehaviors?.length || 0,
    unchangedCount: 0,
  };

  return (
    <VStack spacing={4} align="stretch">
      {/* Commit range header */}
      {changes.commitRange && (
        <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
          <HStack spacing={2}>
            <GitCommit size={16} />
            <Text fontSize="sm" fontWeight="medium">
              Changes from{' '}
              <Code fontSize="sm">{changes.commitRange.from.slice(0, 7)}</Code>
              {' '}&rarr;{' '}
              <Code fontSize="sm">{changes.commitRange.to.slice(0, 7)}</Code>
            </Text>
          </HStack>
          {(changes.commitRange.fromDate || changes.commitRange.toDate) && (
            <Text fontSize="xs" color={subtextColor} mt={1} ml={6}>
              {changes.commitRange.fromDate && new Date(changes.commitRange.fromDate).toLocaleDateString()}
              {changes.commitRange.fromDate && changes.commitRange.toDate && ' \u2192 '}
              {changes.commitRange.toDate && new Date(changes.commitRange.toDate).toLocaleDateString()}
            </Text>
          )}
        </Box>
      )}

      {/* Summary stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        <Stat size="sm" bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs" color="green.500">New</StatLabel>
          <StatNumber fontSize="xl" color="green.500">{summary.newCount}</StatNumber>
        </Stat>
        <Stat size="sm" bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs" color="yellow.500">Changed</StatLabel>
          <StatNumber fontSize="xl" color="yellow.500">{summary.changedCount}</StatNumber>
        </Stat>
        <Stat size="sm" bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs" color="red.500">Removed</StatLabel>
          <StatNumber fontSize="xl" color="red.500">{summary.removedCount}</StatNumber>
        </Stat>
        <Stat size="sm" bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs" color={subtextColor}>Unchanged</StatLabel>
          <StatNumber fontSize="xl">{summary.unchangedCount}</StatNumber>
        </Stat>
      </SimpleGrid>

      {/* Regression risks */}
      {changes.regressionRisks && changes.regressionRisks.length > 0 && (
        <VStack spacing={2} align="stretch">
          <Heading size="sm" color="red.400">
            <HStack spacing={2}>
              <AlertTriangle size={16} />
              <Text>Regression Risks ({changes.regressionRisks.length})</Text>
            </HStack>
          </Heading>
          {changes.regressionRisks.map((risk, idx) => (
            <Alert
              key={idx}
              status="error"
              borderRadius="md"
              variant="left-accent"
              fontSize="sm"
            >
              <AlertIcon />
              <VStack align="start" spacing={1} flex={1}>
                <HStack spacing={2}>
                  <Badge colorScheme={risk.severity === 'high' ? 'red' : risk.severity === 'medium' ? 'orange' : 'yellow'} fontSize="2xs">
                    {risk.severity}
                  </Badge>
                  <Text fontSize="sm">{risk.description}</Text>
                </HStack>
                {risk.affectedFlows && risk.affectedFlows.length > 0 && (
                  <HStack spacing={1} flexWrap="wrap">
                    <Text fontSize="xs" color={subtextColor}>Affects:</Text>
                    {risk.affectedFlows.map((flow, fIdx) => (
                      <Tag key={fIdx} size="sm" variant="subtle" colorScheme="red">{flow}</Tag>
                    ))}
                  </HStack>
                )}
                {risk.suggestion && (
                  <Text fontSize="xs" color="blue.400">{risk.suggestion}</Text>
                )}
              </VStack>
            </Alert>
          ))}
        </VStack>
      )}

      {/* New behaviors */}
      {changes.newBehaviors && changes.newBehaviors.length > 0 && (
        <VStack spacing={2} align="stretch">
          <Heading size="sm">
            <HStack spacing={2}>
              <Plus size={16} />
              <Text>New Behaviors ({changes.newBehaviors.length})</Text>
            </HStack>
          </Heading>
          {changes.newBehaviors.map((behavior, idx) => (
            <Box
              key={idx}
              bg={cardBg}
              border="1px solid"
              borderColor={borderColor}
              borderLeft="4px solid"
              borderLeftColor="green.400"
              borderRadius="lg"
              p={4}
              cursor="pointer"
              onClick={() => toggleNew(idx)}
            >
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Text fontWeight="medium" fontSize="sm">{behavior.component}</Text>
                  {behavior.filePath && <Code fontSize="xs">{behavior.filePath}</Code>}
                </HStack>
                {expandedNew.has(idx) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </HStack>
              <Text fontSize="sm" color={subtextColor} mt={1}>{behavior.description}</Text>
              <Collapse in={expandedNew.has(idx)} animateOpacity>
                {behavior.gherkinScenario && (
                  <Box mt={3} p={3} bg={codeBg} borderRadius="md" fontFamily="mono" fontSize="xs" whiteSpace="pre-wrap">
                    {behavior.gherkinScenario}
                  </Box>
                )}
              </Collapse>
            </Box>
          ))}
        </VStack>
      )}

      {/* Changed behaviors */}
      {changes.changedBehaviors && changes.changedBehaviors.length > 0 && (
        <VStack spacing={2} align="stretch">
          <Heading size="sm">
            <HStack spacing={2}>
              <RefreshCw size={16} />
              <Text>Changed Behaviors ({changes.changedBehaviors.length})</Text>
            </HStack>
          </Heading>
          {changes.changedBehaviors.map((change, idx) => (
            <Box
              key={idx}
              bg={cardBg}
              border="1px solid"
              borderColor={borderColor}
              borderLeft="4px solid"
              borderLeftColor="yellow.400"
              borderRadius="lg"
              p={4}
              cursor="pointer"
              onClick={() => toggleChanged(idx)}
            >
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Text fontWeight="medium" fontSize="sm">{change.component}</Text>
                  <Badge colorScheme="yellow" fontSize="2xs">{change.changeType}</Badge>
                  {change.filePath && <Code fontSize="xs">{change.filePath}</Code>}
                </HStack>
                {expandedChanged.has(idx) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </HStack>
              {change.description && (
                <Text fontSize="sm" color={subtextColor} mt={1}>{change.description}</Text>
              )}
              <Collapse in={expandedChanged.has(idx)} animateOpacity>
                <VStack spacing={2} mt={3} align="stretch">
                  <Box p={2} bg="red.50" _dark={{ bg: 'red.900' }} borderRadius="md" borderLeft="3px solid" borderLeftColor="red.400">
                    <Text fontSize="xs" fontWeight="bold" color="red.500" mb={1}>Before</Text>
                    <Text fontSize="xs" fontFamily="mono" whiteSpace="pre-wrap">{change.before}</Text>
                  </Box>
                  <Box p={2} bg="green.50" _dark={{ bg: 'green.900' }} borderRadius="md" borderLeft="3px solid" borderLeftColor="green.400">
                    <Text fontSize="xs" fontWeight="bold" color="green.500" mb={1}>After</Text>
                    <Text fontSize="xs" fontFamily="mono" whiteSpace="pre-wrap">{change.after}</Text>
                  </Box>
                </VStack>
              </Collapse>
            </Box>
          ))}
        </VStack>
      )}

      {/* Removed behaviors */}
      {changes.removedBehaviors && changes.removedBehaviors.length > 0 && (
        <VStack spacing={2} align="stretch">
          <Heading size="sm">
            <HStack spacing={2}>
              <Minus size={16} />
              <Text>Removed Behaviors ({changes.removedBehaviors.length})</Text>
            </HStack>
          </Heading>
          {changes.removedBehaviors.map((removed, idx) => (
            <Box
              key={idx}
              bg={cardBg}
              border="1px solid"
              borderColor={borderColor}
              borderLeft="4px solid"
              borderLeftColor="red.400"
              borderRadius="lg"
              p={4}
              opacity={0.8}
            >
              <HStack spacing={2}>
                <Text fontWeight="medium" fontSize="sm" textDecoration="line-through">{removed.component}</Text>
                {removed.filePath && <Code fontSize="xs">{removed.filePath}</Code>}
              </HStack>
              <Text fontSize="sm" color={subtextColor} mt={1}>{removed.description}</Text>
              {removed.removedAt && (
                <Text fontSize="xs" color={subtextColor} mt={1}>
                  Removed: {new Date(removed.removedAt).toLocaleString()}
                </Text>
              )}
            </Box>
          ))}
        </VStack>
      )}
    </VStack>
  );
}
