/**
 * APIValidatorPanel - Displays structured report data from the API Validator agent
 * Shows endpoint inventory, security gaps, schema issues, and missing error handling
 */

import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Code,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  useColorModeValue,
  Progress,
  Tag,
  Alert,
  AlertIcon,
  Divider,
  Tooltip,
  Icon,
} from '@chakra-ui/react';
import {
  Shield,
  CheckCircle,
  XCircle,
  Globe,
  Lock,
  AlertTriangle,
  FileWarning,
  Zap,
} from 'lucide-react';
import type { APIValidationReport } from '../../services/qaService';

interface APIValidatorPanelProps {
  report: APIValidationReport;
}

const severityColor: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
};

const methodColor: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple',
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge colorScheme={severityColor[severity] || 'gray'} fontSize="2xs">
      {severity}
    </Badge>
  );
}

function BooleanIndicator({ value, label }: { value: boolean; label: string }) {
  return (
    <Tooltip label={label}>
      {value ? (
        <Box color="green.500"><CheckCircle size={14} /></Box>
      ) : (
        <Box color="red.500"><XCircle size={14} /></Box>
      )}
    </Tooltip>
  );
}

function EmptyState({ message }: { message: string }) {
  const color = useColorModeValue('gray.500', 'gray.400');
  return (
    <HStack py={3} justify="center">
      <CheckCircle size={14} />
      <Text fontSize="sm" color={color}>{message}</Text>
    </HStack>
  );
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  const textColor = useColorModeValue('gray.700', 'gray.200');
  return (
    <HStack spacing={2} mb={2}>
      {icon}
      <Text fontSize="sm" fontWeight="bold" color={textColor}>{title}</Text>
      {count > 0 && <Badge colorScheme="gray" fontSize="2xs">{count}</Badge>}
    </HStack>
  );
}

