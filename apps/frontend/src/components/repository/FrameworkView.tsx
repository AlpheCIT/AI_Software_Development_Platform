/** Framework View - detected frameworks, middleware, and security coverage */

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
  VStack,
  HStack,
  Icon,
  Card,
  CardBody,
  Progress,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { CheckCircle, XCircle, Shield } from 'lucide-react';
import arangoDBService from '../../services/arangodbService';

interface Framework {
  _key?: string; name: string; version: string;
  language: string; confidence: number; category: string;
}

interface Middleware {
  _key?: string; name: string; package: string;
  category: string; framework: string;
}

interface SecurityCheck { name: string; present: boolean; middleware?: string; }

interface FrameworkViewProps { repositoryId: string; }

const CATEGORY_COLOR: Record<string, string> = {
  web: 'blue', testing: 'purple', orm: 'teal', ui: 'cyan',
  build: 'orange', auth: 'green', security: 'red', logging: 'yellow',
};
const SECURITY_CHECKS = ['CORS', 'Helmet', 'Rate Limiting', 'Auth'];

export default function FrameworkView({ repositoryId }: FrameworkViewProps) {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [middlewares, setMiddlewares] = useState<Middleware[]>([]);
  const [securityChecks, setSecurityChecks] = useState<SecurityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch frameworks and middlewares in parallel
        const [fwResults, mwResults] = await Promise.all([
          arangoDBService.executeAQL(
            `FOR fw IN frameworks
               FILTER fw.repositoryId == @repositoryId
               SORT fw.confidence DESC
               RETURN fw`,
            { repositoryId }
          ),
          arangoDBService.executeAQL(
            `FOR mw IN middlewares
               FILTER mw.repositoryId == @repositoryId
               SORT mw.name ASC
               RETURN mw`,
            { repositoryId }
          ),
        ]);

        if (cancelled) return;

        const fws: Framework[] = (fwResults || []).map((f: any) => ({
          _key: f._key,
          name: f.name || 'unknown',
          version: f.version || 'N/A',
          language: f.language || 'unknown',
          confidence: typeof f.confidence === 'number' ? f.confidence : 0,
          category: f.category || 'other',
        }));

        const mws: Middleware[] = (mwResults || []).map((m: any) => ({
          _key: m._key,
          name: m.name || 'unknown',
          package: m.package || m.packageName || m.name || '',
          category: m.category || 'general',
          framework: m.framework || m.associatedFramework || '',
        }));

        // Derive security checks from middleware names
        const mwNamesLower = mws.map((m) => m.name.toLowerCase());
        const checks: SecurityCheck[] = SECURITY_CHECKS.map((check) => {
          const lower = check.toLowerCase().replace(/\s+/g, '');
          const matchIdx = mwNamesLower.findIndex(
            (n) => n.includes(lower) || n.includes(check.toLowerCase())
          );
          return {
            name: check,
            present: matchIdx >= 0,
            middleware: matchIdx >= 0 ? mws[matchIdx].name : undefined,
          };
        });

        setFrameworks(fws);
        setMiddlewares(mws);
        setSecurityChecks(checks);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load framework data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [repositoryId]);

  if (loading) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="xl" color="blue.400" />
        <Text mt={4} color="gray.500">Loading framework analysis...</Text>
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

  if (frameworks.length === 0 && middlewares.length === 0) {
    return (
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        No frameworks or middleware detected for this repository.
      </Alert>
    );
  }

  const securityScore = Math.round(
    (securityChecks.filter((s) => s.present).length / securityChecks.length) * 100
  );

  return (
    <Box>
      <Heading size="md" mb={4}>Frameworks & Middleware</Heading>

      {/* Framework Cards */}
      {frameworks.length > 0 && (
        <Box mb={6}>
          <Heading size="sm" mb={3} color="white">Detected Frameworks</Heading>
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
            {frameworks.map((fw, idx) => (
              <Card key={fw._key || idx} bg="gray.800" variant="outline" borderColor="gray.700">
                <CardBody p={4}>
                  <HStack justify="space-between" mb={2}>
                    <Text color="white" fontWeight="bold" fontSize="md">{fw.name}</Text>
                    <Badge colorScheme={CATEGORY_COLOR[fw.category] || 'gray'} fontSize="xs">
                      {fw.category}
                    </Badge>
                  </HStack>
                  <Text fontSize="xs" color="gray.400">
                    v{fw.version} &middot; {fw.language} &middot; {Math.round(fw.confidence * 100)}% confidence
                  </Text>
                  <Progress value={fw.confidence * 100} size="xs" borderRadius="full"
                    colorScheme={fw.confidence >= 0.8 ? 'green' : fw.confidence >= 0.5 ? 'yellow' : 'red'} />
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </Box>
      )}

      {/* Security Coverage Checklist */}
      <Box bg="gray.800" p={4} borderRadius="md" mb={6}>
        <HStack mb={3}>
          <Icon as={Shield} color="blue.400" boxSize={5} />
          <Heading size="sm" color="white">Security Middleware Coverage</Heading>
          <Badge
            ml="auto"
            colorScheme={securityScore >= 75 ? 'green' : securityScore >= 50 ? 'yellow' : 'red'}
          >
            {securityScore}%
          </Badge>
        </HStack>
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
          {securityChecks.map((check) => (
            <HStack key={check.name} bg="gray.750" p={2} borderRadius="md">
              <Icon as={check.present ? CheckCircle : XCircle}
                color={check.present ? 'green.400' : 'red.400'} boxSize={4} />
              <Text fontSize="sm" color={check.present ? 'green.300' : 'red.300'}>
                {check.name}
              </Text>
            </HStack>
          ))}
        </SimpleGrid>
      </Box>

      {/* Middleware Table */}
      {middlewares.length > 0 && (
        <Box bg="gray.800" borderRadius="md" overflowX="auto">
          <Heading size="sm" p={4} pb={2} color="white">Middleware Inventory</Heading>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th color="gray.400">Name</Th>
                <Th color="gray.400">Package</Th>
                <Th color="gray.400">Category</Th>
                <Th color="gray.400">Framework</Th>
              </Tr>
            </Thead>
            <Tbody>
              {middlewares.map((mw, idx) => (
                <Tr key={mw._key || idx}>
                  <Td color="white" fontSize="sm">{mw.name}</Td>
                  <Td color="gray.300" fontFamily="mono" fontSize="sm">{mw.package}</Td>
                  <Td>
                    <Badge colorScheme={CATEGORY_COLOR[mw.category] || 'gray'} fontSize="xs">
                      {mw.category}
                    </Badge>
                  </Td>
                  <Td color="gray.400" fontSize="sm">{mw.framework || '-'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
