/**
 * ActionCenter - Role-aware dashboard for QA Intelligence
 * Shows different views for Developers, PMs, and Executives
 * Fetches data from the QA Engine product endpoint and renders actionable insights
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
  Card,
  CardBody,
  CardHeader,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Progress,
  Divider,
  Tag,
  Tooltip,
  Icon,
  ButtonGroup,
  Button,
  useColorModeValue,
  Spinner,
  Alert,
  AlertIcon,
  Heading,
  Wrap,
  WrapItem,
  Flex,
} from '@chakra-ui/react';
import {
  Code,
  Briefcase,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Shield,
  TrendingUp,
  Crown,
  Star,
  Target,
  Zap,
  FileCode,
  Bug,
  Trash2,
} from 'lucide-react';
import ActionItem from './ActionItem';
import ActionableSummary from './ActionableSummary';
import CodeHealthGauge from './CodeHealthGauge';

// ── Types ────────────────────────────────────────────────────────────────────

type Role = 'developer' | 'pm' | 'executive';

interface ActionCenterProps {
  runId: string | null;
}

interface ProductData {
  roadmap: any;
  research: any;
  codeQuality: any;
  priorities: any[];
  summary: {
    appDomain: string;
    totalFeatures: number;
    criticalGaps: number;
    gameChangerTrends: number;
    monopolyStrategies: number;
    combinedPriorities: number;
    codeHealthScore?: number;
    codeHealthGrade?: string;
    totalFindings?: number;
  };
}

const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || 'http://localhost:3005';

// ── Color Maps ───────────────────────────────────────────────────────────────

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
  low: 'green',
  medium: 'yellow',
  high: 'red',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
};

const FEASIBILITY_COLORS: Record<string, string> = {
  high: 'green',
  medium: 'yellow',
  low: 'red',
};

// ── Helper: count findings by severity ───────────────────────────────────────

function countBySeverity(codeQuality: any): Record<string, number> {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const allItems = [
    ...(codeQuality?.codeSmells || []),
    ...(codeQuality?.architectureIssues || []),
    ...(codeQuality?.bestPracticeViolations || []),
  ];
  for (const item of allItems) {
    const sev = (item.severity || 'medium').toLowerCase();
    if (counts[sev] !== undefined) counts[sev]++;
  }
  return counts;
}

// ── Helper: get confidence indicator ─────────────────────────────────────────

function getConfidence(score: number): { label: string; color: string; colorScheme: string } {
  if (score >= 80) return { label: 'Strong', color: 'green.500', colorScheme: 'green' };
  if (score >= 60) return { label: 'Needs Attention', color: 'yellow.500', colorScheme: 'yellow' };
  return { label: 'At Risk', color: 'red.500', colorScheme: 'red' };
}

// ── Developer View ───────────────────────────────────────────────────────────

const DeveloperView: React.FC<{ data: ProductData }> = ({ data }) => {
  const { codeQuality } = data;
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  if (!codeQuality) {
    return (
      <Alert status="info" borderRadius="lg">
        <AlertIcon />
        <Text>Code quality analysis not yet available. The Code Quality Architect agent may still be running.</Text>
      </Alert>
    );
  }

  const overallHealth = codeQuality.overallHealth || {};
  const quickWins = codeQuality.refactoringRoadmap?.quickWins || [];
  const criticalSmells = (codeQuality.codeSmells || []).filter(
    (s: any) => s.severity === 'critical' || s.severity === 'high'
  );
  const deadCode = codeQuality.deadCode || [];
  const duplicationHotspots = codeQuality.duplicationHotspots || [];
  const consolidationOpps = codeQuality.consolidationOpportunities || [];

  // Merge quick wins and critical smells for top actions
  const topActions = [
    ...quickWins.map((w: any) => ({ ...w, _source: 'quickWin' })),
    ...criticalSmells.map((s: any) => ({ ...s, _source: 'codeSmell' })),
  ].slice(0, 10);

  return (
    <VStack spacing={4} align="stretch">
      {/* Action Items */}
      <Box>
        <HStack spacing={2} mb={3}>
          <Icon as={Zap} boxSize={5} color="orange.400" />
          <Heading size="md">Action Items</Heading>
          <Badge colorScheme="orange" fontSize="xs">{topActions.length}</Badge>
        </HStack>
        <VStack spacing={2} align="stretch">
          {topActions.map((item: any, i: number) => (
            <ActionItem
              key={i}
              title={item.title || item.name || item.smell || `Finding #${i + 1}`}
              description={item.description || item.suggestion || item.message || ''}
              filePath={item.filePath || item.file || item.location}
              effort={item.effort}
              impact={item.impact}
              technique={item.technique || item.refactoring}
              severity={item.severity}
              before={item.before || item.codeExample}
              after={item.after || item.suggestedFix}
            />
          ))}
          {topActions.length === 0 && (
            <Text fontSize="sm" color={subtextColor} textAlign="center" py={4}>
              No action items found. Code quality looks good!
            </Text>
          )}
        </VStack>
      </Box>

      <Divider />

      {/* Code Health Gauge */}
      <Box>
        <HStack spacing={2} mb={3}>
          <Icon as={CheckCircle} boxSize={5} color="green.400" />
          <Heading size="md">Code Health</Heading>
        </HStack>
        <Flex justify="center" py={2}>
          <CodeHealthGauge
            score={overallHealth.score || 0}
            grade={overallHealth.grade || 'N/A'}
            summary={overallHealth.summary || 'No summary available'}
          />
        </Flex>
        {overallHealth.techDebtHours != null && (
          <Text fontSize="sm" color={subtextColor} textAlign="center" mt={2}>
            Estimated tech debt: {overallHealth.techDebtHours} hours
          </Text>
        )}
      </Box>

      <Divider />

      {/* Dead Code */}
      {deadCode.length > 0 && (
        <Box>
          <HStack spacing={2} mb={3}>
            <Icon as={Trash2} boxSize={5} color="gray.400" />
            <Heading size="md">Dead Code</Heading>
            <Badge colorScheme="gray" fontSize="xs">{deadCode.length}</Badge>
          </HStack>
          <VStack spacing={1} align="stretch">
            {deadCode.map((item: any, i: number) => (
              <HStack
                key={i}
                bg={cardBg}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="md"
                p={2}
                spacing={2}
              >
                <Icon as={FileCode} boxSize={4} color="gray.400" />
                <VStack align="start" spacing={0} flex={1}>
                  <Text fontSize="sm" fontWeight="medium">
                    {item.name || item.symbol || item.identifier || `Dead code #${i + 1}`}
                  </Text>
                  <Text fontSize="xs" color={subtextColor} fontFamily="mono">
                    {item.filePath || item.file || item.location || 'Unknown location'}
                  </Text>
                </VStack>
                <Text fontSize="xs" color={subtextColor}>
                  {item.type || item.kind || 'unused'}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      {/* Duplication Hotspots */}
      {duplicationHotspots.length > 0 && (
        <>
          <Divider />
          <Box>
            <HStack spacing={2} mb={3}>
              <Icon as={Bug} boxSize={5} color="orange.400" />
              <Heading size="md">Duplication Hotspots</Heading>
              <Badge colorScheme="orange" fontSize="xs">{duplicationHotspots.length}</Badge>
            </HStack>
            <VStack spacing={2} align="stretch">
              {duplicationHotspots.map((item: any, i: number) => (
                <Box
                  key={i}
                  bg={cardBg}
                  border="1px solid"
                  borderColor={borderColor}
                  borderRadius="md"
                  p={3}
                >
                  <Text fontSize="sm" fontWeight="medium" mb={1}>
                    {item.title || item.pattern || `Duplication #${i + 1}`}
                  </Text>
                  <Text fontSize="xs" color={subtextColor} mb={2}>
                    {item.description || `${item.instances || item.count || '?'} instances found`}
                  </Text>
                  {item.files && (
                    <Wrap spacing={1}>
                      {(Array.isArray(item.files) ? item.files : []).map((f: string, j: number) => (
                        <WrapItem key={j}>
                          <Tag size="sm" fontSize="2xs" fontFamily="mono">{f}</Tag>
                        </WrapItem>
                      ))}
                    </Wrap>
                  )}
                  {/* Consolidation recommendation */}
                  {consolidationOpps[i] && (
                    <Box mt={2} p={2} bg={useColorModeValue('blue.50', 'blue.900')} borderRadius="md">
                      <Text fontSize="xs" color="blue.500" fontWeight="semibold">
                        Recommendation: {consolidationOpps[i].recommendation || consolidationOpps[i].description || 'Consolidate into shared module'}
                      </Text>
                    </Box>
                  )}
                </Box>
              ))}
            </VStack>
          </Box>
        </>
      )}
    </VStack>
  );
};

// ── PM View ──────────────────────────────────────────────────────────────────

const PMView: React.FC<{ data: ProductData }> = ({ data }) => {
  const { roadmap, summary } = data;
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  if (!roadmap) {
    return (
      <Alert status="info" borderRadius="lg">
        <AlertIcon />
        <Text>Product roadmap not yet available. The PM agent may still be running.</Text>
      </Alert>
    );
  }

  const phases = [
    { key: 'immediate', label: 'Immediate (Do Now)', icon: Zap, color: 'red' },
    { key: 'shortTerm', label: 'Short Term (1-3 months)', icon: Target, color: 'orange' },
    { key: 'mediumTerm', label: 'Medium Term (3-6 months)', icon: TrendingUp, color: 'blue' },
    { key: 'longTerm', label: 'Long Term (6-12 months)', icon: Star, color: 'purple' },
  ];

  const competitiveAnalysis = roadmap.competitiveAnalysis;
  const userPersonas = roadmap.userPersonas || [];

  return (
    <VStack spacing={5} align="stretch">
      {/* Header */}
      <Box>
        <HStack spacing={2} mb={1}>
          <Icon as={Briefcase} boxSize={5} color="blue.400" />
          <Heading size="md">Product Roadmap</Heading>
        </HStack>
        {summary?.appDomain && (
          <Text fontSize="sm" color={subtextColor}>{summary.appDomain}</Text>
        )}
      </Box>

      {/* Roadmap Timeline */}
      {phases.map(({ key, label, icon: PhaseIcon, color }) => {
        const features = roadmap.roadmap?.[key] || [];
        if (features.length === 0) return null;
        return (
          <Box key={key}>
            <HStack spacing={2} mb={2}>
              <Icon as={PhaseIcon} boxSize={4} color={`${color}.400`} />
              <Heading size="sm" color={`${color}.500`}>{label}</Heading>
              <Badge colorScheme={color} fontSize="2xs">{features.length}</Badge>
            </HStack>
            <Accordion allowMultiple>
              {features.map((f: any, i: number) => (
                <AccordionItem
                  key={i}
                  border="1px solid"
                  borderColor={borderColor}
                  borderRadius="md"
                  mb={2}
                >
                  <AccordionButton _hover={{ bg: hoverBg }} borderRadius="md">
                    <HStack flex="1" spacing={2}>
                      {f.userImpact && (
                        <Badge colorScheme={IMPACT_COLORS[f.userImpact] || 'gray'} fontSize="2xs">
                          {f.userImpact} impact
                        </Badge>
                      )}
                      {f.effort && (
                        <Badge colorScheme={EFFORT_COLORS[f.effort] || 'gray'} fontSize="2xs">
                          {f.effort}
                        </Badge>
                      )}
                      <Text fontWeight="semibold" fontSize="sm" textAlign="left">
                        {f.title}
                      </Text>
                    </HStack>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel pb={3}>
                    <VStack align="stretch" spacing={2}>
                      <Text fontSize="sm">{f.description}</Text>

                      {f.revenueSignal && (
                        <HStack spacing={1}>
                          <Icon as={TrendingUp} boxSize={3} color="green.400" />
                          <Text fontSize="xs" color={subtextColor}>
                            <Text as="span" fontWeight="semibold">Revenue signal:</Text> {f.revenueSignal}
                          </Text>
                        </HStack>
                      )}

                      {f.competitiveAdvantage && (
                        <HStack spacing={1}>
                          <Icon as={Shield} boxSize={3} color="purple.400" />
                          <Text fontSize="xs" color={subtextColor}>
                            <Text as="span" fontWeight="semibold">Competitive advantage:</Text> {f.competitiveAdvantage}
                          </Text>
                        </HStack>
                      )}

                      {f.implementationNotes && (
                        <Text fontSize="xs" color={subtextColor}>
                          <Text as="span" fontWeight="semibold">Implementation:</Text> {f.implementationNotes}
                        </Text>
                      )}

                      {f.acceptanceCriteria?.length > 0 && (
                        <Box>
                          <Text fontSize="xs" fontWeight="semibold" mb={1}>Acceptance Criteria:</Text>
                          {f.acceptanceCriteria.map((c: string, j: number) => (
                            <HStack key={j} spacing={1} ml={2}>
                              <Icon as={CheckCircle} boxSize={3} color="green.400" />
                              <Text fontSize="xs" color={subtextColor}>{c}</Text>
                            </HStack>
                          ))}
                        </Box>
                      )}
                    </VStack>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </Box>
        );
      })}

      <Divider />

      {/* Competitive Position */}
      {competitiveAnalysis && (
        <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
          <CardHeader pb={2}>
            <HStack spacing={2}>
              <Icon as={Target} boxSize={5} color="purple.400" />
              <Heading size="sm">Competitive Position</Heading>
            </HStack>
          </CardHeader>
          <CardBody pt={0}>
            <VStack align="stretch" spacing={2}>
              {competitiveAnalysis.marketSegment && (
                <Text fontSize="sm">
                  <Text as="span" fontWeight="semibold">Market Segment:</Text> {competitiveAnalysis.marketSegment}
                </Text>
              )}
              {competitiveAnalysis.uniquePositioning && (
                <Text fontSize="sm">
                  <Text as="span" fontWeight="semibold">Unique Positioning:</Text> {competitiveAnalysis.uniquePositioning}
                </Text>
              )}
              {competitiveAnalysis.topCompetitor && (
                <Box p={2} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
                  <Text fontSize="xs" fontWeight="semibold" mb={1}>Top Competitor</Text>
                  <Text fontSize="sm">{competitiveAnalysis.topCompetitor.name || competitiveAnalysis.topCompetitor}</Text>
                  {competitiveAnalysis.topCompetitor.comparison && (
                    <Text fontSize="xs" color={subtextColor} mt={1}>{competitiveAnalysis.topCompetitor.comparison}</Text>
                  )}
                </Box>
              )}
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* User Personas */}
      {userPersonas.length > 0 && (
        <Box>
          <HStack spacing={2} mb={3}>
            <Icon as={Crown} boxSize={5} color="blue.400" />
            <Heading size="sm">User Personas</Heading>
          </HStack>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            {userPersonas.map((p: any, i: number) => (
              <Card key={i} bg={cardBg} border="1px solid" borderColor={borderColor} size="sm">
                <CardBody>
                  <VStack align="start" spacing={2}>
                    <HStack spacing={2}>
                      <Badge colorScheme="blue">{p.role || 'User'}</Badge>
                      <Text fontWeight="bold" fontSize="sm">{p.name}</Text>
                    </HStack>
                    {p.painPoints?.length > 0 && (
                      <Box>
                        <Text fontSize="xs" fontWeight="semibold" color="red.400" mb={1}>Pain Points</Text>
                        {p.painPoints.map((pp: string, j: number) => (
                          <Text key={j} fontSize="xs" color={subtextColor}>- {pp}</Text>
                        ))}
                      </Box>
                    )}
                    {p.desiredOutcomes?.length > 0 && (
                      <Box>
                        <Text fontSize="xs" fontWeight="semibold" color="green.400" mb={1}>Desired Outcomes</Text>
                        {p.desiredOutcomes.map((d: string, j: number) => (
                          <Text key={j} fontSize="xs" color={subtextColor}>+ {d}</Text>
                        ))}
                      </Box>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </Box>
      )}
    </VStack>
  );
};

// ── Executive View ───────────────────────────────────────────────────────────

const ExecutiveView: React.FC<{ data: ProductData }> = ({ data }) => {
  const { codeQuality, research, summary } = data;
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  const healthScore = codeQuality?.overallHealth?.score ?? summary?.codeHealthScore ?? 0;
  const healthGrade = codeQuality?.overallHealth?.grade ?? summary?.codeHealthGrade ?? 'N/A';
  const mutationScore = 0; // Mutation score comes from test results, use summary if available
  const competitorCount = (research?.competitorIntel || []).length;
  const gameChangerCount = summary?.gameChangerTrends ?? 0;
  const findings = countBySeverity(codeQuality);
  const confidence = getConfidence(healthScore);
  const monopolyStrategies = research?.monopolyStrategies || [];

  return (
    <VStack spacing={5} align="stretch">
      {/* Header */}
      <HStack spacing={2}>
        <Icon as={BarChart3} boxSize={5} color="purple.400" />
        <Heading size="md">Strategic Overview</Heading>
      </HStack>

      {/* Key Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        <Stat
          bg={cardBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="lg"
          p={4}
          textAlign="center"
        >
          <StatLabel fontSize="xs">Code Health</StatLabel>
          <StatNumber fontSize="2xl" color={confidence.color}>
            {Math.round(healthScore)}
          </StatNumber>
          <StatHelpText>
            <Badge colorScheme={confidence.colorScheme} fontSize="xs">{healthGrade}</Badge>
          </StatHelpText>
        </Stat>

        <Stat
          bg={cardBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="lg"
          p={4}
          textAlign="center"
        >
          <StatLabel fontSize="xs">Total Findings</StatLabel>
          <StatNumber fontSize="2xl">
            {summary?.totalFindings ?? (findings.critical + findings.high + findings.medium + findings.low)}
          </StatNumber>
          <StatHelpText fontSize="xs">across all categories</StatHelpText>
        </Stat>

        <Stat
          bg={cardBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="lg"
          p={4}
          textAlign="center"
        >
          <StatLabel fontSize="xs">Competitive Threats</StatLabel>
          <StatNumber fontSize="2xl" color="orange.500">
            {competitorCount}
          </StatNumber>
          <StatHelpText fontSize="xs">tracked competitors</StatHelpText>
        </Stat>

        <Stat
          bg={cardBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="lg"
          p={4}
          textAlign="center"
        >
          <StatLabel fontSize="xs">Game-Changer Trends</StatLabel>
          <StatNumber fontSize="2xl" color="blue.500">
            {gameChangerCount}
          </StatNumber>
          <StatHelpText fontSize="xs">emerging opportunities</StatHelpText>
        </Stat>
      </SimpleGrid>

      {/* Risk Breakdown */}
      <Box>
        <HStack spacing={2} mb={3}>
          <Icon as={AlertTriangle} boxSize={4} color="orange.400" />
          <Heading size="sm">Risk Breakdown</Heading>
        </HStack>
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
          {Object.entries(findings).map(([severity, count]) => (
            <Box
              key={severity}
              bg={cardBg}
              border="1px solid"
              borderColor={borderColor}
              borderRadius="md"
              p={3}
              textAlign="center"
            >
              <Text fontSize="2xl" fontWeight="bold" color={`${SEVERITY_COLORS[severity]}.500`}>
                {count}
              </Text>
              <Text fontSize="xs" color={subtextColor} textTransform="capitalize">
                {severity}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      <Divider />

      {/* Monopoly Strategies */}
      {monopolyStrategies.length > 0 && (
        <Box>
          <HStack spacing={2} mb={3}>
            <Icon as={Shield} boxSize={4} color="purple.400" />
            <Heading size="sm">Monopoly Strategies</Heading>
            <Badge colorScheme="purple" fontSize="xs">{monopolyStrategies.length}</Badge>
          </HStack>
          <VStack spacing={2} align="stretch">
            {monopolyStrategies.map((s: any, i: number) => (
              <Box
                key={i}
                bg={cardBg}
                border="1px solid"
                borderColor="purple.200"
                borderRadius="md"
                p={3}
              >
                <HStack justify="space-between" mb={1}>
                  <HStack spacing={2}>
                    <Icon as={Crown} boxSize={4} color="purple.400" />
                    <Text fontWeight="bold" fontSize="sm">{s.strategy || s.name || s.title}</Text>
                  </HStack>
                  <HStack spacing={1}>
                    {s.type && <Badge colorScheme="purple" fontSize="2xs">{s.type}</Badge>}
                    {s.feasibility && (
                      <Tooltip label={`Feasibility: ${s.feasibility}`}>
                        <Badge
                          colorScheme={FEASIBILITY_COLORS[s.feasibility?.toLowerCase()] || 'gray'}
                          fontSize="2xs"
                        >
                          {s.feasibility}
                        </Badge>
                      </Tooltip>
                    )}
                  </HStack>
                </HStack>
                <Text fontSize="xs" color={subtextColor}>
                  {s.description}
                </Text>
                {s.implementation && (
                  <Text fontSize="xs" color={subtextColor} mt={1}>
                    <Text as="span" fontWeight="semibold">Implementation:</Text> {s.implementation}
                  </Text>
                )}
              </Box>
            ))}
          </VStack>
        </Box>
      )}

      <Divider />

      {/* Confidence Indicator */}
      <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
        <CardBody>
          <HStack spacing={4}>
            <Box>
              <Progress
                value={healthScore}
                colorScheme={confidence.colorScheme}
                size="lg"
                borderRadius="full"
                w="200px"
              />
            </Box>
            <VStack align="start" spacing={0}>
              <Text fontSize="sm" fontWeight="bold" color={confidence.color}>
                Confidence: {confidence.label}
              </Text>
              <Text fontSize="xs" color={subtextColor}>
                Based on code health score of {Math.round(healthScore)}/100
              </Text>
            </VStack>
            <Badge colorScheme={confidence.colorScheme} fontSize="sm" px={3} py={1}>
              {healthGrade}
            </Badge>
          </HStack>
        </CardBody>
      </Card>
    </VStack>
  );
};

// ── Main ActionCenter ────────────────────────────────────────────────────────

const ActionCenter: React.FC<ActionCenterProps> = ({ runId }) => {
  const [role, setRole] = useState<Role>('developer');
  const [data, setData] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  // Fetch product data
  useEffect(() => {
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        // Try the provided runId first
        if (runId) {
          const res = await fetch(`${QA_ENGINE_URL}/qa/product/${runId}`);
          if (res.ok) {
            const json = await res.json();
            if (json.roadmap || json.codeQuality) {
              setData(json);
              setLoading(false);
              return;
            }
          }
        }

        // Fallback: find ANY completed run with product intelligence data
        const runsRes = await fetch(`${QA_ENGINE_URL}/qa/runs`);
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          const completedRuns = (runsData.runs || []).filter((r: any) => r.status === 'completed');
          for (const run of completedRuns) {
            const rid = run._key || run.runId;
            const prodRes = await fetch(`${QA_ENGINE_URL}/qa/product/${rid}`);
            if (prodRes.ok) {
              const json = await prodRes.json();
              if (json.roadmap || json.codeQuality) {
                setData(json);
                setLoading(false);
                return;
              }
            }
          }
        }

        setError('No product intelligence data found. Run a QA analysis to generate insights.');
      } catch (err: any) {
        setError(err.message || 'Failed to load Action Center data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Only poll if a run is active
    if (runId) {
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [runId]);

  // No run selected
  if (!runId) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6}>
        <VStack spacing={3}>
          <Icon as={BarChart3} boxSize={8} color={subtextColor} />
          <Text color={subtextColor}>Start a QA run to see the Action Center</Text>
        </VStack>
      </Box>
    );
  }

  // Loading
  if (loading && !data) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6} textAlign="center">
        <Spinner size="lg" color="brand.500" />
        <Text mt={3} color={subtextColor}>Loading Action Center data...</Text>
      </Box>
    );
  }

  // Error
  if (error && !data) {
    return (
      <Alert status="info" borderRadius="lg">
        <AlertIcon />
        <Text>{error}</Text>
      </Alert>
    );
  }

  if (!data) return null;

  // Compute summary metrics for the banner
  const codeHealthScore = data.codeQuality?.overallHealth?.score ?? data.summary?.codeHealthScore ?? 0;
  const mutationScore = 0; // would come from test results
  const criticalSmellCount = (data.codeQuality?.codeSmells || []).filter(
    (s: any) => s.severity === 'critical'
  ).length;
  const quickWinCount = (data.codeQuality?.refactoringRoadmap?.quickWins || []).length;
  const topActionTitle =
    data.codeQuality?.refactoringRoadmap?.quickWins?.[0]?.title ||
    data.codeQuality?.refactoringRoadmap?.quickWins?.[0]?.name ||
    undefined;

  const ROLE_CONFIG: Record<Role, { label: string; icon: React.ElementType; colorScheme: string }> = {
    developer: { label: 'Developer', icon: Code, colorScheme: 'green' },
    pm: { label: 'PM', icon: Briefcase, colorScheme: 'blue' },
    executive: { label: 'Executive', icon: BarChart3, colorScheme: 'purple' },
  };

  return (
    <VStack spacing={4} align="stretch">
      {/* Actionable Summary Banner */}
      <ActionableSummary
        codeHealth={codeHealthScore}
        mutationScore={mutationScore}
        criticalSmells={criticalSmellCount}
        quickWins={quickWinCount}
        topAction={topActionTitle}
      />

      {/* Role Selector */}
      <Flex justify="center">
        <ButtonGroup size="sm" isAttached variant="outline">
          {(Object.keys(ROLE_CONFIG) as Role[]).map((r) => {
            const config = ROLE_CONFIG[r];
            const RoleIcon = config.icon;
            const isActive = role === r;
            return (
              <Button
                key={r}
                onClick={() => setRole(r)}
                colorScheme={isActive ? config.colorScheme : 'gray'}
                variant={isActive ? 'solid' : 'outline'}
                leftIcon={<RoleIcon size={14} />}
              >
                {config.label}
              </Button>
            );
          })}
        </ButtonGroup>
      </Flex>

      {/* Role-specific view */}
      <Box
        bg={cardBg}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="lg"
        p={5}
      >
        {role === 'developer' && <DeveloperView data={data} />}
        {role === 'pm' && <PMView data={data} />}
        {role === 'executive' && <ExecutiveView data={data} />}
      </Box>
    </VStack>
  );
};

export default ActionCenter;
