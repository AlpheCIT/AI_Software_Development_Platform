/**
 * API Surface View Component
 * Shows all API endpoints detected in a repository with method badges,
 * handler info, and Swagger documentation coverage.
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
  HStack,
  Icon,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { CheckCircle, XCircle } from 'lucide-react';
import arangoDBService from '../../services/arangodbService';

interface APIEndpoint {
  _key?: string;
  method: string;
  path: string;
  handler: string;
  file: string;
  hasSwagger: boolean;
}

interface APISurfaceStats {
  total: number;
  byMethod: Record<string, number>;
  swaggerCovered: number;
}

interface APISurfaceViewProps {
  repositoryId: string;
}

const METHOD_COLOR: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  PATCH: 'teal',
  DELETE: 'red',
  OPTIONS: 'gray',
  HEAD: 'purple',
};

export default function APISurfaceView({ repositoryId }: APISurfaceViewProps) {
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [stats, setStats] = useState<APISurfaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEndpoints() {
      setLoading(true);
      setError(null);
      try {
        const results = await arangoDBService.executeAQL(
          `FOR ep IN api_endpoints
             FILTER ep.repositoryId == @repositoryId
             SORT ep.path ASC
             RETURN ep`,
          { repositoryId }
        );

        if (cancelled) return;

        const eps: APIEndpoint[] = (results || []).map((e: any) => ({
          _key: e._key,
          method: (e.method || 'GET').toUpperCase(),
          path: e.path || e.route || '/',
          handler: e.handler || e.handlerName || 'unknown',
          file: e.file || e.filePath || '',
          hasSwagger: Boolean(e.hasSwagger || e.documented),
        }));

        const byMethod: Record<string, number> = {};
        let swaggerCovered = 0;

        for (const ep of eps) {
          byMethod[ep.method] = (byMethod[ep.method] || 0) + 1;
          if (ep.hasSwagger) swaggerCovered++;
        }

        setEndpoints(eps);
        setStats({ total: eps.length, byMethod, swaggerCovered });
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load API surface data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEndpoints();
    return () => { cancelled = true; };
  }, [repositoryId]);

  if (loading) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="xl" color="blue.400" />
        <Text mt={4} color="gray.500">Loading API surface...</Text>
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
        No API endpoints found for this repository.
      </Alert>
    );
  }

  const coveragePct = Math.round((stats.swaggerCovered / stats.total) * 100);
  const methodEntries = Object.entries(stats.byMethod).sort((a, b) => b[1] - a[1]);

  return (
    <Box>
      <Heading size="md" mb={4}>API Surface</Heading>

      {/* Summary Stats */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={6}>
        <Stat bg="gray.800" p={4} borderRadius="md">
          <StatLabel color="gray.400">Total Endpoints</StatLabel>
          <StatNumber color="white">{stats.total}</StatNumber>
          <StatHelpText color="gray.500">
            {methodEntries.map(([m, c]) => `${c} ${m}`).join(', ')}
          </StatHelpText>
        </Stat>
        <Stat bg="gray.800" p={4} borderRadius="md">
          <StatLabel color="gray.400">By Method</StatLabel>
          <HStack spacing={2} mt={1} flexWrap="wrap">
            {methodEntries.map(([method, count]) => (
              <Badge key={method} colorScheme={METHOD_COLOR[method] || 'gray'} fontSize="xs">
                {method}: {count}
              </Badge>
            ))}
          </HStack>
        </Stat>
        <Stat bg="gray.800" p={4} borderRadius="md">
          <StatLabel color="gray.400">Swagger Coverage</StatLabel>
          <StatNumber color={coveragePct >= 70 ? 'green.400' : coveragePct >= 40 ? 'yellow.400' : 'red.400'}>
            {coveragePct}%
          </StatNumber>
          <StatHelpText color="gray.500">
            {stats.swaggerCovered} of {stats.total} documented
          </StatHelpText>
        </Stat>
      </SimpleGrid>

      {/* Swagger Coverage Bar */}
      <Box bg="gray.800" p={4} borderRadius="md" mb={6}>
        <HStack justify="space-between" mb={2}>
          <Text fontSize="sm" color="gray.300">Documentation Coverage</Text>
          <Text fontSize="sm" color="gray.400">{stats.swaggerCovered}/{stats.total}</Text>
        </HStack>
        <Progress
          value={coveragePct}
          colorScheme={coveragePct >= 70 ? 'green' : coveragePct >= 40 ? 'yellow' : 'red'}
          borderRadius="full"
          size="md"
        />
      </Box>

      {/* Endpoint Table */}
      <Box bg="gray.800" borderRadius="md" overflowX="auto">
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th color="gray.400">Method</Th>
              <Th color="gray.400">Path</Th>
              <Th color="gray.400">Handler</Th>
              <Th color="gray.400">File</Th>
              <Th color="gray.400">Swagger</Th>
            </Tr>
          </Thead>
          <Tbody>
            {endpoints.map((ep, idx) => (
              <Tr key={ep._key || idx}>
                <Td>
                  <Badge colorScheme={METHOD_COLOR[ep.method] || 'gray'} fontSize="xs" minW="50px" textAlign="center">
                    {ep.method}
                  </Badge>
                </Td>
                <Td color="white" fontFamily="mono" fontSize="sm">{ep.path}</Td>
                <Td color="gray.300" fontFamily="mono" fontSize="sm">{ep.handler}</Td>
                <Td color="gray.400" fontSize="sm" maxW="200px" isTruncated>{ep.file}</Td>
                <Td>
                  {ep.hasSwagger ? (
                    <Icon as={CheckCircle} color="green.400" boxSize={4} />
                  ) : (
                    <Icon as={XCircle} color="red.400" boxSize={4} />
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}
