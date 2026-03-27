/**
 * SelfHealerPanel - Displays structured report data from the Self-Healer agent
 * Shows type mismatches, broken imports, missing deps, config issues, and auto-fix suggestions
 */

import React, { useState } from 'react';
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
  Collapse,
  Progress,
  Tag,
  Alert,
  AlertIcon,
  Divider,
  Tooltip,
  Icon,
} from '@chakra-ui/react';
import {
  Heart,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Package,
  FileWarning,
  Settings,
  Wrench,
  Copy,
  CheckCircle,
  Link2Off,
} from 'lucide-react';
import type { SelfHealingReport } from '../../services/qaService';

interface SelfHealerPanelProps {
  report: SelfHealingReport;
}

const severityColor: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
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

export default function SelfHealerPanel({ report }: SelfHealerPanelProps) {
  const [expandedFixes, setExpandedFixes] = useState<Record<string, boolean>>({});
  const [copiedPkg, setCopiedPkg] = useState<string | null>(null);

  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const subtleBg = useColorModeValue('gray.50', 'gray.700');
  const cardBg = useColorModeValue('gray.50', 'gray.750');

  function toggleFix(key: string) {
    setExpandedFixes(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleCopy(text: string, pkg: string) {
    navigator.clipboard.writeText(text);
    setCopiedPkg(pkg);
    setTimeout(() => setCopiedPkg(null), 2000);
  }

  // Compute score color
  const scoreColor = report.healthScore >= 80 ? 'green' : report.healthScore >= 60 ? 'yellow' : report.healthScore >= 40 ? 'orange' : 'red';

  return (
    <VStack spacing={4} align="stretch" p={4} bg={bg} borderRadius="lg" border="1px solid" borderColor={borderColor}>
      {/* Header: Health Score Gauge + Summary */}
      <HStack spacing={4} align="center">
        <Box position="relative" w="64px" h="64px">
          <Progress
            value={report.healthScore}
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
                {report.healthScore}
              </Text>
              <Text fontSize="2xs" color="gray.500">Health</Text>
            </VStack>
          </Box>
        </Box>
        <VStack align="start" spacing={1} flex={1}>
          <HStack>
            <Icon as={Heart} boxSize={4} color="pink.500" />
            <Text fontSize="md" fontWeight="bold">Self-Healing Report</Text>
          </HStack>
          <Text fontSize="sm" color="gray.500">{report.summary}</Text>
          <HStack spacing={2} flexWrap="wrap">
            <Tag size="sm" colorScheme="red">{report.typeMismatches.length} Type Mismatches</Tag>
            <Tag size="sm" colorScheme="orange">{report.brokenImports.length} Broken Imports</Tag>
            <Tag size="sm" colorScheme="purple">{report.missingDeps.length} Missing Deps</Tag>
            <Tag size="sm" colorScheme="blue">{report.configIssues.length} Config Issues</Tag>
          </HStack>
        </VStack>
      </HStack>

      <Divider />

      {/* Section 1: Type Mismatches */}
      <Box>
        <SectionHeader
          icon={<AlertTriangle size={14} color="orange" />}
          title="Type Mismatches"
          count={report.typeMismatches.length}
        />
        {report.typeMismatches.length === 0 ? (
          <EmptyState message="No type mismatches found" />
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th fontSize="2xs">File</Th>
                  <Th fontSize="2xs">Expected</Th>
                  <Th fontSize="2xs">Actual</Th>
                  <Th fontSize="2xs">Severity</Th>
                  <Th fontSize="2xs">Fix</Th>
                </Tr>
              </Thead>
              <Tbody>
                {report.typeMismatches.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <Tr>
                      <Td fontSize="xs">
                        <Code fontSize="2xs">{item.file}:{item.line}</Code>
                      </Td>
                      <Td fontSize="xs"><Code fontSize="2xs" colorScheme="green">{item.expected}</Code></Td>
                      <Td fontSize="xs"><Code fontSize="2xs" colorScheme="red">{item.actual}</Code></Td>
                      <Td><SeverityBadge severity={item.severity} /></Td>
                      <Td>
                        <Box
                          cursor="pointer"
                          onClick={() => toggleFix(`tm-${idx}`)}
                        >
                          <HStack spacing={1}>
                            <Text fontSize="2xs" color="blue.500">View Fix</Text>
                            {expandedFixes[`tm-${idx}`] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          </HStack>
                        </Box>
                      </Td>
                    </Tr>
                    {expandedFixes[`tm-${idx}`] && (
                      <Tr>
                        <Td colSpan={5} bg={subtleBg}>
                          <Code display="block" whiteSpace="pre-wrap" fontSize="2xs" p={2}>
                            {item.fix}
                          </Code>
                        </Td>
                      </Tr>
                    )}
                  </React.Fragment>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      <Divider />

      {/* Section 2: Broken Imports */}
      <Box>
        <SectionHeader
          icon={<Link2Off size={14} color="red" />}
          title="Broken Imports"
          count={report.brokenImports.length}
        />
        {report.brokenImports.length === 0 ? (
          <EmptyState message="No broken imports found" />
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th fontSize="2xs">File</Th>
                  <Th fontSize="2xs">Import Statement</Th>
                  <Th fontSize="2xs">Issue</Th>
                  <Th fontSize="2xs">Fix</Th>
                </Tr>
              </Thead>
              <Tbody>
                {report.brokenImports.map((item, idx) => (
                  <Tr key={idx}>
                    <Td fontSize="xs"><Code fontSize="2xs">{item.file}</Code></Td>
                    <Td><Code fontSize="2xs" display="block" maxW="250px" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">{item.importStatement}</Code></Td>
                    <Td fontSize="xs">{item.issue}</Td>
                    <Td fontSize="xs"><Code fontSize="2xs">{item.fix}</Code></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      <Divider />

      {/* Section 3: Missing Dependencies */}
      <Box>
        <SectionHeader
          icon={<Package size={14} color="purple" />}
          title="Missing Dependencies"
          count={report.missingDeps.length}
        />
        {report.missingDeps.length === 0 ? (
          <EmptyState message="No missing dependencies found" />
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            {report.missingDeps.map((dep, idx) => (
              <Box key={idx} p={3} bg={cardBg} borderRadius="md" border="1px solid" borderColor={borderColor}>
                <HStack justify="space-between" mb={2}>
                  <HStack>
                    <Package size={12} />
                    <Text fontSize="sm" fontWeight="bold">{dep.package}</Text>
                  </HStack>
                  <Badge colorScheme={dep.inPackageJson ? 'green' : 'red'} fontSize="2xs">
                    {dep.inPackageJson ? 'In package.json' : 'Missing'}
                  </Badge>
                </HStack>
                <HStack spacing={1} mb={2} flexWrap="wrap">
                  <Text fontSize="2xs" color="gray.500">Used in:</Text>
                  {dep.usedIn.map((file, fi) => (
                    <Tag key={fi} size="sm" fontSize="2xs" colorScheme="blue" variant="subtle">{file}</Tag>
                  ))}
                </HStack>
                <HStack
                  bg={useColorModeValue('gray.100', 'gray.600')}
                  borderRadius="md"
                  px={2}
                  py={1}
                  justify="space-between"
                >
                  <Code fontSize="2xs">{dep.fix}</Code>
                  <Tooltip label={copiedPkg === dep.package ? 'Copied!' : 'Copy command'}>
                    <Box cursor="pointer" onClick={() => handleCopy(dep.fix, dep.package)}>
                      <Copy size={12} />
                    </Box>
                  </Tooltip>
                </HStack>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </Box>

      <Divider />

      {/* Section 4: Config Issues */}
      <Box>
        <SectionHeader
          icon={<Settings size={14} color="blue" />}
          title="Configuration Issues"
          count={report.configIssues.length}
        />
        {report.configIssues.length === 0 ? (
          <EmptyState message="No configuration issues found" />
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th fontSize="2xs">Type</Th>
                  <Th fontSize="2xs">Description</Th>
                  <Th fontSize="2xs">Files</Th>
                  <Th fontSize="2xs">Severity</Th>
                  <Th fontSize="2xs">Fix</Th>
                </Tr>
              </Thead>
              <Tbody>
                {report.configIssues.map((item, idx) => (
                  <Tr key={idx}>
                    <Td><Badge colorScheme="blue" fontSize="2xs">{item.type}</Badge></Td>
                    <Td fontSize="xs">{item.description}</Td>
                    <Td>
                      <VStack align="start" spacing={0}>
                        {item.files.map((f, fi) => (
                          <Code key={fi} fontSize="2xs">{f}</Code>
                        ))}
                      </VStack>
                    </Td>
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

      {/* Section 5: Auto-Fix Suggestions */}
      <Box>
        <SectionHeader
          icon={<Wrench size={14} color="green" />}
          title="Auto-Fix Suggestions"
          count={report.autoFixes.length}
        />
        {report.autoFixes.length === 0 ? (
          <EmptyState message="No auto-fix suggestions available" />
        ) : (
          <VStack spacing={3} align="stretch">
            {report.autoFixes.map((fix, idx) => (
              <Box key={idx} p={3} bg={cardBg} borderRadius="md" border="1px solid" borderColor={borderColor}>
                <HStack justify="space-between" mb={1}>
                  <Text fontSize="sm" fontWeight="bold">{fix.title}</Text>
                  <HStack spacing={2}>
                    <Badge
                      colorScheme={fix.confidence === 'high' ? 'green' : fix.confidence === 'medium' ? 'yellow' : 'red'}
                      fontSize="2xs"
                    >
                      {fix.confidence} confidence
                    </Badge>
                    <Badge
                      colorScheme={fix.breakingRisk === 'low' ? 'green' : fix.breakingRisk === 'medium' ? 'yellow' : 'red'}
                      fontSize="2xs"
                    >
                      {fix.breakingRisk} risk
                    </Badge>
                  </HStack>
                </HStack>
                <Text fontSize="xs" color="gray.500" mb={2}>{fix.description}</Text>
                <HStack spacing={1} mb={2} flexWrap="wrap">
                  {fix.files.map((f, fi) => (
                    <Tag key={fi} size="sm" fontSize="2xs" colorScheme="gray">{f}</Tag>
                  ))}
                </HStack>
                <Box
                  cursor="pointer"
                  onClick={() => toggleFix(`af-${idx}`)}
                >
                  <HStack spacing={1} mb={1}>
                    <Text fontSize="2xs" color="blue.500" fontWeight="semibold">View Changes</Text>
                    {expandedFixes[`af-${idx}`] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </HStack>
                </Box>
                <Collapse in={expandedFixes[`af-${idx}`]}>
                  <Code display="block" whiteSpace="pre-wrap" fontSize="2xs" p={2} borderRadius="md">
                    {fix.changes}
                  </Code>
                </Collapse>
              </Box>
            ))}
          </VStack>
        )}
      </Box>
    </VStack>
  );
}
