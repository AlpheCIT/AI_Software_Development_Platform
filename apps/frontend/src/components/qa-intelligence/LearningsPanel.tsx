/**
 * LearningsPanel - Shows accumulated AI learnings and bug archetypes
 * The "AI learns over time" demo feature — patterns discovered across runs
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Spinner,
  Divider,
  Progress,
  Code,
  Tag,
  Wrap,
  WrapItem,
  useColorModeValue,
} from '@chakra-ui/react';
import { Brain, Bug, TrendingUp, Lightbulb, Shield, AlertTriangle } from 'lucide-react';



interface Learning {
  type: string;
  category: string;
  description: string;
  frequency: number;
  confidence: number;
  sourceAgents: string[];
  affectedFiles: string[];
  firstSeen: string;
  lastSeen: string;
  runCount: number;
}

interface BugArchetype {
  name: string;
  category: string;
  description: string;
  pattern: string;
  occurrences: number;
  severity: string;
  suggestedFix: string;
  affectedFiles: string[];
  runCount: number;
}

interface LearningsPanelProps {
  repositoryId?: string;
}

export default function LearningsPanel({ repositoryId }: LearningsPanelProps) {
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [archetypes, setArchetypes] = useState<BugArchetype[]>([]);
  const [loading, setLoading] = useState(false);

  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const cardBg = useColorModeValue('gray.50', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  const severityColor: Record<string, string> = { high: 'red', medium: 'orange', low: 'green' };
  const typeIcon: Record<string, React.ReactNode> = {
    pattern: <TrendingUp size={14} />,
    insight: <Lightbulb size={14} />,
    recommendation: <Shield size={14} />,
  };

  useEffect(() => {
    loadData();
  }, [repositoryId]);

  async function loadData() {
    setLoading(true);
    try {
      let effectiveId = repositoryId;

      // If no repositoryId provided, fetch the latest completed run
      if (!effectiveId) {
        try {
          const runsRes = await fetch(`/qa/runs`);
          if (runsRes.ok) {
            const runsData = await runsRes.json();
            const completedRuns = (runsData.runs || []).filter((r: any) => r.status === 'completed');
            const latestRun = completedRuns[0];
            if (latestRun) {
              effectiveId = latestRun._key || latestRun.runId;
            }
          }
        } catch { /* ignore */ }
      }

      if (!effectiveId) {
        setLoading(false);
        return;
      }

      const res = await fetch(`/qa/learnings/${effectiveId}`);
      if (res.ok) {
        const data = await res.json();
        setLearnings(data.learnings || []);
        setArchetypes(data.archetypes || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  if (loading) {
    return <Box p={6} textAlign="center"><Spinner size="lg" /><Text mt={2} color={subtextColor}>Loading learnings...</Text></Box>;
  }

  const hasData = learnings.length > 0 || archetypes.length > 0;

  if (!hasData) {
    return (
      <Box p={6} textAlign="center" border="2px dashed" borderColor="gray.300" borderRadius="lg">
        <Brain size={32} style={{ margin: '0 auto 12px' }} />
        <Text fontWeight="bold" color="gray.600" mb={2}>No Learnings Yet</Text>
        <Text fontSize="sm" color="gray.500">
          Complete a QA run to start building AI learnings. Patterns accumulate across multiple runs,
          helping the platform get smarter about your codebase over time.
        </Text>
      </Box>
    );
  }

  const totalRuns = Math.max(...learnings.map(l => l.runCount || 1), ...archetypes.map(a => a.runCount || 1), 1);

  return (
    <Box bg={bg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
      {/* Header */}
      <HStack mb={4} spacing={3}>
        <Brain size={20} />
        <Text fontSize="lg" fontWeight="bold">AI Learnings</Text>
        <Badge colorScheme="purple">{learnings.length + archetypes.length} patterns</Badge>
        <Badge colorScheme="blue" variant="outline">Across {totalRuns} run{totalRuns > 1 ? 's' : ''}</Badge>
      </HStack>

      {/* Summary Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={4}>
        <Stat size="sm">
          <StatLabel fontSize="xs">Patterns Found</StatLabel>
          <StatNumber color="purple.500">{learnings.filter(l => l.type === 'pattern').length}</StatNumber>
          <StatHelpText fontSize="2xs">Recurring code smells</StatHelpText>
        </Stat>
        <Stat size="sm">
          <StatLabel fontSize="xs">Insights</StatLabel>
          <StatNumber color="blue.500">{learnings.filter(l => l.type === 'insight').length}</StatNumber>
          <StatHelpText fontSize="2xs">Test quality gaps</StatHelpText>
        </Stat>
        <Stat size="sm">
          <StatLabel fontSize="xs">Bug Archetypes</StatLabel>
          <StatNumber color="red.500">{archetypes.length}</StatNumber>
          <StatHelpText fontSize="2xs">Mutation survival patterns</StatHelpText>
        </Stat>
        <Stat size="sm">
          <StatLabel fontSize="xs">High Severity</StatLabel>
          <StatNumber color="orange.500">{archetypes.filter(a => a.severity === 'high').length}</StatNumber>
          <StatHelpText fontSize="2xs">Need immediate attention</StatHelpText>
        </Stat>
      </SimpleGrid>

      <Divider mb={4} />

      {/* Learnings Section */}
      {learnings.length > 0 && (
        <Box mb={4}>
          <HStack mb={2}>
            <TrendingUp size={16} />
            <Text fontWeight="bold" fontSize="sm">Learned Patterns</Text>
          </HStack>
          <VStack spacing={2} align="stretch">
            {learnings.slice(0, 10).map((learning, i) => (
              <Box key={i} p={3} bg={cardBg} borderRadius="md" borderLeft="3px solid" borderLeftColor={
                learning.type === 'pattern' ? 'purple.400' : learning.type === 'insight' ? 'blue.400' : 'green.400'
              }>
                <HStack justify="space-between" mb={1}>
                  <HStack spacing={2}>
                    {typeIcon[learning.type] || <TrendingUp size={14} />}
                    <Badge colorScheme={learning.type === 'pattern' ? 'purple' : learning.type === 'insight' ? 'blue' : 'green'} fontSize="2xs">
                      {learning.type}
                    </Badge>
                    <Badge colorScheme="gray" fontSize="2xs">{learning.category}</Badge>
                  </HStack>
                  <HStack spacing={1}>
                    <Text fontSize="2xs" color={subtextColor}>Seen {learning.frequency}x</Text>
                    <Progress value={learning.confidence * 100} size="xs" colorScheme="green" w="40px" borderRadius="full" />
                  </HStack>
                </HStack>
                <Text fontSize="xs">{learning.description}</Text>
                {learning.affectedFiles.length > 0 && (
                  <Wrap mt={1} spacing={1}>
                    {learning.affectedFiles.slice(0, 3).map((f, j) => (
                      <WrapItem key={j}><Tag size="sm" fontSize="2xs" colorScheme="gray">{f.split('/').pop()}</Tag></WrapItem>
                    ))}
                    {learning.affectedFiles.length > 3 && <WrapItem><Tag size="sm" fontSize="2xs">+{learning.affectedFiles.length - 3} more</Tag></WrapItem>}
                  </Wrap>
                )}
              </Box>
            ))}
          </VStack>
        </Box>
      )}

      {/* Bug Archetypes Section */}
      {archetypes.length > 0 && (
        <Box>
          <HStack mb={2}>
            <Bug size={16} />
            <Text fontWeight="bold" fontSize="sm">Bug Archetypes</Text>
            <Badge colorScheme="red" fontSize="2xs">{archetypes.filter(a => a.severity === 'high').length} high severity</Badge>
          </HStack>
          <VStack spacing={2} align="stretch">
            {archetypes.slice(0, 8).map((archetype, i) => (
              <Box key={i} p={3} bg={cardBg} borderRadius="md" borderLeft="3px solid" borderLeftColor={`${severityColor[archetype.severity] || 'gray'}.400`}>
                <HStack justify="space-between" mb={1}>
                  <HStack spacing={2}>
                    <AlertTriangle size={14} />
                    <Text fontSize="xs" fontWeight="bold">{archetype.name}</Text>
                    <Badge colorScheme={severityColor[archetype.severity]} fontSize="2xs">{archetype.severity}</Badge>
                  </HStack>
                  <Text fontSize="2xs" color={subtextColor}>{archetype.occurrences} occurrences</Text>
                </HStack>
                <Text fontSize="xs" color={subtextColor} mb={1}>{archetype.description}</Text>
                {archetype.pattern && (
                  <Code fontSize="2xs" p={1} borderRadius="sm" display="block" mb={1}>{archetype.pattern}</Code>
                )}
                <Text fontSize="2xs" color="green.500">Fix: {archetype.suggestedFix}</Text>
              </Box>
            ))}
          </VStack>
        </Box>
      )}
    </Box>
  );
}
