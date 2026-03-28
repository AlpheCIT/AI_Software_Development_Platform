/**
 * Documentation Coverage Dashboard
 *
 * Displays documentation coverage metrics for an ingested repository,
 * including overall grade, per-file breakdown, undocumented items,
 * recommendations, and available auto-doc tools.
 *
 * Data source: `documentation_coverage` ArangoDB collection
 * (populated during ingestion by DocCoverageAnalyzer).
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Spinner,
  Text,
  Progress,
  VStack,
  HStack,
  Alert,
  AlertIcon,
  Divider,
  List,
  ListItem,
  ListIcon,
  Tooltip,
  Tag,
} from '@chakra-ui/react';
import {
  CheckCircleIcon,
  WarningIcon,
  InfoIcon,
} from '@chakra-ui/icons';
import arangoDBService from '../../services/arangodbService';

// =====================================================
// INTERFACES
// =====================================================

interface FileDocCoverage {
  _key: string;
  repositoryId: string;
  filePath: string;
  language: string;
  hasFileLevelDoc: boolean;
  totalFunctions: number;
  documentedFunctions: number;
  coveragePercent: number;
  undocumentedItems: string[];
  docStyle: string;
}

interface RepoDocSummary {
  repositoryId: string;
  totalFiles: number;
  analyzedFiles: number;
  overallCoveragePercent: number;
  byLanguage: Record<string, { files: number; coverage: number }>;
  topUndocumented: Array<{ file: string; coverage: number }>;
}

interface AutoDocTool {
  tool: string;
  projectType: string;
  configDetected: boolean;
  outputFormat: string;
  command: string;
  available: boolean;
}

interface DocCoverageDashboardProps {
  repositoryId: string;
}

// =====================================================
// HELPERS
// =====================================================

function coverageToGrade(coverage: number): string {
  if (coverage >= 90) return 'A';
  if (coverage >= 80) return 'B';
  if (coverage >= 60) return 'C';
  if (coverage >= 40) return 'D';
  return 'F';
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'green';
    case 'B': return 'teal';
    case 'C': return 'yellow';
    case 'D': return 'orange';
    case 'F': return 'red';
    default: return 'gray';
  }
}

function coverageBarColor(coverage: number): string {
  if (coverage >= 80) return 'green';
  if (coverage >= 60) return 'yellow';
  return 'red';
}

function languageBadgeColor(language: string): string {
  switch (language) {
    case 'typescript': return 'blue';
    case 'javascript': return 'yellow';
    case 'python': return 'green';
    case 'java': return 'orange';
    default: return 'gray';
  }
}

// =====================================================
// COMPONENT
// =====================================================

export default function DocCoverageDashboard({ repositoryId }: DocCoverageDashboardProps) {
  const [summary, setSummary] = useState<RepoDocSummary | null>(null);
  const [files, setFiles] = useState<FileDocCoverage[]>([]);
  const [docTools, setDocTools] = useState<AutoDocTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCoverageData();
  }, [repositoryId]);

  async function loadCoverageData() {
    setLoading(true);
    setError(null);

    try {
      // Fetch file-level coverage data
      const fileResults = await arangoDBService.query(
        `FOR doc IN documentation_coverage
           FILTER doc.repositoryId == @repoId
           SORT doc.coveragePercent ASC
           RETURN doc`,
        { repoId: repositoryId }
      );
      setFiles(fileResults || []);

      // Fetch summary if stored separately
      try {
        const summaryResults = await arangoDBService.query(
          `FOR doc IN doc_coverage_summaries
             FILTER doc.repositoryId == @repoId
             SORT doc._key DESC
             LIMIT 1
             RETURN doc`,
          { repoId: repositoryId }
        );
        if (summaryResults && summaryResults.length > 0) {
          setSummary(summaryResults[0]);
        } else {
          // Build summary from file data
          setSummary(buildSummaryFromFiles(fileResults || [], repositoryId));
        }
      } catch {
        // Build summary from file data
        setSummary(buildSummaryFromFiles(fileResults || [], repositoryId));
      }

      // Fetch auto-doc tool detection results
      try {
        const toolResults = await arangoDBService.query(
          `FOR doc IN auto_doc_tools
             FILTER doc.repositoryId == @repoId
             RETURN doc`,
          { repoId: repositoryId }
        );
        setDocTools(toolResults || []);
      } catch {
        setDocTools([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load documentation coverage data');
    } finally {
      setLoading(false);
    }
  }

  function buildSummaryFromFiles(fileData: FileDocCoverage[], repoId: string): RepoDocSummary {
    let totalFunctions = 0;
    let documentedFunctions = 0;
    const byLanguage: Record<string, { files: number; coverageSum: number }> = {};

    for (const f of fileData) {
      totalFunctions += f.totalFunctions;
      documentedFunctions += f.documentedFunctions;
      if (!byLanguage[f.language]) byLanguage[f.language] = { files: 0, coverageSum: 0 };
      byLanguage[f.language].files++;
      byLanguage[f.language].coverageSum += f.coveragePercent;
    }

    const byLangFinal: Record<string, { files: number; coverage: number }> = {};
    for (const [lang, data] of Object.entries(byLanguage)) {
      byLangFinal[lang] = {
        files: data.files,
        coverage: data.files > 0 ? Math.round(data.coverageSum / data.files * 100) / 100 : 0,
      };
    }

    const overall = totalFunctions > 0
      ? Math.round((documentedFunctions / totalFunctions) * 10000) / 100
      : 100;

    const topUndocumented = fileData
      .filter(f => f.totalFunctions > 0)
      .sort((a, b) => a.coveragePercent - b.coveragePercent)
      .slice(0, 10)
      .map(f => ({ file: f.filePath, coverage: f.coveragePercent }));

    return {
      repositoryId: repoId,
      totalFiles: fileData.length,
      analyzedFiles: fileData.length,
      overallCoveragePercent: overall,
      byLanguage: byLangFinal,
      topUndocumented,
    };
  }

  // =====================================================
  // RENDER: LOADING / ERROR / EMPTY STATES
  // =====================================================

  if (loading) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="xl" />
        <Text mt={4}>Loading documentation coverage data...</Text>
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

  if (!summary || files.length === 0) {
    return (
      <Box p={8} textAlign="center" bg="gray.50" borderRadius="lg" border="1px" borderColor="gray.200">
        <InfoIcon boxSize={10} color="gray.400" mb={4} />
        <Heading size="md" color="gray.500">No Documentation Coverage Data</Heading>
        <Text mt={2} color="gray.400">
          Ingest a repository to measure documentation coverage.
        </Text>
      </Box>
    );
  }

  // =====================================================
  // RENDER: DASHBOARD
  // =====================================================

  const grade = coverageToGrade(summary.overallCoveragePercent);
  const recommendations = generateRecommendations(summary, files);

  return (
    <VStack spacing={6} align="stretch">
      {/* Header with Grade */}
      <HStack justify="space-between" align="center">
        <Heading size="lg">Documentation Coverage</Heading>
        <Badge
          fontSize="2xl"
          px={4}
          py={2}
          borderRadius="lg"
          colorScheme={gradeColor(grade)}
          variant="solid"
        >
          Grade: {grade}
        </Badge>
      </HStack>

      {/* Overall Coverage Bar */}
      <Box bg="white" p={4} borderRadius="md" shadow="sm" border="1px" borderColor="gray.100">
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="bold">Overall Coverage</Text>
          <Text fontWeight="bold" color={`${coverageBarColor(summary.overallCoveragePercent)}.600`}>
            {summary.overallCoveragePercent.toFixed(1)}%
          </Text>
        </HStack>
        <Progress
          value={summary.overallCoveragePercent}
          colorScheme={coverageBarColor(summary.overallCoveragePercent)}
          size="lg"
          borderRadius="md"
          hasStripe
        />
      </Box>

      {/* Summary Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        <Stat bg="white" p={4} borderRadius="md" shadow="sm" border="1px" borderColor="gray.100">
          <StatLabel>Total Files</StatLabel>
          <StatNumber>{summary.totalFiles}</StatNumber>
          <StatHelpText>{summary.analyzedFiles} analyzed</StatHelpText>
        </Stat>

        <Stat bg="white" p={4} borderRadius="md" shadow="sm" border="1px" borderColor="gray.100">
          <StatLabel>Documented Items</StatLabel>
          <StatNumber>
            {files.reduce((s, f) => s + f.documentedFunctions, 0)}
          </StatNumber>
          <StatHelpText>
            of {files.reduce((s, f) => s + f.totalFunctions, 0)} total
          </StatHelpText>
        </Stat>

        <Stat bg="white" p={4} borderRadius="md" shadow="sm" border="1px" borderColor="gray.100">
          <StatLabel>Languages</StatLabel>
          <StatNumber>{Object.keys(summary.byLanguage).length}</StatNumber>
          <StatHelpText>
            {Object.keys(summary.byLanguage).join(', ')}
          </StatHelpText>
        </Stat>

        <Stat bg="white" p={4} borderRadius="md" shadow="sm" border="1px" borderColor="gray.100">
          <StatLabel>Needs Attention</StatLabel>
          <StatNumber>{files.filter(f => f.coveragePercent < 50 && f.totalFunctions > 0).length}</StatNumber>
          <StatHelpText>files below 50% coverage</StatHelpText>
        </Stat>
      </SimpleGrid>

      {/* Language Breakdown */}
      {Object.keys(summary.byLanguage).length > 0 && (
        <Box bg="white" p={4} borderRadius="md" shadow="sm" border="1px" borderColor="gray.100">
          <Heading size="sm" mb={3}>Coverage by Language</Heading>
          <VStack spacing={3} align="stretch">
            {Object.entries(summary.byLanguage).map(([lang, data]) => (
              <HStack key={lang} justify="space-between">
                <HStack>
                  <Badge colorScheme={languageBadgeColor(lang)}>{lang}</Badge>
                  <Text fontSize="sm" color="gray.500">{data.files} files</Text>
                </HStack>
                <HStack flex={1} mx={4}>
                  <Progress
                    value={data.coverage}
                    flex={1}
                    colorScheme={coverageBarColor(data.coverage)}
                    size="sm"
                    borderRadius="md"
                  />
                </HStack>
                <Text fontWeight="bold" fontSize="sm" minW="50px" textAlign="right">
                  {data.coverage.toFixed(1)}%
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      {/* Per-File Coverage Table */}
      <Box bg="white" p={4} borderRadius="md" shadow="sm" border="1px" borderColor="gray.100" overflowX="auto">
        <Heading size="sm" mb={3}>Per-File Coverage</Heading>
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th>File</Th>
              <Th isNumeric>Coverage</Th>
              <Th isNumeric>Documented / Total</Th>
              <Th>Grade</Th>
              <Th>Language</Th>
            </Tr>
          </Thead>
          <Tbody>
            {files
              .filter(f => f.totalFunctions > 0)
              .slice(0, 50)
              .map((f) => {
                const fileGrade = coverageToGrade(f.coveragePercent);
                return (
                  <Tr key={f._key || f.filePath}>
                    <Td>
                      <Tooltip label={f.filePath} placement="top">
                        <Text fontSize="sm" isTruncated maxW="400px">
                          {f.filePath}
                        </Text>
                      </Tooltip>
                    </Td>
                    <Td isNumeric>
                      <HStack justify="flex-end" spacing={2}>
                        <Progress
                          value={f.coveragePercent}
                          w="80px"
                          colorScheme={coverageBarColor(f.coveragePercent)}
                          size="xs"
                          borderRadius="md"
                        />
                        <Text fontSize="sm" minW="45px" textAlign="right">
                          {f.coveragePercent.toFixed(0)}%
                        </Text>
                      </HStack>
                    </Td>
                    <Td isNumeric>
                      {f.documentedFunctions} / {f.totalFunctions}
                    </Td>
                    <Td>
                      <Badge colorScheme={gradeColor(fileGrade)} size="sm">
                        {fileGrade}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme={languageBadgeColor(f.language)} variant="outline" size="sm">
                        {f.language}
                      </Badge>
                    </Td>
                  </Tr>
                );
              })}
          </Tbody>
        </Table>
        {files.filter(f => f.totalFunctions > 0).length > 50 && (
          <Text fontSize="sm" color="gray.500" mt={2} textAlign="center">
            Showing 50 of {files.filter(f => f.totalFunctions > 0).length} files
          </Text>
        )}
      </Box>

      {/* Undocumented Items Needing Attention */}
      {summary.topUndocumented.length > 0 && (
        <Box bg="white" p={4} borderRadius="md" shadow="sm" border="1px" borderColor="gray.100">
          <Heading size="sm" mb={3}>Files Needing Documentation</Heading>
          <List spacing={2}>
            {summary.topUndocumented.map((item, idx) => (
              <ListItem key={idx} fontSize="sm">
                <ListIcon
                  as={item.coverage < 30 ? WarningIcon : InfoIcon}
                  color={item.coverage < 30 ? 'red.500' : 'yellow.500'}
                />
                <Text as="span" fontWeight="medium">{item.file}</Text>
                <Text as="span" color="gray.500" ml={2}>
                  ({item.coverage.toFixed(0)}% coverage)
                </Text>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Box bg="white" p={4} borderRadius="md" shadow="sm" border="1px" borderColor="gray.100">
          <Heading size="sm" mb={3}>Recommendations</Heading>
          <List spacing={2}>
            {recommendations.map((rec, idx) => (
              <ListItem key={idx} fontSize="sm">
                <ListIcon as={CheckCircleIcon} color="blue.500" />
                {rec}
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Auto-Doc Tool Availability */}
      {docTools.length > 0 && (
        <Box bg="white" p={4} borderRadius="md" shadow="sm" border="1px" borderColor="gray.100">
          <Heading size="sm" mb={3}>Documentation Tools Available</Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            {docTools.map((tool, idx) => (
              <HStack
                key={idx}
                p={3}
                borderRadius="md"
                border="1px"
                borderColor={tool.available ? 'green.200' : 'gray.200'}
                bg={tool.available ? 'green.50' : 'gray.50'}
              >
                <VStack align="start" spacing={0} flex={1}>
                  <HStack>
                    <Text fontWeight="bold" fontSize="sm">{tool.tool}</Text>
                    <Tag size="sm" colorScheme={tool.available ? 'green' : 'gray'}>
                      {tool.available ? 'Installed' : 'Not Installed'}
                    </Tag>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    {tool.projectType} - {tool.outputFormat}
                  </Text>
                  <Text fontSize="xs" color="gray.400" fontFamily="mono">
                    {tool.command}
                  </Text>
                </VStack>
                {tool.configDetected && (
                  <Tooltip label="Config file detected">
                    <CheckCircleIcon color="green.500" />
                  </Tooltip>
                )}
              </HStack>
            ))}
          </SimpleGrid>
        </Box>
      )}
    </VStack>
  );
}

// =====================================================
// RECOMMENDATION GENERATOR (CLIENT-SIDE)
// =====================================================

function generateRecommendations(summary: RepoDocSummary, files: FileDocCoverage[]): string[] {
  const recs: string[] = [];

  if (summary.overallCoveragePercent < 40) {
    recs.push('Documentation coverage is critically low. Prioritize adding JSDoc/docstrings to all public APIs.');
  } else if (summary.overallCoveragePercent < 60) {
    recs.push('Documentation coverage needs improvement. Focus on exported functions and classes first.');
  } else if (summary.overallCoveragePercent < 80) {
    recs.push('Documentation coverage is fair. Fill remaining gaps in key modules.');
  } else {
    recs.push('Documentation coverage is good. Maintain this level as the codebase evolves.');
  }

  const worstFiles = files.filter(f => f.coveragePercent < 30 && f.totalFunctions > 3);
  if (worstFiles.length > 0) {
    recs.push(
      `${worstFiles.length} file(s) have less than 30% coverage with 4+ exports. These are high-priority targets.`
    );
  }

  const filesWithNoDoc = files.filter(f => f.coveragePercent === 0 && f.totalFunctions > 0);
  if (filesWithNoDoc.length > 0) {
    recs.push(
      `${filesWithNoDoc.length} file(s) have zero documentation. Start with file-level comments and key function docs.`
    );
  }

  for (const [lang, data] of Object.entries(summary.byLanguage)) {
    if (data.coverage < 50 && data.files > 3) {
      recs.push(`${lang} files average only ${data.coverage.toFixed(0)}% coverage across ${data.files} files.`);
    }
  }

  return recs;
}
