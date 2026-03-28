import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Badge,
  Text,
  Heading,
  Spinner,
  Alert,
  AlertIcon,
  useColorModeValue,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Divider,
  Tag,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Flex,
  List,
  ListItem,
  ListIcon,
} from '@chakra-ui/react';
import { arangoDBService } from '../../services/arangodbService';

// =====================================================
// TYPES
// =====================================================

interface VerifiedFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  file: string;
  line: number;
  confidence: number;
  verificationMethod: string;
  challengerNotes: string;
  evidence: string;
  recommendation: string;
}

interface AnalysisRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  effort: string;
}

interface ReportData {
  repositoryId: string;
  analysisType: string;
  healthScore: number;
  totalProposed: number;
  totalVerified: number;
  totalFalsePositives: number;
  findings: VerifiedFinding[];
  recommendations: AnalysisRecommendation[];
  timestamp: string;
}

interface AnalysisReportProps {
  repositoryId: string;
  analysisType?: string;
}

// =====================================================
// SEVERITY HELPERS
// =====================================================

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'blue',
  info: 'gray',
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const PRIORITY_ICONS: Record<string, string> = {
  critical: '\uD83D\uDD34',
  high: '\uD83D\uDFE0',
  medium: '\uD83D\uDFE1',
  low: '\uD83D\uDD35',
};

