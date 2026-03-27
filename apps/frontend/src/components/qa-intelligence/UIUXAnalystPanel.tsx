/**
 * UIUXAnalystPanel - Displays structured report data from the UI/UX Analyst agent
 * Shows accessibility issues, UX anti-patterns, component issues, and improvement suggestions
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
  Eye,
  Accessibility,
  AlertTriangle,
  Component,
  Lightbulb,
  CheckCircle,
} from 'lucide-react';
import type { UIAuditReport } from '../../services/qaService';

interface UIUXAnalystPanelProps {
  report: UIAuditReport;
}

const severityColor: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
};

const categoryColor: Record<string, string> = {
  accessibility: 'purple',
  usability: 'blue',
  performance: 'green',
  aesthetics: 'pink',
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge colorScheme={severityColor[severity] || 'gray'} fontSize="2xs">
      {severity}
    </Badge>
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

/** Group items by a key and return in severity order */
function groupBySeverity<T extends { severity: string }>(items: T[]): Map<string, T[]> {
  const order = ['critical', 'high', 'medium', 'low'];
  const groups = new Map<string, T[]>();
  for (const sev of order) {
    const matching = items.filter(i => i.severity === sev);
    if (matching.length > 0) groups.set(sev, matching);
  }
  return groups;
}

/** Group items by a string key */
function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

