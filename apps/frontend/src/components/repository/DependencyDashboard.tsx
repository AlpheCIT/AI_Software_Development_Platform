/**
 * Dependency Dashboard Component
 * Displays dependency analysis for a given repository including
 * summary stats, language breakdown, and a detailed dependency table.
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
} from '@chakra-ui/react';
import arangoDBService from '../../services/arangodbService';

interface Dependency {
  _key?: string;
  name: string;
  version: string;
  type: 'prod' | 'dev' | 'peer' | 'optional';
  language: string;
  status: 'ok' | 'outdated' | 'vulnerable';
  latestVersion?: string;
  vulnerabilities?: number;
}

interface DependencyStats {
  total: number;
  outdated: number;
  vulnerable: number;
  byLanguage: Record<string, number>;
}

interface DependencyDashboardProps {
  repositoryId: string;
}

const STATUS_COLOR: Record<string, string> = {
  ok: 'green',
  outdated: 'yellow',
  vulnerable: 'red',
};

const TYPE_COLOR: Record<string, string> = {
  prod: 'blue',
  dev: 'purple',
  peer: 'cyan',
  optional: 'gray',
};

export default function DependencyDashboard({ repositoryId }: DependencyDashboardProps) {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [stats, setStats] = useState<DependencyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDependencies() {
      setLoading(true);
      setError(null);
      try {
        const results = await arangoDBService.executeAQL(
          `FOR dep IN dependencies
             FILTER dep.repositoryId == @repositoryId
             SORT dep.name ASC
             RETURN dep`,
          { repositoryId }
        );

        if (cancelled) return;

        const deps: Dependency[] = (results || []).map((d: any) => ({
          _key: d._key,
          name: d.name || d.package || 'unknown',
          version: d.version || 'N/A',
          type: d.type || 'prod',
          language: d.language || 'unknown',
          status: d.status || 'ok',
          latestVersion: d.latestVersion,
          vulnerabilities: d.vulnerabilities || 0,
        }));

        const byLanguage: Record<string, number> = {};
        let outdated = 0;
        let vulnerable = 0;

        for (const dep of deps) {
          byLanguage[dep.language] = (byLanguage[dep.language] || 0) + 1;
          if (dep.status === 'outdated') outdated++;
          if (dep.status === 'vulnerable') vulnerable++;
        }

        setDependencies(deps);
        setStats({ total: deps.length, outdated, vulnerable, byLanguage });
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load dependency data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDependencies();
    return () => { cancelled = true; };
  }, [repositoryId]);

  if (loading) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="xl" color="blue.400" />
        <Text mt={4} color="gray.500">Loading dependency analysis...</Text>
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

  if (!stats || stats.total === 0) {
    return (
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        No dependencies found for this repository.
      </Alert>
    );
  }

  const languageEntries = Object.entries(stats.byLanguage).sort((a, b) => b[1] - a[1]);

  return (
    <Box>
      <Heading size="md" mb={4}>Dependency Analysis</Heading>

      {/* Summary Stats */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={6}>
        <Stat bg="gray.800" p={4} borderRadius="md">
          <StatLabel color="gray.400">Total Dependencies</StatLabel>
          <StatNumber color="white">{stats.total}</StatNumber>
          <StatHelpText color="gray.500">Across all languages</StatHelpText>
        </Stat>
        <Stat bg="gray.800" p={4} borderRadius="md">
          <StatLabel color="gray.400">Outdated</StatLabel>
          <StatNumber color="yellow.400">{stats.outdated}</StatNumber>
          <StatHelpText color="gray.500">
            {stats.total > 0 ? `${Math.round((stats.outdated / stats.total) * 100)}%` : '0%'} of total
          </StatHelpText>
        </Stat>
        <Stat bg="gray.800" p={4} borderRadius="md">
          <StatLabel color="gray.400">Vulnerable</StatLabel>
          <StatNumber color="red.400">{stats.vulnerable}</StatNumber>
          <StatHelpText color="gray.500">
            {stats.total > 0 ? `${Math.round((stats.vulnerable / stats.total) * 100)}%` : '0%'} of total
          </StatHelpText>
        </Stat>
      </SimpleGrid>

      {/* By Language */}
      <Box bg="gray.800" p={4} borderRadius="md" mb={6}>
        <Heading size="sm" mb={3} color="white">By Language</Heading>
        <VStack spacing={2} align="stretch">
          {languageEntries.map(([lang, count]) => (
            <HStack key={lang}>
              <Text w="100px" fontSize="sm" color="gray.300">{lang}</Text>
              <Progress
                flex={1}
                value={(count / stats.total) * 100}
                colorScheme="blue"
                borderRadius="full"
                size="sm"
              />
              <Text fontSize="sm" color="gray.400" w="40px" textAlign="right">{count}</Text>
            </HStack>
          ))}
        </VStack>
      </Box>

      {/* Dependency Table */}
      <Box bg="gray.800" borderRadius="md" overflowX="auto">
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th color="gray.400">Package</Th>
              <Th color="gray.400">Version</Th>
              <Th color="gray.400">Type</Th>
              <Th color="gray.400">Language</Th>
              <Th color="gray.400">Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {dependencies.map((dep, idx) => (
              <Tr key={dep._key || idx}>
                <Td color="white" fontFamily="mono" fontSize="sm">{dep.name}</Td>
                <Td color="gray.300" fontFamily="mono" fontSize="sm">{dep.version}</Td>
                <Td>
                  <Badge colorScheme={TYPE_COLOR[dep.type] || 'gray'} fontSize="xs">
                    {dep.type}
                  </Badge>
                </Td>
                <Td color="gray.300" fontSize="sm">{dep.language}</Td>
                <Td>
                  <Badge colorScheme={STATUS_COLOR[dep.status] || 'gray'} fontSize="xs">
                    {dep.status}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}
