/** Documentation Health View - coverage analysis per repository */

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
  SimpleGrid,
  Spinner,
  Text,
  Progress,
  VStack,
  HStack,
  CircularProgress,
  CircularProgressLabel,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import arangoDBService from '../../services/arangodbService';

interface LanguageCoverage {
  language: string; documented: number; total: number; percentage: number;
}
interface UndocumentedFile {
  file: string; undocumentedItems: number; totalItems: number; coverage: number;
}
interface DocHealthData {
  overallCoverage: number; totalDocumented: number; totalItems: number;
  byLanguage: LanguageCoverage[]; undocumentedFiles: UndocumentedFile[];
}
interface DocHealthViewProps { repositoryId: string; }

function coverageColor(pct: number): string {
  return pct >= 70 ? 'green' : pct >= 40 ? 'yellow' : 'red';
}
function coverageTextColor(pct: number): string {
  return pct >= 70 ? 'green.400' : pct >= 40 ? 'yellow.400' : 'red.400';
}

export default function DocHealthView({ repositoryId }: DocHealthViewProps) {
  const [data, setData] = useState<DocHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDocHealth() {
      setLoading(true);
      setError(null);
      try {
        const results = await arangoDBService.executeAQL(
          `FOR item IN code_entities
             FILTER item.repositoryId == @repositoryId
             COLLECT lang = item.language, file = item.filePath
             AGGREGATE
               totalCount = LENGTH(1),
               docCount = SUM(item.hasDocumentation == true ? 1 : 0)
             RETURN {
               language: lang,
               file: file,
               total: totalCount,
               documented: docCount
             }`,
          { repositoryId }
        );

        if (cancelled) return;

        const rows: Array<{ language: string; file: string; total: number; documented: number }> =
          results || [];

        // Aggregate by language
        const langMap: Record<string, { documented: number; total: number }> = {};
        const fileMap: Record<string, { total: number; documented: number }> = {};
        let totalItems = 0;
        let totalDocumented = 0;

        for (const row of rows) {
          const lang = row.language || 'unknown';
          if (!langMap[lang]) langMap[lang] = { documented: 0, total: 0 };
          langMap[lang].total += row.total;
          langMap[lang].documented += row.documented;

          if (row.file) {
            if (!fileMap[row.file]) fileMap[row.file] = { total: 0, documented: 0 };
            fileMap[row.file].total += row.total;
            fileMap[row.file].documented += row.documented;
          }

          totalItems += row.total;
          totalDocumented += row.documented;
        }

        const byLanguage: LanguageCoverage[] = Object.entries(langMap)
          .map(([language, v]) => ({
            language,
            documented: v.documented,
            total: v.total,
            percentage: v.total > 0 ? Math.round((v.documented / v.total) * 100) : 0,
          }))
          .sort((a, b) => a.percentage - b.percentage);

        const undocumentedFiles: UndocumentedFile[] = Object.entries(fileMap)
          .map(([file, v]) => ({
            file,
            undocumentedItems: v.total - v.documented,
            totalItems: v.total,
            coverage: v.total > 0 ? Math.round((v.documented / v.total) * 100) : 0,
          }))
          .filter((f) => f.undocumentedItems > 0)
          .sort((a, b) => b.undocumentedItems - a.undocumentedItems)
          .slice(0, 15);

        const overallCoverage = totalItems > 0 ? Math.round((totalDocumented / totalItems) * 100) : 0;

        setData({ overallCoverage, totalDocumented, totalItems, byLanguage, undocumentedFiles });
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load documentation health data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDocHealth();
    return () => { cancelled = true; };
  }, [repositoryId]);

  if (loading) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="xl" color="blue.400" />
        <Text mt={4} color="gray.500">Loading documentation health...</Text>
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

  if (!data || data.totalItems === 0) {
    return (
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        No code entities found for documentation analysis.
      </Alert>
    );
  }

  return (
    <Box>
      <Heading size="md" mb={4}>Documentation Health</Heading>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
        {/* Overall Coverage - Circular Progress */}
        <Box bg="gray.800" p={6} borderRadius="md" textAlign="center">
          <CircularProgress
            value={data.overallCoverage}
            size="140px"
            thickness="10px"
            color={coverageTextColor(data.overallCoverage)}
            trackColor="gray.600"
          >
            <CircularProgressLabel color="white" fontSize="2xl" fontWeight="bold">
              {data.overallCoverage}%
            </CircularProgressLabel>
          </CircularProgress>
          <Text mt={3} color="gray.300" fontSize="sm">
            {data.totalDocumented} of {data.totalItems} items documented
          </Text>
          <Badge mt={2} colorScheme={coverageColor(data.overallCoverage)} fontSize="sm">
            {data.overallCoverage >= 70 ? 'Good' : data.overallCoverage >= 40 ? 'Needs Work' : 'Poor'}
          </Badge>
        </Box>

        {/* By Language */}
        <Box bg="gray.800" p={4} borderRadius="md">
          <Heading size="sm" mb={3} color="white">Coverage by Language</Heading>
          <VStack spacing={3} align="stretch">
            {data.byLanguage.map((lc) => (
              <Box key={lc.language}>
                <HStack justify="space-between" mb={1}>
                  <Text fontSize="sm" color="gray.300">{lc.language}</Text>
                  <Text fontSize="sm" color={coverageTextColor(lc.percentage)}>
                    {lc.percentage}%
                  </Text>
                </HStack>
                <Progress
                  value={lc.percentage}
                  colorScheme={coverageColor(lc.percentage)}
                  borderRadius="full"
                  size="sm"
                />
              </Box>
            ))}
          </VStack>
        </Box>
      </SimpleGrid>

      {/* Top Undocumented Files */}
      {data.undocumentedFiles.length > 0 && (
        <Box bg="gray.800" borderRadius="md" overflowX="auto">
          <Heading size="sm" p={4} pb={2} color="white">Top Undocumented Files</Heading>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th color="gray.400">File</Th>
                <Th color="gray.400" isNumeric>Undocumented</Th>
                <Th color="gray.400" isNumeric>Total</Th>
                <Th color="gray.400" isNumeric>Coverage</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.undocumentedFiles.map((f, idx) => (
                <Tr key={idx}>
                  <Td color="white" fontFamily="mono" fontSize="sm" maxW="300px" isTruncated>
                    {f.file}
                  </Td>
                  <Td isNumeric color="red.400" fontSize="sm">{f.undocumentedItems}</Td>
                  <Td isNumeric color="gray.300" fontSize="sm">{f.totalItems}</Td>
                  <Td isNumeric>
                    <Badge colorScheme={coverageColor(f.coverage)} fontSize="xs">
                      {f.coverage}%
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