export default function UIUXAnalystPanel({ report }: UIUXAnalystPanelProps) {
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const cardBg = useColorModeValue('gray.50', 'gray.750');

  const a11yColor = report.accessibilityScore >= 80 ? 'green' : report.accessibilityScore >= 60 ? 'yellow' : report.accessibilityScore >= 40 ? 'orange' : 'red';
  const uxColor = report.uxScore >= 80 ? 'green' : report.uxScore >= 60 ? 'yellow' : report.uxScore >= 40 ? 'orange' : 'red';

  // Sort suggestions by impact (high first)
  const sortedSuggestions = [...report.suggestions].sort((a, b) => {
    const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (impactOrder[a.impact] ?? 3) - (impactOrder[b.impact] ?? 3);
  });

  // Group accessibility issues by severity
  const a11yGroups = groupBySeverity(report.accessibilityIssues);

  // Group UX anti-patterns by pattern type
  const uxGroups = groupBy(report.uxAntiPatterns, item => item.pattern);

  return (
    <VStack spacing={4} align="stretch" p={4} bg={bg} borderRadius="lg" border="1px solid" borderColor={borderColor}>
      {/* Header: Two Gauges + Summary */}
      <HStack spacing={4} align="center">
        {/* Accessibility Score */}
        <Box position="relative" w="64px" h="64px">
          <Progress
            value={report.accessibilityScore}
            size="lg"
            colorScheme={a11yColor}
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
              <Text fontSize="lg" fontWeight="bold" color={`${a11yColor}.500`}>
                {report.accessibilityScore}
              </Text>
              <Text fontSize="2xs" color="gray.500">A11y</Text>
            </VStack>
          </Box>
        </Box>

        {/* UX Score */}
        <Box position="relative" w="64px" h="64px">
          <Progress
            value={report.uxScore}
            size="lg"
            colorScheme={uxColor}
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
              <Text fontSize="lg" fontWeight="bold" color={`${uxColor}.500`}>
                {report.uxScore}
              </Text>
              <Text fontSize="2xs" color="gray.500">UX</Text>
            </VStack>
          </Box>
        </Box>

        <VStack align="start" spacing={1} flex={1}>
          <HStack>
            <Icon as={Eye} boxSize={4} color="purple.500" />
            <Text fontSize="md" fontWeight="bold">UI/UX Audit Report</Text>
          </HStack>
          <Text fontSize="sm" color="gray.500">{report.summary}</Text>
          <HStack spacing={2} flexWrap="wrap">
            <Tag size="sm" colorScheme="purple">{report.accessibilityIssues.length} A11y Issues</Tag>
            <Tag size="sm" colorScheme="orange">{report.uxAntiPatterns.length} Anti-Patterns</Tag>
            <Tag size="sm" colorScheme="blue">{report.componentIssues.length} Component Issues</Tag>
            <Tag size="sm" colorScheme="green">{report.suggestions.length} Suggestions</Tag>
          </HStack>
        </VStack>
      </HStack>

      <Divider />

      {/* Section 1: Accessibility Issues (grouped by severity) */}
      <Box>
        <SectionHeader
          icon={<Accessibility size={14} color="purple" />}
          title="Accessibility Issues"
          count={report.accessibilityIssues.length}
        />
        {report.accessibilityIssues.length === 0 ? (
          <EmptyState message="No accessibility issues found" />
        ) : (
          <VStack spacing={3} align="stretch">
            {Array.from(a11yGroups.entries()).map(([severity, issues]) => (
              <Box key={severity}>
                <HStack mb={1}>
                  <SeverityBadge severity={severity} />
                  <Text fontSize="2xs" color="gray.500">{issues.length} issue{issues.length !== 1 ? 's' : ''}</Text>
                </HStack>
                <VStack spacing={2} align="stretch" pl={2} borderLeft="2px solid" borderColor={`${severityColor[severity]}.300`}>
                  {issues.map((issue, idx) => (
                    <Box key={idx} p={2} bg={cardBg} borderRadius="md">
                      <HStack justify="space-between" mb={1}>
                        <Code fontSize="2xs">{issue.file}</Code>
                        <Badge colorScheme="purple" fontSize="2xs" variant="outline">{issue.type}</Badge>
                      </HStack>
                      <Text fontSize="xs" mb={1}>
                        Element: <Code fontSize="2xs">{issue.element}</Code>
                      </Text>
                      {issue.wcagCriteria && (
                        <Text fontSize="2xs" color="purple.500" mb={1}>WCAG: {issue.wcagCriteria}</Text>
                      )}
                      <Text fontSize="xs" color="green.600">{issue.fix}</Text>
                    </Box>
                  ))}
                </VStack>
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      <Divider />

      {/* Section 2: UX Anti-Patterns (grouped by pattern type) */}
      <Box>
        <SectionHeader
          icon={<AlertTriangle size={14} color="orange" />}
          title="UX Anti-Patterns"
          count={report.uxAntiPatterns.length}
        />
        {report.uxAntiPatterns.length === 0 ? (
          <EmptyState message="No UX anti-patterns detected" />
        ) : (
          <VStack spacing={3} align="stretch">
            {Array.from(uxGroups.entries()).map(([pattern, items]) => (
              <Box key={pattern}>
                <HStack mb={1}>
                  <Badge colorScheme="orange" fontSize="2xs">{pattern}</Badge>
                  <Text fontSize="2xs" color="gray.500">{items.length} instance{items.length !== 1 ? 's' : ''}</Text>
                </HStack>
                <VStack spacing={2} align="stretch">
                  {items.map((item, idx) => (
                    <Box key={idx} p={2} bg={cardBg} borderRadius="md">
                      <Code fontSize="2xs" mb={1} display="block">{item.file}</Code>
                      <Text fontSize="xs" mb={1}>{item.description}</Text>
                      <Text fontSize="xs" fontStyle="italic" color="orange.500" mb={1}>
                        User Impact: {item.userImpact}
                      </Text>
                      <Text fontSize="xs" color="green.600">{item.fix}</Text>
                    </Box>
                  ))}
                </VStack>
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      <Divider />

      {/* Section 3: Component Issues */}
      <Box>
        <SectionHeader
          icon={<Component size={14} color="blue" />}
          title="Component Issues"
          count={report.componentIssues.length}
        />
        {report.componentIssues.length === 0 ? (
          <EmptyState message="No component issues found" />
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th fontSize="2xs">File</Th>
                  <Th fontSize="2xs">Component</Th>
                  <Th fontSize="2xs">Issue</Th>
                  <Th fontSize="2xs">Severity</Th>
                  <Th fontSize="2xs">Fix</Th>
                </Tr>
              </Thead>
              <Tbody>
                {report.componentIssues.map((item, idx) => (
                  <Tr key={idx}>
                    <Td><Code fontSize="2xs">{item.file}</Code></Td>
                    <Td fontSize="xs" fontWeight="semibold">{item.component}</Td>
                    <Td fontSize="xs">{item.issue}</Td>
                    <Td><SeverityBadge severity={item.severity} /></Td>
                    <Td fontSize="xs">{item.fix}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      <Divider />

      {/* Section 4: Suggestions (priority sorted) */}
      <Box>
        <SectionHeader
          icon={<Lightbulb size={14} color="green" />}
          title="Suggestions"
          count={report.suggestions.length}
        />
        {report.suggestions.length === 0 ? (
          <EmptyState message="No suggestions available" />
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            {sortedSuggestions.map((item, idx) => (
              <Box key={idx} p={3} bg={cardBg} borderRadius="md" border="1px solid" borderColor={borderColor}>
                <HStack justify="space-between" mb={1}>
                  <Text fontSize="sm" fontWeight="bold">{item.title}</Text>
                  <Badge
                    colorScheme={categoryColor[item.category] || 'gray'}
                    fontSize="2xs"
                  >
                    {item.category}
                  </Badge>
                </HStack>
                <Text fontSize="xs" color="gray.500" mb={2}>{item.description}</Text>
                <HStack spacing={2}>
                  <Tag size="sm" fontSize="2xs" colorScheme="blue" variant="outline">
                    Effort: {item.effort}
                  </Tag>
                  <Tag
                    size="sm"
                    fontSize="2xs"
                    colorScheme={item.impact === 'high' ? 'green' : item.impact === 'medium' ? 'yellow' : 'gray'}
                    variant="outline"
                  >
                    Impact: {item.impact}
                  </Tag>
                </HStack>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </Box>
    </VStack>
  );
}