function computeHealthScore(findings: VerifiedFinding[]): number {
  if (findings.length === 0) return 100;
  const weights: Record<string, number> = { critical: 25, high: 15, medium: 8, low: 3, info: 1 };
  const penalty = findings.reduce((sum, f) => sum + (weights[f.severity] || 0), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function getHealthColor(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  if (score >= 40) return 'orange';
  return 'red';
}

// =====================================================
// ANALYSIS REPORT COMPONENT
// =====================================================

export const AnalysisReport: React.FC<AnalysisReportProps> = ({
  repositoryId,
  analysisType = 'security',
}) => {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const tableBg = useColorModeValue('gray.50', 'gray.700');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await arangoDBService.executeAQL(
        `FOR d IN doc_agent_analyses
          FILTER d.repositoryId == @repoId
            AND d.analysisType == @type
            AND d.verifiedFindings != null
          SORT d.created_at DESC
          LIMIT 1
          RETURN d`,
        { repoId: repositoryId, type: analysisType }
      );

      if (results.length > 0) {
        const raw = results[0];

        const findings: VerifiedFinding[] = (raw.verifiedFindings || [])
          .filter((f: any) => f.verified !== false)
          .map((f: any) => ({
            id: f.id || f._key || Math.random().toString(36).slice(2),
            severity: f.severity || 'medium',
            title: f.title || f.description || 'Untitled finding',
            file: f.file || f.filePath || f.location?.file || '',
            line: f.line || f.lineNumber || f.location?.line || 0,
            confidence: f.confidence || f.confidenceScore || 0,
            verificationMethod: f.verificationMethod || f.verifiedBy || 'debate',
            challengerNotes: f.challengerNotes || f.challengerComment || '',
            evidence: f.evidence || f.codeSnippet || '',
            recommendation: f.recommendation || f.fix || '',
          }))
          .sort(
            (a: VerifiedFinding, b: VerifiedFinding) =>
              (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4)
          );

        const recommendations: AnalysisRecommendation[] = (
          raw.recommendations || []
        ).map((r: any) => ({
          priority: r.priority || 'medium',
          title: r.title || r.name || 'Untitled',
          description: r.description || r.detail || '',
          effort: r.effort || r.estimate || 'Unknown',
        }));

        const totalProposed = raw.totalProposed || 0;
        const totalVerified = raw.totalVerified || findings.length;
        const totalFP = raw.totalFalsePositives || totalProposed - totalVerified;

        setReport({
          repositoryId,
          analysisType,
          healthScore: raw.healthScore || computeHealthScore(findings),
          totalProposed,
          totalVerified,
          totalFalsePositives: totalFP,
          findings,
          recommendations,
          timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
        });
      } else {
        setReport(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis report');
    } finally {
      setLoading(false);
    }
  }, [repositoryId, analysisType]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="lg" />
        <Text mt={3} color="gray.500">Loading analysis report...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        {error}
      </Alert>
    );
  }

  if (!report) {
    return (
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        No verified analysis report found. Run a debate-based analysis to generate a report.
      </Alert>
    );
  }

  return (
    <Box bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor} p={6}>
      {/* Header with Health Score */}
      <HStack justify="space-between" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="md">Verified Analysis Report</Heading>
          <Text fontSize="sm" color="gray.500">
            {report.analysisType.charAt(0).toUpperCase() + report.analysisType.slice(1)} analysis
            {' \u2022 '}
            {new Date(report.timestamp).toLocaleDateString()}
          </Text>
        </VStack>

        <VStack spacing={0}>
          <Badge
            colorScheme={getHealthColor(report.healthScore)}
            fontSize="2xl"
            px={4}
            py={2}
            borderRadius="lg"
          >
            {report.healthScore}
          </Badge>
          <Text fontSize="xs" color="gray.500">Health Score</Text>
        </VStack>
      </HStack>

      <Divider mb={6} />

      {/* Verified Findings Table */}
      <Heading size="sm" mb={4}>
        Verified Findings ({report.findings.length})
      </Heading>

      {report.findings.length === 0 ? (
        <Alert status="success" borderRadius="md" mb={6}>
          <AlertIcon />
          No verified issues found. Your codebase passed all checks.
        </Alert>
      ) : (
        <Accordion allowMultiple mb={6}>
          {report.findings.map((finding) => (
            <AccordionItem key={finding.id} border="1px solid" borderColor={borderColor} borderRadius="md" mb={2}>
              <AccordionButton py={3}>
                <HStack flex={1} spacing={3}>
                  <Badge colorScheme={SEVERITY_COLORS[finding.severity]} minW="70px" textAlign="center">
                    {finding.severity.toUpperCase()}
                  </Badge>
                  <Text fontWeight="medium" fontSize="sm" flex={1} textAlign="left">
                    {finding.title}
                  </Text>
                  <Tag size="sm" colorScheme="gray" fontSize="xs">
                    {finding.file}{finding.line > 0 ? `:${finding.line}` : ''}
                  </Tag>
                  <Tag size="sm" colorScheme="blue" fontSize="xs">
                    {finding.confidence}% confidence
                  </Tag>
                </HStack>
                <AccordionIcon />
              </AccordionButton>

              <AccordionPanel pb={4} bg={tableBg}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Box>
                    <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>
                      Verification Method
                    </Text>
                    <Tag colorScheme="green" size="sm">{finding.verificationMethod}</Tag>
                  </Box>
                  <Box>
                    <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>
                      Challenger Notes
                    </Text>
                    <Text fontSize="sm">{finding.challengerNotes || 'No notes'}</Text>
                  </Box>
                </SimpleGrid>

                {finding.evidence && (
                  <Box mt={3}>
                    <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>
                      Evidence
                    </Text>
                    <Box
                      bg={useColorModeValue('gray.100', 'gray.900')}
                      p={3}
                      borderRadius="md"
                      fontFamily="mono"
                      fontSize="xs"
                      whiteSpace="pre-wrap"
                      overflowX="auto"
                    >
                      {finding.evidence}
                    </Box>
                  </Box>
                )}

                {finding.recommendation && (
                  <Box mt={3}>
                    <Text fontWeight="bold" fontSize="xs" color="gray.500" mb={1}>
                      Recommendation
                    </Text>
                    <Text fontSize="sm">{finding.recommendation}</Text>
                  </Box>
                )}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <>
          <Heading size="sm" mb={4}>
            Recommendations ({report.recommendations.length})
          </Heading>
          <List spacing={3} mb={6}>
            {report.recommendations.map((rec, idx) => (
              <ListItem
                key={idx}
                p={3}
                bg={tableBg}
                borderRadius="md"
                borderLeft="4px solid"
                borderLeftColor={`${SEVERITY_COLORS[rec.priority] || 'gray'}.400`}
              >
                <HStack mb={1}>
                  <Text>{PRIORITY_ICONS[rec.priority] || ''}</Text>
                  <Text fontWeight="bold" fontSize="sm">{rec.title}</Text>
                  <Badge colorScheme={SEVERITY_COLORS[rec.priority]} size="sm">
                    {rec.priority}
                  </Badge>
                  {rec.effort && (
                    <Tag size="sm" colorScheme="purple" ml="auto">
                      {rec.effort}
                    </Tag>
                  )}
                </HStack>
                <Text fontSize="sm" color="gray.600">{rec.description}</Text>
              </ListItem>
            ))}
          </List>
        </>
      )}

      {/* Debate Metrics Footer */}
      <Divider mb={4} />
      <Flex
        justify="center"
        align="center"
        py={3}
        px={4}
        bg={tableBg}
        borderRadius="md"
        fontSize="sm"
        color="gray.500"
      >
        <Text>
          {report.totalProposed} findings proposed
          {' \u2192 '}
          <Text as="span" color="green.500" fontWeight="bold">{report.totalVerified} verified</Text>
          {' ('}
          <Text as="span" color="red.400" fontWeight="bold">{report.totalFalsePositives} false positives caught</Text>
          {')'}
        </Text>
      </Flex>
    </Box>
  );
};

export default AnalysisReport;
