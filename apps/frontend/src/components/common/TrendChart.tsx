/**
 * TrendChart — Shows health score trends across QA runs for a repository.
 * Displays a simple bar chart with improving/declining indicator.
 * All data comes from real QA runs stored in ArangoDB.
 */
import React, { useEffect, useState } from 'react';
import {
  Box, Text, VStack, HStack, Badge, Tooltip, SimpleGrid,
  Stat, StatLabel, StatNumber, StatHelpText, StatArrow,
  useColorModeValue, Spinner,
} from '@chakra-ui/react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendPoint {
  runId: string;
  date: string;
  healthScore: number;
  testsGenerated: number;
  testsPassed: number;
  mutationScore: number;
  grade: string;
  commitSha?: string;
  commitMessage?: string;
}

interface TrendChartProps {
  repositoryId: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({ repositoryId }) => {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const barBg = useColorModeValue('gray.100', 'gray.700');

  useEffect(() => {
    const loadTrends = async () => {
      setLoading(true);
      try {
        let repoId = repositoryId;
        // If no repositoryId provided, get it from the latest run
        if (!repoId) {
          const runsRes = await fetch('/qa/runs?limit=1');
          const runsData = await runsRes.json();
          const latestRun = (runsData.runs || runsData)?.[0];
          if (latestRun) repoId = latestRun.repositoryId;
        }
        if (!repoId) { setData([]); return; }
        const res = await fetch(`/qa/trends/${encodeURIComponent(repoId)}`);
        const d = await res.json();
        setData(d.runs || []);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    loadTrends();
  }, [repositoryId]);

  if (loading) {
    return (
      <Box bg={bg} p={6} borderRadius="lg" border="1px solid" borderColor={borderColor} textAlign="center">
        <Spinner size="sm" mr={2} /> Loading trends...
      </Box>
    );
  }

  if (data.length < 2) {
    return (
      <Box bg={bg} p={6} borderRadius="lg" border="1px solid" borderColor={borderColor} textAlign="center">
        <Text color="gray.500" fontSize="sm">
          {data.length === 0
            ? 'No completed runs yet. Start a QA run to begin tracking trends.'
            : 'Run QA at least twice to see trends. One run completed so far.'}
        </Text>
      </Box>
    );
  }

  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  const healthDelta = latest.healthScore - previous.healthScore;
  const testsDelta = latest.testsGenerated - previous.testsGenerated;
  const mutationDelta = latest.mutationScore - previous.mutationScore;
  const improving = healthDelta > 0;
  const maxHealth = Math.max(...data.map(d => d.healthScore || 0), 100);

  return (
    <Box bg={bg} p={4} borderRadius="lg" border="1px solid" borderColor={borderColor}>
      <HStack mb={4} justify="space-between">
        <HStack spacing={2}>
          <Text fontWeight="bold" fontSize="sm">Health Score Trend</Text>
          <Badge
            colorScheme={healthDelta > 0 ? 'green' : healthDelta < 0 ? 'red' : 'gray'}
            fontSize="2xs"
          >
            <HStack spacing={1}>
              {healthDelta > 0 ? <TrendingUp size={10} /> : healthDelta < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
              <Text>{healthDelta > 0 ? 'Improving' : healthDelta < 0 ? 'Declining' : 'Stable'}</Text>
            </HStack>
          </Badge>
        </HStack>
        <Text fontSize="xs" color="gray.500">{data.length} runs</Text>
      </HStack>

      {/* Bar chart */}
      <HStack spacing={1} align="end" h="80px" mb={4}>
        {data.map((point, i) => {
          const barHeight = Math.max(4, (point.healthScore / maxHealth) * 80);
          const isLatest = i === data.length - 1;
          return (
            <Tooltip
              key={point.runId}
              label={`${point.grade} (${point.healthScore}/100) — ${point.testsGenerated} tests, ${point.mutationScore}% mutation\n${new Date(point.date).toLocaleDateString()}`}
              fontSize="xs"
              hasArrow
            >
              <Box
                flex={1}
                bg={
                  point.healthScore >= 70 ? 'green.400'
                  : point.healthScore >= 40 ? 'yellow.400'
                  : 'red.400'
                }
                h={`${barHeight}px`}
                borderRadius="sm"
                opacity={isLatest ? 1 : 0.7}
                border={isLatest ? '2px solid' : 'none'}
                borderColor={isLatest ? 'blue.400' : 'transparent'}
                transition="all 0.2s"
                _hover={{ opacity: 1, transform: 'scaleY(1.1)' }}
              />
            </Tooltip>
          );
        })}
      </HStack>

      {/* Date labels for first and last */}
      <HStack justify="space-between" mb={4}>
        <Text fontSize="2xs" color="gray.400">
          {new Date(data[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
        <Text fontSize="2xs" color="gray.400">
          {new Date(data[data.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
      </HStack>

      {/* Summary stats */}
      <SimpleGrid columns={3} spacing={3}>
        <Stat size="sm">
          <StatLabel fontSize="2xs">Health</StatLabel>
          <StatNumber fontSize="sm">{latest.grade} ({latest.healthScore})</StatNumber>
          <StatHelpText fontSize="2xs">
            <StatArrow type={healthDelta >= 0 ? 'increase' : 'decrease'} />
            {Math.abs(healthDelta)} pts
          </StatHelpText>
        </Stat>
        <Stat size="sm">
          <StatLabel fontSize="2xs">Tests</StatLabel>
          <StatNumber fontSize="sm">{latest.testsGenerated}</StatNumber>
          <StatHelpText fontSize="2xs">
            <StatArrow type={testsDelta >= 0 ? 'increase' : 'decrease'} />
            {Math.abs(testsDelta)}
          </StatHelpText>
        </Stat>
        <Stat size="sm">
          <StatLabel fontSize="2xs">Mutation</StatLabel>
          <StatNumber fontSize="sm">{latest.mutationScore}%</StatNumber>
          <StatHelpText fontSize="2xs">
            <StatArrow type={mutationDelta >= 0 ? 'increase' : 'decrease'} />
            {Math.abs(mutationDelta)}%
          </StatHelpText>
        </Stat>
      </SimpleGrid>
    </Box>
  );
};
