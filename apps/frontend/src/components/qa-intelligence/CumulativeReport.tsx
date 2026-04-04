/**
 * CumulativeReport - Comprehensive, printable report combining ALL persona outputs
 * into one actionable document suitable for PM emails or meeting handouts.
 *
 * Fetches from: QA_ENGINE_URL/qa/product/{runId}
 * Sections: Executive Summary, Developer Action Items, Product Roadmap,
 *           Code Quality Summary, Competitive Intelligence, Strategic Recommendations,
 *           Documentation Gaps
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Heading,
  Divider,
  SimpleGrid,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  Spinner,
  Alert,
  AlertIcon,
  Icon,
  Tag,
  Wrap,
  WrapItem,
  Progress,
  Input,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  Printer,
  FileText,
  Zap,
  Target,
  TrendingUp,
  Star,
  Shield,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Code,
  Bug,
  Trash2,
  FileCode,
  Crown,
  Crosshair,
  Lightbulb,
  BookOpen,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface CumulativeReportProps {
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



// ── Color Maps ───────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const EFFORT_ORDER: Record<string, number> = { XS: 0, S: 1, M: 2, L: 3, XL: 4 };

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
};

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

const THREAT_COLORS: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'green',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGradeColor(grade: string): string {
  if (grade === 'A' || grade === 'A+') return 'green';
  if (grade === 'B' || grade === 'B+') return 'blue';
  if (grade === 'C' || grade === 'C+') return 'yellow';
  if (grade === 'D') return 'orange';
  return 'red';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Section Components ───────────────────────────────────────────────────────

const SectionHeader: React.FC<{ icon: React.ElementType; title: string; count?: number }> = ({ icon, title, count }) => {
  const headerColor = useColorModeValue('gray.800', 'gray.100');
  return (
    <HStack spacing={2} mb={3}>
      <Icon as={icon} boxSize={5} color="blue.500" />
      <Heading size="md" color={headerColor}>{title}</Heading>
      {count !== undefined && count > 0 && (
        <Badge colorScheme="blue" fontSize="xs">{count}</Badge>
      )}
    </HStack>
  );
};

// ── Report Header ────────────────────────────────────────────────────────────

const ReportHeader: React.FC<{ data: ProductData }> = ({ data }) => {
  const { summary, codeQuality } = data;
  const headerBg = useColorModeValue('blue.50', 'blue.900');
  const grade = (summary as any)?.unifiedHealthScore?.grade ?? codeQuality?.overallHealth?.grade ?? summary?.codeHealthGrade ?? 'N/A';
  const score = (summary as any)?.unifiedHealthScore?.score ?? codeQuality?.overallHealth?.score ?? summary?.codeHealthScore ?? 0;

  return (
    <Box bg={headerBg} borderRadius="lg" p={6} mb={6}>
      <HStack justify="space-between" align="flex-start" flexWrap="wrap" spacing={4}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">QA Intelligence Report</Heading>
          <Text fontSize="md" fontWeight="medium" color="blue.600">
            {summary?.appDomain || 'Repository Analysis'}
          </Text>
          <Text fontSize="sm" color="gray.500">
            Generated: {formatDate()}
          </Text>
        </VStack>
        <VStack align="center" spacing={1}>
          <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="gray.500">
            Code Health
          </Text>
          <Badge
            colorScheme={getGradeColor(grade)}
            fontSize="2xl"
            px={4}
            py={2}
            borderRadius="lg"
          >
            {grade}
          </Badge>
          <Text fontSize="sm" fontWeight="bold" color={score >= 80 ? 'green.500' : score >= 60 ? 'yellow.600' : 'red.500'}>
            {Math.round(score)}/100
          </Text>
        </VStack>
      </HStack>
    </Box>
  );
};

// ── Executive Summary ────────────────────────────────────────────────────────

const ExecutiveSummary: React.FC<{ data: ProductData }> = ({ data }) => {
  const { summary, codeQuality, research, priorities } = data;
  const cardBg = useColorModeValue('gray.50', 'gray.700');
  const score = (summary as any)?.unifiedHealthScore?.score ?? codeQuality?.overallHealth?.score ?? summary?.codeHealthScore ?? 0;
  const grade = (summary as any)?.unifiedHealthScore?.grade ?? codeQuality?.overallHealth?.grade ?? summary?.codeHealthGrade ?? 'N/A';
  const topPriority = priorities?.[0]?.title || 'N/A';
  const competitorCount = (research?.competitorIntel || []).length;

  const healthLabel = score >= 80 ? 'strong' : score >= 60 ? 'moderate' : 'needs attention';

  return (
    <Box mb={6}>
      <SectionHeader icon={FileText} title="Executive Summary" />
      <Box bg={cardBg} borderRadius="md" p={4}>
        <Text fontSize="sm" lineHeight="tall">
          This repository operates in the <strong>{summary?.appDomain || 'software development'}</strong> domain.
          Code health is <strong>{healthLabel}</strong> at {Math.round(score)}/100 (Grade {grade})
          {summary?.totalFindings ? ` with ${summary.totalFindings} total findings` : ''}.
          {topPriority !== 'N/A' ? ` The top priority action is: "${topPriority}".` : ''}
          {competitorCount > 0 ? ` ${competitorCount} competitors have been identified in the market.` : ''}
          {summary?.gameChangerTrends ? ` ${summary.gameChangerTrends} game-changer trends and ${summary?.monopolyStrategies || 0} moat strategies have been discovered.` : ''}
        </Text>
      </Box>
    </Box>
  );
};

// ── Developer Action Items ───────────────────────────────────────────────────

const DeveloperActionItems: React.FC<{ data: ProductData }> = ({ data }) => {
  const { codeQuality } = data;
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const beforeBg = useColorModeValue('red.50', 'red.900');
  const afterBg = useColorModeValue('green.50', 'green.900');

  if (!codeQuality) return null;

  const quickWins = (codeQuality.refactoringRoadmap?.quickWins || []).map((w: any) => ({ ...w, _source: 'quickWin' }));
  const criticalSmells = (codeQuality.codeSmells || [])
    .filter((s: any) => s.severity === 'critical' || s.severity === 'high')
    .map((s: any) => ({ ...s, _source: 'codeSmell' }));

  const allItems = [...quickWins, ...criticalSmells];

  // Sort: severity first (critical > high > medium > low), then effort (XS > S > M > L > XL)
  allItems.sort((a, b) => {
    const sevA = SEVERITY_ORDER[(a.severity || 'medium').toLowerCase()] ?? 2;
    const sevB = SEVERITY_ORDER[(b.severity || 'medium').toLowerCase()] ?? 2;
    if (sevA !== sevB) return sevA - sevB;
    const effA = EFFORT_ORDER[a.effort] ?? 2;
    const effB = EFFORT_ORDER[b.effort] ?? 2;
    return effA - effB;
  });

  if (allItems.length === 0) return null;

  return (
    <Box mb={6}>
      <SectionHeader icon={Zap} title="Developer Action Items" count={allItems.length} />
      <VStack spacing={2} align="stretch">
        {allItems.map((item: any, i: number) => (
          <Box
            key={i}
            bg={cardBg}
            border="1px solid"
            borderColor={borderColor}
            borderRadius="md"
            p={3}
          >
            <HStack spacing={2} mb={1} flexWrap="wrap">
              <Badge
                colorScheme={SEVERITY_COLORS[(item.severity || 'medium').toLowerCase()] || 'gray'}
                fontSize="2xs"
              >
                {(item.severity || 'medium').toUpperCase()}
              </Badge>
              {item.effort && (
                <Badge colorScheme={EFFORT_COLORS[item.effort] || 'gray'} fontSize="2xs" variant="outline">
                  {item.effort}
                </Badge>
              )}
              <Text fontWeight="bold" fontSize="sm">
                {i + 1}. {item.title || item.name || item.smell || `Finding #${i + 1}`}
              </Text>
            </HStack>
            <Text fontSize="xs" color={subtextColor} mb={1}>
              {item.description || item.suggestion || item.message || ''}
            </Text>
            <HStack spacing={3} flexWrap="wrap">
              {(item.filePath || item.file || item.location) && (
                <Text fontSize="xs" fontFamily="mono" color="blue.500">
                  {item.filePath || item.file || item.location}
                </Text>
              )}
              {item.technique && (
                <Tag size="sm" fontSize="2xs" variant="outline" colorScheme="purple">
                  {item.technique}
                </Tag>
              )}
            </HStack>
            {(item.before || item.codeExample) && (
              <Box mt={2} p={2} bg={beforeBg} borderRadius="sm" fontSize="xs" fontFamily="mono">
                <Text color="red.500" fontWeight="bold" mb={1}>Before:</Text>
                <Text whiteSpace="pre-wrap">{item.before || item.codeExample}</Text>
              </Box>
            )}
            {(item.after || item.suggestedFix) && (
              <Box mt={1} p={2} bg={afterBg} borderRadius="sm" fontSize="xs" fontFamily="mono">
                <Text color="green.500" fontWeight="bold" mb={1}>After:</Text>
                <Text whiteSpace="pre-wrap">{item.after || item.suggestedFix}</Text>
              </Box>
            )}
          </Box>
        ))}
      </VStack>
    </Box>
  );
};

// ── Product Roadmap ──────────────────────────────────────────────────────────

const ProductRoadmapSection: React.FC<{ data: ProductData }> = ({ data }) => {
  const { roadmap } = data;
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  if (!roadmap?.roadmap) return null;

  const phases = [
    { key: 'immediate', label: 'Immediate (Do Now)', icon: Zap, color: 'red' },
    { key: 'shortTerm', label: 'Short Term (1-3 months)', icon: Target, color: 'orange' },
    { key: 'mediumTerm', label: 'Medium Term (3-6 months)', icon: TrendingUp, color: 'blue' },
    { key: 'longTerm', label: 'Long Term (6-12 months)', icon: Star, color: 'purple' },
  ];

  const hasAnyFeatures = phases.some(p => (roadmap.roadmap[p.key] || []).length > 0);
  if (!hasAnyFeatures) return null;

  return (
    <Box mb={6}>
      <SectionHeader icon={Target} title="Product Roadmap" />
      <VStack spacing={4} align="stretch">
        {phases.map(({ key, label, icon: PhaseIcon, color }) => {
          const features = roadmap.roadmap[key] || [];
          if (features.length === 0) return null;
          return (
            <Box key={key}>
              <HStack spacing={2} mb={2}>
                <Icon as={PhaseIcon} boxSize={4} color={`${color}.400`} />
                <Heading size="sm" color={`${color}.500`}>{label}</Heading>
                <Badge colorScheme={color} fontSize="2xs">{features.length}</Badge>
              </HStack>
              <VStack spacing={2} align="stretch" pl={6}>
                {features.map((f: any, i: number) => (
                  <Box
                    key={i}
                    bg={cardBg}
                    border="1px solid"
                    borderColor={borderColor}
                    borderRadius="md"
                    p={3}
                  >
                    <HStack spacing={2} mb={1} flexWrap="wrap">
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
                      <Text fontWeight="bold" fontSize="sm">{f.title}</Text>
                    </HStack>
                    <Text fontSize="xs" color={subtextColor} mb={1}>{f.description}</Text>
                    {f.revenueSignal && (
                      <HStack spacing={1}>
                        <Icon as={TrendingUp} boxSize={3} color="green.400" />
                        <Text fontSize="xs" color={subtextColor}>
                          <Text as="span" fontWeight="semibold">Revenue:</Text> {f.revenueSignal}
                        </Text>
                      </HStack>
                    )}
                  </Box>
                ))}
              </VStack>
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
};

// ── Code Quality Summary ─────────────────────────────────────────────────────

const CodeQualitySection: React.FC<{ data: ProductData }> = ({ data }) => {
  const { codeQuality } = data;
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  if (!codeQuality) return null;

  const overallHealth = codeQuality.overallHealth || {};
  const codeSmells = codeQuality.codeSmells || [];
  const duplicationHotspots = codeQuality.duplicationHotspots || [];
  const architectureIssues = codeQuality.architectureIssues || [];
  const deadCode = codeQuality.deadCode || [];

  const topSmells = codeSmells.slice(0, 5);

  return (
    <Box mb={6}>
      <SectionHeader icon={CheckCircle} title="Code Quality Summary" />

      {/* Health Score Bar */}
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="md" p={4} mb={3}>
        <HStack justify="space-between" mb={2}>
          <Text fontSize="sm" fontWeight="bold">
            Health Score: {Math.round(overallHealth.score || 0)}/100
          </Text>
          <Badge
            colorScheme={getGradeColor(overallHealth.grade || 'N/A')}
            fontSize="md"
            px={3}
          >
            {overallHealth.grade || 'N/A'}
          </Badge>
        </HStack>
        <Progress
          value={overallHealth.score || 0}
          colorScheme={overallHealth.score >= 80 ? 'green' : overallHealth.score >= 60 ? 'yellow' : 'red'}
          size="lg"
          borderRadius="full"
        />
        {overallHealth.summary && (
          <Text fontSize="xs" color={subtextColor} mt={2}>{overallHealth.summary}</Text>
        )}
        {overallHealth.techDebtHours != null && (
          <Text fontSize="xs" color={subtextColor} mt={1}>
            Estimated tech debt: {overallHealth.techDebtHours} hours
          </Text>
        )}
      </Box>

      {/* Top Code Smells */}
      {topSmells.length > 0 && (
        <Box mb={3}>
          <Text fontSize="sm" fontWeight="bold" mb={2}>
            Top Code Smells ({codeSmells.length} total)
          </Text>
          <VStack spacing={1} align="stretch">
            {topSmells.map((smell: any, i: number) => (
              <HStack
                key={i}
                bg={cardBg}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="md"
                p={2}
                spacing={2}
              >
                <Badge colorScheme={SEVERITY_COLORS[(smell.severity || 'medium').toLowerCase()] || 'gray'} fontSize="2xs">
                  {smell.severity || 'medium'}
                </Badge>
                <VStack align="start" spacing={0} flex={1}>
                  <Text fontSize="xs" fontWeight="medium">
                    {smell.name || smell.smell || smell.title || `Smell #${i + 1}`}
                  </Text>
                  <Text fontSize="2xs" color={subtextColor} fontFamily="mono">
                    {smell.filePath || smell.file || smell.location || 'Unknown'}
                  </Text>
                </VStack>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      {/* Duplication Hotspots */}
      {duplicationHotspots.length > 0 && (
        <Box mb={3}>
          <Text fontSize="sm" fontWeight="bold" mb={2}>
            Duplication Hotspots ({duplicationHotspots.length})
          </Text>
          <VStack spacing={1} align="stretch">
            {duplicationHotspots.slice(0, 5).map((dup: any, i: number) => (
              <Box key={i} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="md" p={2}>
                <Text fontSize="xs" fontWeight="medium">
                  {dup.title || dup.pattern || `Duplication #${i + 1}`}
                </Text>
                <Text fontSize="2xs" color={subtextColor}>
                  {dup.description || `${dup.instances || dup.count || '?'} instances`}
                </Text>
                {dup.files && (
                  <Wrap spacing={1} mt={1}>
                    {(Array.isArray(dup.files) ? dup.files : []).slice(0, 3).map((f: string, j: number) => (
                      <WrapItem key={j}>
                        <Tag size="sm" fontSize="2xs" fontFamily="mono">{f}</Tag>
                      </WrapItem>
                    ))}
                  </Wrap>
                )}
              </Box>
            ))}
          </VStack>
        </Box>
      )}

      {/* Architecture Issues */}
      {architectureIssues.length > 0 && (
        <Box mb={3}>
          <Text fontSize="sm" fontWeight="bold" mb={2}>
            Architecture Issues ({architectureIssues.length})
          </Text>
          <VStack spacing={1} align="stretch">
            {architectureIssues.slice(0, 5).map((issue: any, i: number) => (
              <HStack
                key={i}
                bg={cardBg}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="md"
                p={2}
                spacing={2}
              >
                <Badge colorScheme={SEVERITY_COLORS[(issue.severity || 'medium').toLowerCase()] || 'gray'} fontSize="2xs">
                  {issue.severity || 'medium'}
                </Badge>
                <VStack align="start" spacing={0} flex={1}>
                  <Text fontSize="xs" fontWeight="medium">{issue.type || issue.title || `Issue #${i + 1}`}</Text>
                  <Text fontSize="2xs" color={subtextColor}>{issue.description}</Text>
                </VStack>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      {/* Dead Code */}
      {deadCode.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="bold" mb={2}>
            Dead Code ({deadCode.length} items)
          </Text>
          <Wrap spacing={1}>
            {deadCode.slice(0, 10).map((item: any, i: number) => (
              <WrapItem key={i}>
                <Tag size="sm" fontSize="2xs" colorScheme="gray" fontFamily="mono">
                  {item.name || item.symbol || item.identifier || `dead_${i + 1}`}
                </Tag>
              </WrapItem>
            ))}
            {deadCode.length > 10 && (
              <WrapItem>
                <Tag size="sm" fontSize="2xs" colorScheme="gray">+{deadCode.length - 10} more</Tag>
              </WrapItem>
            )}
          </Wrap>
        </Box>
      )}
    </Box>
  );
};

// ── Competitive Intelligence ─────────────────────────────────────────────────

const CompetitiveIntelSection: React.FC<{ data: ProductData }> = ({ data }) => {
  const { research } = data;
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const competitors = research?.competitorIntel || [];
  if (competitors.length === 0) return null;

  return (
    <Box mb={6}>
      <SectionHeader icon={Crosshair} title="Competitive Intelligence" count={competitors.length} />

      {/* Market Position */}
      {research?.domainAnalysis && (
        <Box mb={3}>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3} mb={3}>
            {research.domainAnalysis.industry && (
              <Box p={2} borderRadius="md" border="1px solid" borderColor={borderColor}>
                <Text fontSize="2xs" fontWeight="bold" color="gray.500" textTransform="uppercase">Industry</Text>
                <Text fontSize="sm">{research.domainAnalysis.industry}</Text>
              </Box>
            )}
            {research.domainAnalysis.marketSize && (
              <Box p={2} borderRadius="md" border="1px solid" borderColor={borderColor}>
                <Text fontSize="2xs" fontWeight="bold" color="gray.500" textTransform="uppercase">Market Size</Text>
                <Text fontSize="sm">{research.domainAnalysis.marketSize}</Text>
              </Box>
            )}
            {research.domainAnalysis.growthDirection && (
              <Box p={2} borderRadius="md" border="1px solid" borderColor={borderColor}>
                <Text fontSize="2xs" fontWeight="bold" color="gray.500" textTransform="uppercase">Growth</Text>
                <Text fontSize="sm">{research.domainAnalysis.growthDirection}</Text>
              </Box>
            )}
          </SimpleGrid>
        </Box>
      )}

      {/* Competitor Comparison Table */}
      <Box overflowX="auto">
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th>Competitor</Th>
              <Th>Threat</Th>
              <Th>Strengths</Th>
              <Th>Weaknesses</Th>
            </Tr>
          </Thead>
          <Tbody>
            {competitors.map((c: any, i: number) => (
              <Tr key={i}>
                <Td fontWeight="bold" fontSize="sm">{c.competitor || c.name}</Td>
                <Td>
                  <Badge
                    colorScheme={THREAT_COLORS[(c.threatLevel || 'medium').toLowerCase()] || 'gray'}
                    fontSize="2xs"
                  >
                    {c.threatLevel || 'unknown'}
                  </Badge>
                </Td>
                <Td fontSize="xs">
                  {(c.strengths || []).slice(0, 2).join('; ') || '--'}
                </Td>
                <Td fontSize="xs">
                  {(c.weaknesses || []).slice(0, 2).join('; ') || '--'}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
};

// ── Strategic Recommendations ────────────────────────────────────────────────

const StrategicRecommendations: React.FC<{ data: ProductData }> = ({ data }) => {
  const { research } = data;
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  const trends = (research?.trendInsights || []).filter((t: any) => t.relevance === 'game-changer');
  const monopolyStrategies = research?.monopolyStrategies || [];
  const enhancementRecs = research?.enhancementRecommendations || [];

  if (trends.length === 0 && monopolyStrategies.length === 0 && enhancementRecs.length === 0) return null;

  return (
    <Box mb={6}>
      <SectionHeader icon={Lightbulb} title="Strategic Recommendations" />

      {/* Game-changer Trends */}
      {trends.length > 0 && (
        <Box mb={4}>
          <Text fontSize="sm" fontWeight="bold" mb={2}>
            <Icon as={TrendingUp} boxSize={3} mr={1} color="orange.400" />
            Game-Changer Trends ({trends.length})
          </Text>
          <VStack spacing={2} align="stretch">
            {trends.map((t: any, i: number) => (
              <Box key={i} bg={cardBg} border="1px solid" borderColor="orange.200" borderRadius="md" p={3}>
                <HStack justify="space-between" mb={1}>
                  <Text fontWeight="bold" fontSize="sm">{t.trend}</Text>
                  <HStack spacing={1}>
                    <Badge colorScheme="orange" fontSize="2xs">{t.category}</Badge>
                    {t.effort && <Badge colorScheme={EFFORT_COLORS[t.effort] || 'gray'} fontSize="2xs">{t.effort}</Badge>}
                  </HStack>
                </HStack>
                <Text fontSize="xs" color={subtextColor}>{t.description}</Text>
                {t.implementationPath && (
                  <Text fontSize="xs" mt={1}>
                    <Text as="span" fontWeight="semibold">Implementation:</Text> {t.implementationPath}
                  </Text>
                )}
              </Box>
            ))}
          </VStack>
        </Box>
      )}

      {/* Monopoly/Moat Strategies */}
      {monopolyStrategies.length > 0 && (
        <Box mb={4}>
          <Text fontSize="sm" fontWeight="bold" mb={2}>
            <Icon as={Shield} boxSize={3} mr={1} color="purple.400" />
            Moat Strategies ({monopolyStrategies.length})
          </Text>
          <VStack spacing={2} align="stretch">
            {monopolyStrategies.map((s: any, i: number) => (
              <Box key={i} bg={cardBg} border="1px solid" borderColor="purple.200" borderRadius="md" p={3}>
                <HStack justify="space-between" mb={1}>
                  <HStack spacing={2}>
                    <Icon as={Crown} boxSize={4} color="purple.400" />
                    <Text fontWeight="bold" fontSize="sm">{s.strategy || s.name || s.title}</Text>
                  </HStack>
                  <HStack spacing={1}>
                    {s.type && <Badge colorScheme="purple" fontSize="2xs">{s.type}</Badge>}
                    {s.feasibility && (
                      <Badge
                        colorScheme={s.feasibility?.toLowerCase() === 'high' ? 'green' : s.feasibility?.toLowerCase() === 'medium' ? 'yellow' : 'red'}
                        fontSize="2xs"
                      >
                        {s.feasibility}
                      </Badge>
                    )}
                  </HStack>
                </HStack>
                <Text fontSize="xs" color={subtextColor}>{s.description}</Text>
                {s.implementation && (
                  <Text fontSize="xs" mt={1}>
                    <Text as="span" fontWeight="semibold">Implementation:</Text> {s.implementation}
                  </Text>
                )}
              </Box>
            ))}
          </VStack>
        </Box>
      )}

      {/* Enhancement Recommendations */}
      {enhancementRecs.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="bold" mb={2}>
            Enhancement Recommendations ({enhancementRecs.length})
          </Text>
          <VStack spacing={1} align="stretch">
            {enhancementRecs.map((r: any, i: number) => (
              <Box key={i} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="md" p={2}>
                <Text fontSize="xs" fontWeight="medium">{r.title || r.recommendation || `Recommendation #${i + 1}`}</Text>
                <Text fontSize="2xs" color={subtextColor}>{r.description || r.rationale || ''}</Text>
              </Box>
            ))}
          </VStack>
        </Box>
      )}
    </Box>
  );
};

// ── Documentation Gaps ───────────────────────────────────────────────────────

const DocumentationGaps: React.FC<{ data: ProductData }> = ({ data }) => {
  const { codeQuality } = data;
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  if (!codeQuality) return null;

  const docGaps = codeQuality.documentationGaps || codeQuality.missingDocumentation || [];
  const todoCount = codeQuality.todoCount ?? codeQuality.todos?.length ?? null;
  const bestPracticeViolations = (codeQuality.bestPracticeViolations || []).filter(
    (v: any) => (v.rule || '').toLowerCase().includes('doc') || (v.message || '').toLowerCase().includes('doc')
  );

  if (docGaps.length === 0 && todoCount === null && bestPracticeViolations.length === 0) return null;

  return (
    <Box mb={6}>
      <SectionHeader icon={BookOpen} title="Documentation Gaps" />

      {todoCount !== null && (
        <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="md" p={3} mb={3}>
          <HStack spacing={2}>
            <Icon as={AlertTriangle} boxSize={4} color="yellow.400" />
            <Text fontSize="sm">
              <Text as="span" fontWeight="bold">{todoCount}</Text> TODO/FIXME/HACK comments found in codebase
            </Text>
          </HStack>
        </Box>
      )}

      {docGaps.length > 0 && (
        <VStack spacing={1} align="stretch">
          {docGaps.slice(0, 10).map((gap: any, i: number) => (
            <HStack key={i} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="md" p={2} spacing={2}>
              <Icon as={FileCode} boxSize={4} color="gray.400" />
              <VStack align="start" spacing={0} flex={1}>
                <Text fontSize="xs" fontWeight="medium">
                  {typeof gap === 'string' ? gap : gap.file || gap.name || `Gap #${i + 1}`}
                </Text>
                {typeof gap !== 'string' && gap.reason && (
                  <Text fontSize="2xs" color={subtextColor}>{gap.reason}</Text>
                )}
              </VStack>
            </HStack>
          ))}
          {docGaps.length > 10 && (
            <Text fontSize="xs" color={subtextColor} textAlign="center">
              +{docGaps.length - 10} more files with missing documentation
            </Text>
          )}
        </VStack>
      )}
    </Box>
  );
};

// ── Main CumulativeReport Component ──────────────────────────────────────────

const CumulativeReport: React.FC<CumulativeReportProps> = ({ runId }) => {
  const [data, setData] = useState<ProductData | null>(null);
  const [wikiData, setWikiData] = useState<{ files: any[]; entities: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        // Try the provided runId first
        if (runId) {
          const res = await fetch(`/qa/product/${runId}`);
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
        const runsRes = await fetch(`/qa/runs`);
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          const completedRuns = (runsData.runs || []).filter((r: any) => r.status === 'completed');
          for (const run of completedRuns) {
            const rid = run._key || run.runId;
            const prodRes = await fetch(`/qa/product/${rid}`);
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

        setError('No report data found. Run a full QA analysis to generate the report.');
      } catch (err: any) {
        setError(err.message || 'Failed to load report data');
      } finally {
        setLoading(false);
      }
    };

    const fetchWiki = async () => {
      try {
        // Try provided runId, then latest run
        const rid = runId || '';
        let wikiRes = rid ? await fetch(`/qa/wiki/${rid}`).catch(() => null) : null;
        if (!wikiRes?.ok) {
          const runsRes = await fetch(`/qa/runs?limit=1`);
          if (runsRes.ok) {
            const runsData = await runsRes.json();
            const latestRun = runsData.runs?.[0];
            if (latestRun?._key) {
              wikiRes = await fetch(`/qa/wiki/${latestRun._key}`);
            }
          }
        }
        if (wikiRes?.ok) {
          const wiki = await wikiRes.json();
          setWikiData(wiki);
        }
      } catch { /* non-fatal */ }
    };

    fetchData();
    fetchWiki();
  }, [runId]);

  const handlePrint = () => {
    window.print();
  };

  // Loading
  if (loading && !data) {
    return (
      <Box bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={6} textAlign="center">
        <Spinner size="lg" color="blue.500" />
        <Text mt={3} color={subtextColor}>Generating cumulative report...</Text>
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

  return (
    <Box className="cumulative-report">
      {/* Print Button (hidden on print) */}
      <HStack justify="flex-end" mb={4} className="no-print">
        <Button
          leftIcon={<Printer size={16} />}
          colorScheme="blue"
          size="sm"
          onClick={handlePrint}
        >
          Print Report
        </Button>
      </HStack>

      {/* Report Content */}
      <Box
        bg={cardBg}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="lg"
        p={6}
        maxW="900px"
        mx="auto"
      >
        <ReportHeader data={data} />

        {/* Data Quality Caveats */}
        <Box
          my={4} p={4}
          bg={cardBg === 'white' ? 'yellow.50' : 'yellow.900'}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="md"
        >
          <Text fontWeight="bold" fontSize="sm" mb={2}>Report Confidence</Text>
          <VStack align="start" spacing={1} fontSize="xs">
            {data?.summary?.codeHealthScore !== null && data?.summary?.codeHealthScore !== undefined && (
              <HStack>
                <Text>{data.summary.codeHealthScore >= 80 ? '✅' : data.summary.codeHealthScore >= 60 ? '⚠️' : '🔴'}</Text>
                <Text>
                  Code Health: Grade {data?.codeQuality?.overallHealth?.grade || 'N/A'} ({data.summary.codeHealthScore}/100).
                  {data.summary.codeHealthScore < 60 && ' Roadmap items are gated on stabilization. Fix tests and tech debt first.'}
                  {data.summary.codeHealthScore >= 80 && ' Healthy foundation — feature recommendations are reliable.'}
                  {data.summary.codeHealthScore >= 60 && data.summary.codeHealthScore < 80 && ' Some tech debt should be addressed alongside new features.'}
                </Text>
              </HStack>
            )}
            <HStack>
              <Text>⚠️</Text>
              <Text>Test Accuracy: Generated tests were syntax-checked only. Full Jest/Vitest execution requires project configuration and dependencies.</Text>
            </HStack>
            <HStack>
              <Text>✅</Text>
              <Text>Code Analysis: Full access to {data?.summary?.totalFeatures ? 'complete' : 'available'} codebase with entity extraction.</Text>
            </HStack>
            <HStack>
              <Text>ℹ️</Text>
              <Text>AI-Generated: All findings, roadmaps, and recommendations are AI-generated and should be reviewed by a human before implementation.</Text>
            </HStack>
          </VStack>
        </Box>

        <ExecutiveSummary data={data} />
        <Divider my={4} />
        <DeveloperActionItems data={data} />
        <Divider my={4} />
        <ProductRoadmapSection data={data} />
        <Divider my={4} />
        <CodeQualitySection data={data} />
        <Divider my={4} />
        <CompetitiveIntelSection data={data} />
        <Divider my={4} />
        <StrategicRecommendations data={data} />
        <Divider my={4} />
        <DocumentationGaps data={data} />

        {/* Files Requiring Action — aggregated from wiki data */}
        {wikiData && wikiData.files.length > 0 && (() => {
          const sourceFiles = wikiData.files.filter((f: any) =>
            f.path?.match(/\.(js|jsx|ts|tsx|py|java)$/)
          );
          const noDocFiles = sourceFiles.filter((f: any) => !f.hasDocumentation).slice(0, 20);
          const highRiskFiles = sourceFiles.filter((f: any) => (f.size || 0) > 300).slice(0, 10);

          // Count entities per file
          const entityCounts: Record<string, number> = {};
          for (const e of (wikiData.entities || [])) {
            const f = e.file || '';
            entityCounts[f] = (entityCounts[f] || 0) + 1;
          }
          const complexFiles = Object.entries(entityCounts)
            .filter(([_, count]) => count >= 8)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

          return (
            <>
              <Divider my={4} />
              <Box>
                <Heading size="sm" mb={3}>
                  <HStack><Text>📋</Text><Text>Files Requiring Team Action</Text></HStack>
                </Heading>
                <Text fontSize="sm" color={subtextColor} mb={3}>
                  Aggregated from {sourceFiles.length} source files and {wikiData.entities.length} code entities.
                  Assign these to your team for immediate attention.
                </Text>

                {/* Files needing documentation */}
                {noDocFiles.length > 0 && (
                  <Box mb={4}>
                    <Text fontSize="sm" fontWeight="bold" mb={2}>
                      📝 Files Needing Documentation ({noDocFiles.length})
                    </Text>
                    <Box fontSize="xs" maxH="200px" overflowY="auto">
                      <Table size="sm" variant="simple">
                        <Thead><Tr><Th>File</Th><Th>Language</Th><Th>Size</Th></Tr></Thead>
                        <Tbody>
                          {noDocFiles.map((f: any, i: number) => (
                            <Tr key={i}>
                              <Td fontFamily="mono" fontSize="xs">{f.path}</Td>
                              <Td><Badge colorScheme="blue" fontSize="2xs">{f.language}</Badge></Td>
                              <Td>{f.size ? `${f.size}B` : '—'}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                  </Box>
                )}

                {/* Complex files (many entities) */}
                {complexFiles.length > 0 && (
                  <Box mb={4}>
                    <Text fontSize="sm" fontWeight="bold" mb={2}>
                      🔧 Complex Files — Consider Refactoring ({complexFiles.length})
                    </Text>
                    <Box fontSize="xs" maxH="200px" overflowY="auto">
                      <Table size="sm" variant="simple">
                        <Thead><Tr><Th>File</Th><Th>Entities</Th><Th>Recommendation</Th></Tr></Thead>
                        <Tbody>
                          {complexFiles.map(([file, count], i) => (
                            <Tr key={i}>
                              <Td fontFamily="mono" fontSize="xs">{file}</Td>
                              <Td><Badge colorScheme={count >= 15 ? 'red' : count >= 10 ? 'orange' : 'yellow'}>{count} entities</Badge></Td>
                              <Td fontSize="xs">{count >= 15 ? 'Split into smaller modules' : count >= 10 ? 'Review for single responsibility' : 'Monitor complexity'}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                  </Box>
                )}

                {/* Summary stats */}
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mt={3}>
                  <Box p={2} bg={cardBg === 'white' ? 'blue.50' : 'blue.900'} borderRadius="md" textAlign="center">
                    <Text fontSize="lg" fontWeight="bold" color="blue.500">{sourceFiles.length}</Text>
                    <Text fontSize="2xs">Source Files</Text>
                  </Box>
                  <Box p={2} bg={cardBg === 'white' ? 'purple.50' : 'purple.900'} borderRadius="md" textAlign="center">
                    <Text fontSize="lg" fontWeight="bold" color="purple.500">{wikiData.entities.length}</Text>
                    <Text fontSize="2xs">Code Entities</Text>
                  </Box>
                  <Box p={2} bg={cardBg === 'white' ? 'orange.50' : 'orange.900'} borderRadius="md" textAlign="center">
                    <Text fontSize="lg" fontWeight="bold" color="orange.500">{noDocFiles.length}</Text>
                    <Text fontSize="2xs">Need Docs</Text>
                  </Box>
                  <Box p={2} bg={cardBg === 'white' ? 'red.50' : 'red.900'} borderRadius="md" textAlign="center">
                    <Text fontSize="lg" fontWeight="bold" color="red.500">{complexFiles.length}</Text>
                    <Text fontSize="2xs">Complex Files</Text>
                  </Box>
                </SimpleGrid>
              </Box>
            </>
          );
        })()}

        {/* Interactive Chat — ask about this report */}
        <Divider my={4} />
        <ReportChat runId={runId} />

        {/* Footer */}
        <Divider my={4} />
        <Text fontSize="xs" color={subtextColor} textAlign="center">
          Generated by QA Intelligence Platform | Run ID: {runId} | {formatDate()}
        </Text>
      </Box>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .cumulative-report { padding: 0 !important; }
        }
      `}</style>
    </Box>
  );
};

// ── Report Chat Component ──────────────────────────────────────────────────

const ReportChat: React.FC<{ runId: string }> = ({ runId }) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const chatBg = useColorModeValue('gray.50', 'gray.800');
  const assistantMsgBg = useColorModeValue('gray.100', 'gray.700');

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {

      const resp = await fetch(`/qa/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          agent: 'product-manager',
          message: userMsg,
          conversationId,
        }),
      });
      const data = await resp.json();
      setConversationId(data.conversationId);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to get response. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  if (!isExpanded) {
    return (
      <Box
        p={4}
        border="1px dashed"
        borderColor="blue.300"
        borderRadius="lg"
        textAlign="center"
        cursor="pointer"
        _hover={{ bg: 'blue.50', borderColor: 'blue.400' }}
        onClick={() => setIsExpanded(true)}
        className="no-print"
      >
        <HStack justify="center" spacing={2}>
          <Text fontSize="lg">💬</Text>
          <Text fontWeight="bold" color="blue.600">Ask About This Report</Text>
        </HStack>
        <Text fontSize="sm" color="gray.500" mt={1}>
          Click to ask follow-up questions about the analysis, get clarification, or request deeper insights
        </Text>
      </Box>
    );
  }

  return (
    <Box className="no-print" border="1px solid" borderColor={borderColor} borderRadius="lg" overflow="hidden">
      <HStack px={4} py={2} bg="blue.500" color="white" justify="space-between">
        <Text fontWeight="bold" fontSize="sm">Ask About This Report</Text>
        <Box cursor="pointer" onClick={() => setIsExpanded(false)} _hover={{ opacity: 0.8 }}>
          <Text fontSize="xs">Minimize</Text>
        </Box>
      </HStack>

      <Box maxH="300px" overflowY="auto" p={3} bg={chatBg}>
        <VStack spacing={3} align="stretch">
          {messages.length === 0 && (
            <VStack spacing={2} py={3}>
              <Text fontSize="sm" color="gray.500">
                Ask anything about this report — ROI analysis, implementation order, developer assignments, etc.
              </Text>
              <VStack spacing={1} w="full">
                {[
                  'What should we prioritize this sprint?',
                  'Which findings have the highest ROI?',
                  'Summarize the critical issues for my standup',
                ].map((q, i) => (
                  <Box
                    key={i}
                    w="full" px={3} py={1.5}
                    border="1px solid" borderColor={borderColor} borderRadius="md"
                    cursor="pointer" fontSize="xs" color="gray.600"
                    _hover={{ bg: 'blue.50', borderColor: 'blue.200' }}
                    onClick={() => setInput(q)}
                  >
                    {q}
                  </Box>
                ))}
              </VStack>
            </VStack>
          )}

          {messages.map((msg, i) => (
            <Box
              key={i}
              alignSelf={msg.role === 'user' ? 'flex-end' : 'flex-start'}
              maxW="85%"
              px={3} py={2} borderRadius="lg"
              bg={msg.role === 'user' ? 'blue.500' : assistantMsgBg}
              color={msg.role === 'user' ? 'white' : 'inherit'}
              fontSize="sm"
              whiteSpace="pre-wrap"
            >
              {msg.content}
            </Box>
          ))}

          {loading && (
            <HStack spacing={1} px={2}>
              {[0, 1, 2].map(i => (
                <Box key={i} w="6px" h="6px" borderRadius="full" bg="gray.400"
                  style={{ animation: `pulse 0.6s infinite ${i * 0.15}s` }}
                />
              ))}
            </HStack>
          )}
          <div ref={messagesEndRef} />
        </VStack>
      </Box>

      <HStack px={3} py={2} borderTop="1px solid" borderColor={borderColor}>
        <Input
          size="sm" placeholder="Ask about this report..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
          isDisabled={loading}
          borderRadius="full"
        />
        <Button
          size="sm" colorScheme="blue" borderRadius="full"
          onClick={sendMessage}
          isDisabled={!input.trim() || loading}
          isLoading={loading}
        >
          Send
        </Button>
      </HStack>
    </Box>
  );
};

export default CumulativeReport;
