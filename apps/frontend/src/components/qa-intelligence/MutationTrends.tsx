/**
 * MutationTrends - Charts showing mutation score trends over time
 * Pulls real run history from ArangoDB via the qa-engine API
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  useColorModeValue,
  Spinner,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import { TrendingUp, Activity, Target } from 'lucide-react';

const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || '';

interface RunSummary {
  runId: string;
  mutationScore: number;
  testsGenerated: number;
  testsExecuted: number;
  testsPassed: number;
  testsFailed: number;
  iterations: number;
  startedAt: string;
  completedAt: string;
}

interface TrendData {
  runs: RunSummary[];
  averageScore: number;
  bestScore: number;
  trend: 'improving' | 'declining' | 'stable';
  improvementRate: number;
}

const THRESHOLD = 80;

const MutationTrends: React.FC = () => {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const gridColor = useColorModeValue('#E2E8F0', '#4A5568');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${QA_ENGINE_URL}/qa/runs`);
        if (!res.ok) throw new Error('Failed to fetch runs');
        const json = await res.json();
        const runs: RunSummary[] = (json.runs || [])
          .filter((r: any) => r.status === 'completed' && r.mutationScore != null)
          .sort((a: any, b: any) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

        if (runs.length === 0) {
          setData(null);
          return;
        }

        const scores = runs.map(r => r.mutationScore);
        const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const bestScore = Math.max(...scores);

        // Calculate trend
        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        let improvementRate = 0;
        if (runs.length >= 2) {
          const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
          const secondHalf = scores.slice(Math.floor(scores.length / 2));
          const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
          improvementRate = Math.round(secondAvg - firstAvg);
          trend = improvementRate > 2 ? 'improving' : improvementRate < -2 ? 'declining' : 'stable';
        }

        setData({ runs, averageScore, bestScore, trend, improvementRate });
      } catch (err) {
        console.error('Failed to load mutation trends:', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6} textAlign="center">
        <Spinner size="lg" color="brand.500" />
        <Text mt={3} color={subtextColor}>Loading mutation trends...</Text>
      </Box>
    );
  }

  if (!data || data.runs.length === 0) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6} textAlign="center">
        <VStack spacing={3}>
          <TrendingUp size={24} color="#718096" />
          <Text color={subtextColor}>No completed QA runs yet. Run a QA analysis to see mutation trends.</Text>
        </VStack>
      </Box>
    );
  }

  // Prepare chart data
  const scoreData = data.runs.map((r, i) => ({
    run: `Run ${i + 1}`,
    runId: ((r as any)._key || (r as any).runId || `run-${i}`).substring(0, 8),
    score: r.mutationScore,
    threshold: THRESHOLD,
    date: new Date(r.startedAt).toLocaleDateString(),
    tests: r.testsGenerated,
    passed: r.testsPassed,
    failed: r.testsFailed,
    iterations: r.iterations,
  }));

  const testData = data.runs.map((r, i) => ({
    run: `Run ${i + 1}`,
    generated: r.testsGenerated,
    executed: r.testsExecuted,
    passed: r.testsPassed,
    failed: r.testsFailed,
  }));

  const iterationData = data.runs.map((r, i) => ({
    run: `Run ${i + 1}`,
    iterations: r.iterations,
    score: r.mutationScore,
  }));

  const trendColor = data.trend === 'improving' ? 'green' : data.trend === 'declining' ? 'red' : 'gray';

  return (
    <VStack spacing={4} align="stretch">
      {/* Summary Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        <Stat bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Avg Score</StatLabel>
          <StatNumber fontSize="lg" color={data.averageScore >= THRESHOLD ? 'green.500' : 'orange.500'}>
            {data.averageScore}%
          </StatNumber>
          <StatHelpText fontSize="xs">target: {THRESHOLD}%</StatHelpText>
        </Stat>
        <Stat bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Best Score</StatLabel>
          <StatNumber fontSize="lg" color="green.500">{data.bestScore}%</StatNumber>
        </Stat>
        <Stat bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Trend</StatLabel>
          <StatNumber fontSize="lg">
            <HStack spacing={1}>
              <StatArrow type={data.trend === 'declining' ? 'decrease' : 'increase'} />
              <Text color={`${trendColor}.500`}>{data.trend}</Text>
            </HStack>
          </StatNumber>
          <StatHelpText fontSize="xs">{data.improvementRate > 0 ? '+' : ''}{data.improvementRate}% change</StatHelpText>
        </Stat>
        <Stat bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Total Runs</StatLabel>
          <StatNumber fontSize="lg">{data.runs.length}</StatNumber>
        </Stat>
      </SimpleGrid>

      {/* Charts */}
      <Tabs variant="soft-rounded" colorScheme="blue" size="sm">
        <TabList>
          <Tab>Score Trend</Tab>
          <Tab>Test Volume</Tab>
          <Tab>Iterations</Tab>
        </TabList>

        <TabPanels>
          {/* Mutation Score Trend */}
          <TabPanel px={0}>
            <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4} h="280px">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scoreData}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#805AD5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#805AD5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="run" fontSize={11} />
                  <YAxis domain={[0, 100]} fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: '#1A202C', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                    formatter={(value: number) => [`${value}%`, 'Mutation Score']}
                  />
                  <ReferenceLine y={THRESHOLD} stroke="#38A169" strokeDasharray="5 5" label={{ value: `Target ${THRESHOLD}%`, position: 'right', fontSize: 10, fill: '#38A169' }} />
                  <Area type="monotone" dataKey="score" stroke="#805AD5" strokeWidth={2} fill="url(#scoreGradient)" dot={{ fill: '#805AD5', r: 4 }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </TabPanel>

          {/* Test Volume */}
          <TabPanel px={0}>
            <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4} h="280px">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={testData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="run" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: '#1A202C', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                  />
                  <Legend fontSize={11} />
                  <Bar dataKey="generated" name="Generated" fill="#805AD5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="passed" name="Passed" fill="#38A169" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="#E53E3E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </TabPanel>

          {/* Iterations per Run */}
          <TabPanel px={0}>
            <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4} h="280px">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={iterationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="run" fontSize={11} />
                  <YAxis yAxisId="left" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: '#1A202C', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                  />
                  <Legend fontSize={11} />
                  <Bar yAxisId="left" dataKey="iterations" name="Iterations" fill="#DD6B20" radius={[4, 4, 0, 0]}>
                    {iterationData.map((entry, i) => (
                      <Cell key={i} fill={entry.iterations >= 3 ? '#E53E3E' : entry.iterations >= 2 ? '#DD6B20' : '#38A169'} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="score" name="Score %" stroke="#805AD5" strokeWidth={2} dot={{ r: 4 }} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </VStack>
  );
};

export default MutationTrends;
