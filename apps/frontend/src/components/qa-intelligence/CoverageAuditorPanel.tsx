/**
 * CoverageAuditorPanel - Displays structured report data from the Coverage Auditor agent
 * Shows unexposed backend features, broken frontend calls, data shape mismatches, and missing CRUD ops
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
  Layers,
  CheckCircle,
  XCircle,
  Server,
  MonitorX,
  ArrowLeftRight,
  LayoutGrid,
} from 'lucide-react';
import type { CoverageAuditReport } from '../../services/qaService';

interface CoverageAuditorPanelProps {
  report: CoverageAuditReport;
}

const severityColor: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
};

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge colorScheme={severityColor[priority] || 'gray'} fontSize="2xs">
      {priority}
    </Badge>
  );
}

function BoolCheck({ value }: { value: boolean }) {
  return value ? (
    <Box color="green.500"><CheckCircle size={14} /></Box>
  ) : (
    <Box color="red.500"><XCircle size={14} /></Box>
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

export default function CoverageAuditorPanel({ report }: CoverageAuditorPanelProps) {
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const scoreColor = report.coverageScore >= 80 ? 'green' : report.coverageScore >= 60 ? 'yellow' : report.coverageScore >= 40 ? 'orange' : 'red';

  return (
    <VStack spacing={4} align="stretch" p={4} bg={bg} borderRadius="lg" border="1px solid" borderColor={borderColor}>
      {/* Header: Coverage Score + Stats */}
      <HStack spacing={4} align="center">
        <Box position="relative" w="64px" h="64px">
          <Progress
            value={report.coverageScore}
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
                {report.coverageScore}
              </Text>
              <Text fontSize="2xs" color="gray.500">Coverage</Text>
            </VStack>
          </Box>
        </Box>
        <VStack align="start" spacing={1} flex={1}>
          <HStack>
            <Icon as={Layers} boxSize={4} color="cyan.500" />
            <Text fontSize="md" fontWeight="bold">Coverage Audit Report</Text>
          </HStack>
          <Text fontSize="sm" color="gray.500">{report.summary}</Text>
          <HStack spacing={2} flexWrap="wrap">
            <Tag size="sm" colorScheme="purple">{report.unexposedBackendFeatures.length} Unexposed</Tag>
            <Tag size="sm" colorScheme="red">{report.brokenFrontendCalls.length} Broken Calls</Tag>
            <Tag size="sm" colorScheme="orange">{report.orphanedRoutes.length} Orphaned</Tag>
            <Tag size="sm" colorScheme="blue">{report.missingCrudOperations.length} Missing CRUD</Tag>
          </HStack>
        </VStack>
      </HStack>

      <Divider />

      {/* Section 1: Unexposed Backend Features */}
      <Box>
        <SectionHeader
          icon={<Server size={14} color="purple" />}
          title="Unexposed Backend Features"
          count={report.unexposedBackendFeatures.length}
        />
        {report.unexposedBackendFeatures.length === 0 ? (
          <EmptyState message="All backend features are exposed in the frontend" />
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th fontSize="2xs">Endpoint</Th>
                  <Th fontSize="2xs">File</Th>
                  <Th fontSize="2xs">Description</Th>
                  <Th fontSize="2xs">Suggested UI Location</Th>
                  <Th fontSize="2xs">Priority</Th>
                </Tr>
              </Thead>
              <Tbody>
                {report.unexposedBackendFeatures.map((item, idx) => (
                  <Tr key={idx}>
                    <Td><Code fontSize="2xs">{item.endpoint}</Code></Td>
                    <Td fontSize="xs">{item.file}</Td>
                    <Td fontSize="xs">{item.description}</Td>
                    <Td fontSize="xs">{item.suggestedUILocation}</Td>
                    <Td><PriorityBadge priority={item.priority} /></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      <Divider />

      {/* Section 2: Broken Frontend Calls */}
      <Box>
        <SectionHeader
          icon={<MonitorX size={14} color="red" />}
          title="Broken Frontend Calls"
          count={report.brokenFrontendCalls.length}
        />
        {report.brokenFrontendCalls.length === 0 ? (
          <EmptyState message="No broken frontend calls detected" />
        ) : (
          <VStack spacing={3} align="stretch">
            {report.brokenFrontendCalls.map((item, idx) => (
              <Alert
                key={idx}
                status="error"
                variant="left-accent"
                borderRadius="md"
                borderLeftColor="red.500"
                borderLeftWidth="4px"
                flexDirection="column"
                alignItems="flex-start"
                py={3}
              >
                <HStack mb={1} w="full">
                  <AlertIcon boxSize={4} />
                  <Code fontSize="2xs" fontWeight="bold">{item.file}</Code>
                </HStack>
                <HStack spacing={4} mb={1} flexWrap="wrap">
                  <HStack>
                    <Text fontSize="2xs" color="gray.500">Call:</Text>
                    <Code fontSize="2xs">{item.call}</Code>
                  </HStack>
                  <HStack>
                    <Text fontSize="2xs" color="gray.500">Expected:</Text>
                    <Code fontSize="2xs">{item.expectedEndpoint}</Code>
                  </HStack>
                </HStack>
                <Text fontSize="xs" mb={1}>{item.issue}</Text>
                <Text fontSize="xs" color="green.600" fontWeight="semibold">{item.fix}</Text>
              </Alert>
            ))}
          </VStack>
        )}
      </Box>

      <Divider />

      {/* Section 3: Data Shape Mismatches */}
      <Box>
        <SectionHeader
          icon={<ArrowLeftRight size={14} color="orange" />}
          title="Data Shape Mismatches"
          count={report.dataShapeMismatches.length}
        />
        {report.dataShapeMismatches.length === 0 ? (
          <EmptyState message="No data shape mismatches found" />
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th fontSize="2xs">Endpoint</Th>
                  <Th fontSize="2xs">Backend Shape</Th>
                  <Th fontSize="2xs">Frontend Expects</Th>
                  <Th fontSize="2xs">Fix</Th>
                </Tr>
              </Thead>
              <Tbody>
                {report.dataShapeMismatches.map((item, idx) => (
                  <Tr key={idx}>
                    <Td><Code fontSize="2xs">{item.endpoint}</Code></Td>
                    <Td><Code fontSize="2xs" colorScheme="blue">{item.backendShape}</Code></Td>
                    <Td><Code fontSize="2xs" colorScheme="orange">{item.frontendExpects}</Code></Td>
                    <Td fontSize="xs">{item.fix}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      <Divider />

      {/* Section 4: Missing CRUD Operations */}
      <Box>
        <SectionHeader
          icon={<LayoutGrid size={14} color="blue" />}
          title="Missing CRUD Operations"
          count={report.missingCrudOperations.length}
        />
        {report.missingCrudOperations.length === 0 ? (
          <EmptyState message="All resources have complete CRUD operations" />
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th fontSize="2xs">Resource</Th>
                  <Th fontSize="2xs" textAlign="center">Create</Th>
                  <Th fontSize="2xs" textAlign="center">Read</Th>
                  <Th fontSize="2xs" textAlign="center">Update</Th>
                  <Th fontSize="2xs" textAlign="center">Delete</Th>
                  <Th fontSize="2xs">Missing</Th>
                  <Th fontSize="2xs">Priority</Th>
                </Tr>
              </Thead>
              <Tbody>
                {report.missingCrudOperations.map((item, idx) => (
                  <Tr key={idx}>
                    <Td fontSize="xs" fontWeight="bold">{item.resource}</Td>
                    <Td textAlign="center"><BoolCheck value={item.hasCreate} /></Td>
                    <Td textAlign="center"><BoolCheck value={item.hasRead} /></Td>
                    <Td textAlign="center"><BoolCheck value={item.hasUpdate} /></Td>
                    <Td textAlign="center"><BoolCheck value={item.hasDelete} /></Td>
                    <Td>
                      <HStack spacing={1} flexWrap="wrap">
                        {item.missingOperations.map((op, oi) => (
                          <Tag key={oi} size="sm" fontSize="2xs" colorScheme="red" variant="subtle">{op}</Tag>
                        ))}
                      </HStack>
                    </Td>
                    <Td><PriorityBadge priority={item.priority} /></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>
    </VStack>
  );
}