export default function APIValidatorPanel({ report }: APIValidatorPanelProps) {
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const scoreColor = report.apiHealthScore >= 80 ? 'green' : report.apiHealthScore >= 60 ? 'yellow' : report.apiHealthScore >= 40 ? 'orange' : 'red';

  return (
    <VStack spacing={4} align="stretch" p={4} bg={bg} borderRadius="lg" border="1px solid" borderColor={borderColor}>
      {/* Header: API Health Score + Stats */}
      <HStack spacing={4} align="center">
        <Box position="relative" w="64px" h="64px">
          <Progress
            value={report.apiHealthScore}
            size="lg"
            colorScheme={scoreColor}
            borderRadius="full"
            h="64px"
            w="64px"
            sx={{
              '& > div': { borderRadius: 'full' },
              borderRadius: 'full',
            }}
          />
          <Box
            position="absolute"
            top="0"
            left="0"
            w="64px"
            h="64px"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <VStack spacing={0}>
              <Text fontSize="lg" fontWeight="bold" color={`${scoreColor}.500`}>
                {report.apiHealthScore}
              </Text>
              <Text fontSize="2xs" color="gray.500">API</Text>
            </VStack>
          </Box>
        </Box>
        <VStack align="start" spacing={1} flex={1}>
          <HStack>
            <Icon as={Shield} boxSize={4} color="blue.500" />
            <Text fontSize="md" fontWeight="bold">API Validation Report</Text>
          </HStack>
          <Text fontSize="sm" color="gray.500">{report.summary}</Text>
          <HStack spacing={2} flexWrap="wrap">
            <Tag size="sm" colorScheme="blue">{report.endpoints.length} Endpoints</Tag>
            <Tag size="sm" colorScheme="red">{report.securityGaps.length} Security Gaps</Tag>
            <Tag size="sm" colorScheme="orange">{report.schemaIssues.length} Schema Issues</Tag>
            <Tag size="sm" colorScheme="yellow">{report.missingErrorHandling.length} Missing Error Handling</Tag>
          </HStack>
        </VStack>
      </HStack>

      <Divider />

      {/* Section 1: Endpoint Inventory */}
      <Box>
        <SectionHeader
          icon={<Globe size={14} color="blue" />}
          title="Endpoint Inventory"
          count={report.endpoints.length}
        />
        {report.endpoints.length === 0 ? (
          <EmptyState message="No endpoints found" />
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th fontSize="2xs">Method</Th>
                  <Th fontSize="2xs">Path</Th>
                  <Th fontSize="2xs">File</Th>
                  <Th fontSize="2xs" textAlign="center">Error Handling</Th>
                  <Th fontSize="2xs" textAlign="center">Validation</Th>
                  <Th fontSize="2xs" textAlign="center">Auth</Th>
                  <Th fontSize="2xs" textAlign="center">Rate Limit</Th>
                </Tr>
              </Thead>
              <Tbody>
                {report.endpoints.map((ep, idx) => (
                  <Tr key={idx}>
                    <Td>
                      <Badge
                        colorScheme={methodColor[ep.method.toUpperCase()] || 'gray'}
                        fontSize="2xs"
                        fontFamily="mono"
                      >
                        {ep.method.toUpperCase()}
                      </Badge>
                    </Td>
                    <Td><Code fontSize="2xs">{ep.path}</Code></Td>
                    <Td fontSize="xs">{ep.file}</Td>
                    <Td textAlign="center"><BooleanIndicator value={ep.hasErrorHandling} label="Error Handling" /></Td>
                    <Td textAlign="center"><BooleanIndicator value={ep.hasInputValidation} label="Input Validation" /></Td>
                    <Td textAlign="center"><BooleanIndicator value={ep.hasAuth} label="Authentication" /></Td>
                    <Td textAlign="center"><BooleanIndicator value={ep.hasRateLimiting} label="Rate Limiting" /></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      <Divider />

      {/* Section 2: Security Gaps */}
      <Box>
        <SectionHeader
          icon={<Lock size={14} color="red" />}
          title="Security Gaps"
          count={report.securityGaps.length}
        />
        {report.securityGaps.length === 0 ? (
          <EmptyState message="No security gaps found" />
        ) : (
          <VStack spacing={3} align="stretch">
            {report.securityGaps.map((gap, idx) => (
              <Alert
                key={idx}
                status="error"
                variant="left-accent"
                borderRadius="md"
                borderLeftColor={gap.severity === 'critical' ? 'red.500' : 'orange.500'}
                borderLeftWidth="4px"
                flexDirection="column"
                alignItems="flex-start"
                py={3}
              >
                <HStack justify="space-between" w="full" mb={1}>
                  <HStack>
                    <AlertIcon boxSize={4} />
                    <Badge colorScheme={severityColor[gap.severity] || 'red'} fontSize="2xs">{gap.type}</Badge>
                    <SeverityBadge severity={gap.severity} />
                  </HStack>
                </HStack>
                <Code fontSize="2xs" mb={1}>{gap.endpoint}</Code>
                <Text fontSize="xs" mb={1}>{gap.description}</Text>
                <Text fontSize="xs" color="green.600" fontWeight="semibold">{gap.fix}</Text>
              </Alert>
            ))}
          </VStack>
        )}
      </Box>

      <Divider />

      {/* Section 3: Schema Issues */}
      <Box>
        <SectionHeader
          icon={<FileWarning size={14} color="orange" />}
          title="Schema Issues"
          count={report.schemaIssues.length}
        />
        {report.schemaIssues.length === 0 ? (
          <EmptyState message="No schema issues found" />
        ) : (
          <VStack spacing={2} align="stretch">
            {report.schemaIssues.map((issue, idx) => (
              <Box key={idx} p={2} bg={useColorModeValue('orange.50', 'orange.900')} borderRadius="md">
                <HStack justify="space-between" mb={1}>
                  <Code fontSize="2xs">{issue.endpoint}</Code>
                  <SeverityBadge severity={issue.severity} />
                </HStack>
                <Text fontSize="xs" mb={1}>{issue.issue}</Text>
                <Text fontSize="xs" color="green.600">{issue.fix}</Text>
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      <Divider />

      {/* Section 4: Missing Error Handling */}
      <Box>
        <SectionHeader
          icon={<AlertTriangle size={14} color="yellow" />}
          title="Missing Error Handling"
          count={report.missingErrorHandling.length}
        />
        {report.missingErrorHandling.length === 0 ? (
          <EmptyState message="No missing error handling found" />
        ) : (
          <VStack spacing={2} align="stretch">
            {report.missingErrorHandling.map((item, idx) => (
              <Box key={idx} p={2} bg={useColorModeValue('yellow.50', 'yellow.900')} borderRadius="md">
                <HStack justify="space-between" mb={1}>
                  <Code fontSize="2xs">{item.endpoint}</Code>
                  <SeverityBadge severity={item.severity} />
                </HStack>
                <Text fontSize="2xs" color="gray.500" mb={1}>{item.file}</Text>
                <Text fontSize="xs" color="green.600">{item.fix}</Text>
              </Box>
            ))}
          </VStack>
        )}
      </Box>
    </VStack>
  );
}
