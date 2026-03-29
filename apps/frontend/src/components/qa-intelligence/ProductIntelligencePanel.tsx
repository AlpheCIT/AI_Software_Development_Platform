/**
 * ProductIntelligencePanel - Displays PM roadmap, research insights, and combined priorities
 * Shows the Product Manager's feature recommendations and Research Assistant's trend analysis
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
  TabPanels,
  Tab,
  TabPanel,
  useColorModeValue,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Progress,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Tag,
  TagLabel,
  Wrap,
  WrapItem,
  Divider,
  Flex,
  Heading,
  Spinner,
  Alert,
  AlertIcon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tooltip,
  Icon,
} from '@chakra-ui/react';
import {
  Briefcase,
  TrendingUp,
  Target,
  Shield,
  Users,
  Zap,
  Crown,
  Star,
  AlertTriangle,
  ExternalLink,
  Lightbulb,
  Crosshair,
  Flame,
} from 'lucide-react';

interface ProductIntelligencePanelProps {
  runId: string | null;
}

interface ProductData {
  roadmap: any;
  research: any;
  priorities: any[];
  summary: {
    appDomain: string;
    totalFeatures: number;
    criticalGaps: number;
    gameChangerTrends: number;
    monopolyStrategies: number;
    combinedPriorities: number;
  };
}

const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || '';

const IMPACT_COLORS: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'green',
};

const EFFORT_COLORS: Record<string, string> = {
  XS: 'green',
  S: 'green',
  M: 'yellow',
  L: 'orange',
  XL: 'red',
};

const RELEVANCE_COLORS: Record<string, string> = {
  'game-changer': 'red',
  significant: 'orange',
  'nice-to-have': 'blue',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
};

const ProductIntelligencePanel: React.FC<ProductIntelligencePanelProps> = ({ runId }) => {
  const [data, setData] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const res = await fetch(`${QA_ENGINE_URL}/qa/product/${runId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Product intelligence not yet available. The PM and Research agents may still be running.');
            return;
          }
          throw new Error('Failed to fetch');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Failed to load product intelligence');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Poll every 10s while waiting for results
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [runId]);

  if (!runId) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6}>
        <VStack spacing={3}>
          <Icon as={Briefcase} boxSize={8} color={subtextColor} />
          <Text color={subtextColor}>Start a QA run to see Product Intelligence insights</Text>
        </VStack>
      </Box>
    );
  }

  if (loading && !data) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6} textAlign="center">
        <Spinner size="lg" color="brand.500" />
        <Text mt={3} color={subtextColor}>Product Manager and Research Assistant are analyzing...</Text>
      </Box>
    );
  }

  if (error && !data) {
    return (
      <Alert status="info" borderRadius="lg">
        <AlertIcon />
        <Text>{error}</Text>
      </Alert>
    );
  }

  if (!data) return null;

  const { roadmap, research, priorities, summary } = data;

  return (
    <VStack spacing={4} align="stretch">
      {/* Summary Stats */}
      <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={3}>
        <Stat bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Domain</StatLabel>
          <StatNumber fontSize="sm">{summary.appDomain?.substring(0, 30)}</StatNumber>
        </Stat>
        <Stat bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Features Found</StatLabel>
          <StatNumber>{summary.totalFeatures}</StatNumber>
        </Stat>
        <Stat bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Critical Gaps</StatLabel>
          <StatNumber color="red.500">{summary.criticalGaps}</StatNumber>
        </Stat>
        <Stat bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Game-Changers</StatLabel>
          <StatNumber color="orange.500">{summary.gameChangerTrends}</StatNumber>
          <StatHelpText fontSize="xs">trends</StatHelpText>
        </Stat>
        <Stat bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Moat Strategies</StatLabel>
          <StatNumber color="purple.500">{summary.monopolyStrategies}</StatNumber>
        </Stat>
        <Stat bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
          <StatLabel fontSize="xs">Combined Priorities</StatLabel>
          <StatNumber>{summary.combinedPriorities}</StatNumber>
        </Stat>
      </SimpleGrid>

      {/* Main Tabs */}
      <Tabs variant="enclosed" colorScheme="blue">
        <TabList>
          <Tab><HStack spacing={1}><Icon as={Crown} boxSize={4} /><Text>Priorities</Text></HStack></Tab>
          <Tab><HStack spacing={1}><Icon as={Briefcase} boxSize={4} /><Text>Roadmap</Text></HStack></Tab>
          <Tab><HStack spacing={1}><Icon as={TrendingUp} boxSize={4} /><Text>Trends</Text></HStack></Tab>
          <Tab><HStack spacing={1}><Icon as={Crosshair} boxSize={4} /><Text>Competitors</Text></HStack></Tab>
          <Tab><HStack spacing={1}><Icon as={Shield} boxSize={4} /><Text>Moat</Text></HStack></Tab>
          <Tab><HStack spacing={1}><Icon as={Users} boxSize={4} /><Text>Personas</Text></HStack></Tab>
        </TabList>

        <TabPanels>
          {/* Combined Priorities */}
          <TabPanel px={0}>
            <VStack spacing={2} align="stretch">
              {priorities.map((p: any, i: number) => (
                <Box
                  key={i}
                  bg={cardBg}
                  border="1px solid"
                  borderColor={p.monopolyPotential ? 'purple.300' : borderColor}
                  borderRadius="md"
                  p={3}
                  _hover={{ bg: hoverBg }}
                >
                  <HStack justify="space-between" mb={1}>
                    <HStack spacing={2}>
                      <Badge colorScheme="gray" fontSize="xs">#{p.rank}</Badge>
                      {p.monopolyPotential && (
                        <Tooltip label="Has monopoly potential">
                          <Badge colorScheme="purple" fontSize="xs"><Icon as={Crown} boxSize={3} mr={1} />MOAT</Badge>
                        </Tooltip>
                      )}
                      <Text fontWeight="bold" fontSize="sm">{p.title}</Text>
                    </HStack>
                    <HStack spacing={1}>
                      <Badge colorScheme={IMPACT_COLORS[p.impact] || 'gray'} fontSize="xs">{p.impact}</Badge>
                      <Badge colorScheme={EFFORT_COLORS[p.effort] || 'gray'} fontSize="xs">{p.effort}</Badge>
                      <Badge variant="outline" fontSize="xs">{p.source}</Badge>
                    </HStack>
                  </HStack>
                  <Text fontSize="xs" color={subtextColor}>{p.description}</Text>
                </Box>
              ))}
            </VStack>
          </TabPanel>

          {/* PM Roadmap */}
          <TabPanel px={0}>
            {roadmap && (
              <VStack spacing={4} align="stretch">
                {/* Strengths & Gaps */}
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
                    <Heading size="sm" mb={2} color="green.500">Current Strengths</Heading>
                    {roadmap.currentStrengths?.map((s: string, i: number) => (
                      <HStack key={i} spacing={2} mb={1}>
                        <Icon as={Star} boxSize={3} color="green.400" />
                        <Text fontSize="sm">{s}</Text>
                      </HStack>
                    ))}
                  </Box>
                  <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
                    <Heading size="sm" mb={2} color="red.500">Critical Gaps</Heading>
                    {roadmap.criticalGaps?.map((g: string, i: number) => (
                      <HStack key={i} spacing={2} mb={1}>
                        <Icon as={AlertTriangle} boxSize={3} color="red.400" />
                        <Text fontSize="sm">{g}</Text>
                      </HStack>
                    ))}
                  </Box>
                </SimpleGrid>

                {/* Roadmap Sections */}
                {['immediate', 'shortTerm', 'mediumTerm', 'longTerm'].map(phase => {
                  const features = roadmap.roadmap?.[phase] || [];
                  if (features.length === 0) return null;
                  const labels: Record<string, string> = {
                    immediate: 'Immediate (Do Now)',
                    shortTerm: 'Short Term (1-3 months)',
                    mediumTerm: 'Medium Term (3-6 months)',
                    longTerm: 'Long Term (6-12 months)',
                  };
                  return (
                    <Box key={phase}>
                      <Heading size="sm" mb={2}>{labels[phase]}</Heading>
                      <Accordion allowMultiple>
                        {features.map((f: any, i: number) => (
                          <AccordionItem key={i} border="1px solid" borderColor={borderColor} borderRadius="md" mb={1}>
                            <AccordionButton>
                              <HStack flex="1" spacing={2}>
                                <Badge colorScheme={IMPACT_COLORS[f.userImpact] || 'gray'}>{f.userImpact}</Badge>
                                <Badge colorScheme={EFFORT_COLORS[f.effort] || 'gray'}>{f.effort}</Badge>
                                <Text fontWeight="semibold" fontSize="sm">{f.title}</Text>
                              </HStack>
                              <AccordionIcon />
                            </AccordionButton>
                            <AccordionPanel pb={3} fontSize="sm">
                              <Text mb={2}>{f.description}</Text>
                              <Text color={subtextColor} mb={1}><strong>Revenue signal:</strong> {f.revenueSignal}</Text>
                              <Text color={subtextColor} mb={1}><strong>Implementation:</strong> {f.implementationNotes}</Text>
                              {f.acceptanceCriteria?.length > 0 && (
                                <>
                                  <Text fontWeight="semibold" mt={2} mb={1}>Acceptance Criteria:</Text>
                                  {f.acceptanceCriteria.map((c: string, j: number) => (
                                    <Text key={j} fontSize="xs" color={subtextColor} ml={2}>- {c}</Text>
                                  ))}
                                </>
                              )}
                            </AccordionPanel>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </Box>
                  );
                })}
              </VStack>
            )}
          </TabPanel>

          {/* Research Trends */}
          <TabPanel px={0}>
            {research && (
              <VStack spacing={3} align="stretch">
                {/* Domain Analysis */}
                <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
                  <Heading size="sm" mb={2}>Market Analysis</Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                    <Text fontSize="sm"><strong>Industry:</strong> {research.domainAnalysis?.industry}</Text>
                    <Text fontSize="sm"><strong>Market:</strong> {research.domainAnalysis?.marketSize}</Text>
                    <Text fontSize="sm"><strong>Direction:</strong> {research.domainAnalysis?.growthDirection}</Text>
                    <Wrap>
                      {research.domainAnalysis?.keyDrivers?.map((d: string, i: number) => (
                        <WrapItem key={i}><Tag size="sm" colorScheme="blue"><TagLabel>{d}</TagLabel></Tag></WrapItem>
                      ))}
                    </Wrap>
                  </SimpleGrid>
                </Box>

                {/* Trend Cards */}
                {research.trendInsights?.map((t: any, i: number) => (
                  <Box
                    key={i}
                    bg={cardBg}
                    border="1px solid"
                    borderColor={t.relevance === 'game-changer' ? 'orange.300' : borderColor}
                    borderRadius="md"
                    p={3}
                  >
                    <HStack justify="space-between" mb={1}>
                      <HStack spacing={2}>
                        {t.relevance === 'game-changer' && <Icon as={Flame} boxSize={4} color="orange.400" />}
                        <Text fontWeight="bold" fontSize="sm">{t.trend}</Text>
                      </HStack>
                      <HStack spacing={1}>
                        <Badge colorScheme={RELEVANCE_COLORS[t.relevance] || 'gray'}>{t.relevance}</Badge>
                        <Badge variant="outline">{t.category}</Badge>
                        <Badge colorScheme={EFFORT_COLORS[t.effort] || 'gray'}>{t.effort}</Badge>
                      </HStack>
                    </HStack>
                    <Text fontSize="xs" color={subtextColor} mb={1}>{t.description}</Text>
                    <Text fontSize="xs"><strong>How to implement:</strong> {t.implementationPath}</Text>
                    {t.examples?.length > 0 && (
                      <Text fontSize="xs" color={subtextColor} mt={1}>Examples: {t.examples.join(', ')}</Text>
                    )}
                  </Box>
                ))}
              </VStack>
            )}
          </TabPanel>

          {/* Competitor Intel */}
          <TabPanel px={0}>
            {research?.competitorIntel?.map((c: any, i: number) => (
              <Box key={i} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4} mb={3}>
                <HStack justify="space-between" mb={2}>
                  <Heading size="sm">{c.competitor}</Heading>
                  <Badge colorScheme={c.threatLevel === 'high' ? 'red' : c.threatLevel === 'medium' ? 'orange' : 'green'}>
                    {c.threatLevel} threat
                  </Badge>
                </HStack>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                  <Box>
                    <Text fontSize="xs" fontWeight="bold" color="green.500" mb={1}>Strengths</Text>
                    {c.strengths?.map((s: string, j: number) => (
                      <Text key={j} fontSize="xs">+ {s}</Text>
                    ))}
                  </Box>
                  <Box>
                    <Text fontSize="xs" fontWeight="bold" color="red.500" mb={1}>Weaknesses</Text>
                    {c.weaknesses?.map((w: string, j: number) => (
                      <Text key={j} fontSize="xs">- {w}</Text>
                    ))}
                  </Box>
                  <Box>
                    <Text fontSize="xs" fontWeight="bold" color="blue.500" mb={1}>Recent Moves</Text>
                    {c.recentMoves?.map((m: string, j: number) => (
                      <Text key={j} fontSize="xs">{m}</Text>
                    ))}
                  </Box>
                </SimpleGrid>
              </Box>
            ))}
          </TabPanel>

          {/* Monopoly Strategies */}
          <TabPanel px={0}>
            {research?.monopolyStrategies?.map((s: any, i: number) => (
              <Box key={i} bg={cardBg} border="1px solid" borderColor="purple.200" borderRadius="lg" p={4} mb={3}>
                <HStack justify="space-between" mb={2}>
                  <HStack spacing={2}>
                    <Icon as={Shield} boxSize={4} color="purple.400" />
                    <Heading size="sm">{s.strategy}</Heading>
                  </HStack>
                  <HStack spacing={1}>
                    <Badge colorScheme="purple">{s.type}</Badge>
                    <Badge colorScheme={s.feasibility === 'high' ? 'green' : 'orange'}>{s.feasibility}</Badge>
                  </HStack>
                </HStack>
                <Text fontSize="sm" mb={2}>{s.description}</Text>
                <Text fontSize="xs" color={subtextColor}><strong>Implementation:</strong> {s.implementation}</Text>
              </Box>
            ))}
          </TabPanel>

          {/* User Personas */}
          <TabPanel px={0}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
              {roadmap?.userPersonas?.map((p: any, i: number) => (
                <Box key={i} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
                  <HStack spacing={2} mb={2}>
                    <Icon as={Users} boxSize={4} color="blue.400" />
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="bold" fontSize="sm">{p.name}</Text>
                      <Text fontSize="xs" color={subtextColor}>{p.role}</Text>
                    </VStack>
                  </HStack>
                  <Box mb={2}>
                    <Text fontSize="xs" fontWeight="bold" color="red.400" mb={1}>Pain Points</Text>
                    {p.painPoints?.map((pp: string, j: number) => (
                      <Text key={j} fontSize="xs">- {pp}</Text>
                    ))}
                  </Box>
                  <Box>
                    <Text fontSize="xs" fontWeight="bold" color="green.400" mb={1}>Desired Outcomes</Text>
                    {p.desiredOutcomes?.map((d: string, j: number) => (
                      <Text key={j} fontSize="xs">+ {d}</Text>
                    ))}
                  </Box>
                </Box>
              ))}
            </SimpleGrid>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </VStack>
  );
};

export default ProductIntelligencePanel;
