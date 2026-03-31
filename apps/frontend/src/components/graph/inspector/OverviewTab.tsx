import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Divider,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Progress,
  Card,
  CardBody,
  Wrap,
  WrapItem,
  useColorModeValue,
  Icon,
  Tooltip
} from '@chakra-ui/react';
import {
  FileText,
  Code,
  Shield,
  Zap,
  TrendingUp,
  TrendingDown,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { InspectorOverview } from '../../../lib/api/inspector';

interface OverviewTabProps {
  overview: InspectorOverview;
  isLoading?: boolean;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ overview, isLoading = false }) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const statBgColor = useColorModeValue('gray.50', 'gray.700');

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'green';
      case 'good': return 'blue';
      case 'fair': return 'yellow';
      case 'poor': return 'orange';
      case 'critical': return 'red';
      default: return 'gray';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return CheckCircle;
      case 'good': return CheckCircle;
      case 'fair': return AlertTriangle;
      case 'poor': return AlertTriangle;
      case 'critical': return AlertTriangle;
      default: return Activity;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateSecurityLevel = (score: number) => {
    if (score >= 90) return { level: 'Excellent', color: 'green' };
    if (score >= 80) return { level: 'Good', color: 'blue' };
    if (score >= 70) return { level: 'Fair', color: 'yellow' };
    if (score >= 60) return { level: 'Poor', color: 'orange' };
    return { level: 'Critical', color: 'red' };
  };

  const calculateComplexityLevel = (complexity: number) => {
    if (complexity <= 5) return { level: 'Low', color: 'green' };
    if (complexity <= 10) return { level: 'Medium', color: 'yellow' };
    if (complexity <= 20) return { level: 'High', color: 'orange' };
    return { level: 'Critical', color: 'red' };
  };

  if (isLoading) {
    return (
      <Box p={4}>
        <Text>Loading overview data...</Text>
      </Box>
    );
  }

  const securityLevel = calculateSecurityLevel(overview.securityScore ?? 0);
  const complexityLevel = calculateComplexityLevel(overview.complexity ?? 0);
  const HealthIcon = getHealthStatusIcon(overview.healthStatus);

  return (
    <VStack spacing={6} align="stretch" p={4}>
      {/* Header Section */}
      <Box>
        <HStack justify="space-between" mb={3}>
          <VStack align="start" spacing={1}>
            <HStack>
              <Text fontSize="lg" fontWeight="bold">
                {overview.name || 'Unknown Entity'}
              </Text>
              <Badge colorScheme="blue" variant="subtle">
                {overview.entityType}
              </Badge>
            </HStack>
            <HStack spacing={4} fontSize="sm" color={textColor}>
              <HStack>
                <FileText size={14} />
                <Text>{overview.repositoryName}</Text>
              </HStack>
              {overview.language && (
                <HStack>
                  <Code size={14} />
                  <Text>{overview.language}</Text>
                </HStack>
              )}
              <HStack>
                <Clock size={14} />
                <Text>Updated {formatDate(overview.updatedAt)}</Text>
              </HStack>
            </HStack>
          </VStack>
          
          <Tooltip label={`Overall health: ${overview.healthStatus}`}>
            <HStack>
              <Icon as={HealthIcon} boxSize={5} color={`${getHealthStatusColor(overview.healthStatus)}.500`} />
              <Badge 
                colorScheme={getHealthStatusColor(overview.healthStatus)} 
                variant="solid"
                textTransform="capitalize"
              >
                {overview.healthStatus}
              </Badge>
            </HStack>
          </Tooltip>
        </HStack>

        {/* Tags */}
        {overview.tags && overview.tags.length > 0 && (
          <Wrap spacing={1} mb={3}>
            {overview.tags.map((tag, index) => (
              <WrapItem key={index}>
                <Badge size="sm" variant="outline">{tag}</Badge>
              </WrapItem>
            ))}
          </Wrap>
        )}
      </Box>

      <Divider />

      {/* Key Metrics Grid */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
        <Card size="sm" bg={statBgColor}>
          <CardBody>
            <Stat size="sm">
              <StatLabel>Security Score</StatLabel>
              <HStack>
                <StatNumber color={`${securityLevel.color}.500`}>
                  {overview.securityScore || 0}%
                </StatNumber>
                <Badge colorScheme={securityLevel.color} size="sm">
                  {securityLevel.level}
                </Badge>
              </HStack>
              <Progress 
                value={overview.securityScore || 0} 
                colorScheme={securityLevel.color}
                size="sm"
                borderRadius="md"
                mt={2}
              />
            </Stat>
          </CardBody>
        </Card>

        <Card size="sm" bg={statBgColor}>
          <CardBody>
            <Stat size="sm">
              <StatLabel>Complexity</StatLabel>
              <HStack>
                <StatNumber color={`${complexityLevel.color}.500`}>
                  {overview.complexity || 0}
                </StatNumber>
                <Badge colorScheme={complexityLevel.color} size="sm">
                  {complexityLevel.level}
                </Badge>
              </HStack>
              <StatHelpText fontSize="xs">
                Cyclomatic complexity score
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card size="sm" bg={statBgColor}>
          <CardBody>
            <Stat size="sm">
              <StatLabel>Test Coverage</StatLabel>
              <StatNumber color={(overview.testCoverage ?? 0) >= 80 ? 'green.500' : (overview.testCoverage ?? 0) >= 60 ? 'yellow.500' : 'red.500'}>
                {overview.testCoverage ?? 0}%
              </StatNumber>
              <Progress 
                value={overview.testCoverage ?? 0} 
                colorScheme={(overview.testCoverage ?? 0) >= 80 ? 'green' : (overview.testCoverage ?? 0) >= 60 ? 'yellow' : 'red'}
                size="sm"
                borderRadius="md"
                mt={2}
              />
            </Stat>
          </CardBody>
        </Card>

        <Card size="sm" bg={statBgColor}>
          <CardBody>
            <Stat size="sm">
              <StatLabel>Lines of Code</StatLabel>
              <StatNumber>{(overview.linesOfCode || 0).toLocaleString()}</StatNumber>
              <StatHelpText fontSize="xs">
                {overview.fileCount || 1} {(overview.fileCount || 1) === 1 ? 'file' : 'files'}
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card size="sm" bg={statBgColor}>
          <CardBody>
            <Stat size="sm">
              <StatLabel>Maintainability</StatLabel>
              <StatNumber color={(overview.maintainabilityIndex ?? 0) >= 70 ? 'green.500' : (overview.maintainabilityIndex ?? 0) >= 50 ? 'yellow.500' : 'red.500'}>
                {overview.maintainabilityIndex ?? 0}
              </StatNumber>
              <StatHelpText fontSize="xs">
                Index score (0-100)
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card size="sm" bg={statBgColor}>
          <CardBody>
            <Stat size="sm">
              <StatLabel>Technical Debt</StatLabel>
              <StatNumber color={(overview.technicalDebt ?? 0) <= 10 ? 'green.500' : (overview.technicalDebt ?? 0) <= 25 ? 'yellow.500' : 'red.500'}>
                {overview.technicalDebt ?? 0}%
              </StatNumber>
              <StatHelpText fontSize="xs">
                Debt ratio
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Divider />

      {/* Timestamps and Analysis Info */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Card size="sm">
          <CardBody>
            <VStack align="start" spacing={2}>
              <Text fontSize="sm" fontWeight="medium" color={textColor}>
                Timeline Information
              </Text>
              <VStack align="start" spacing={1} fontSize="xs">
                <HStack>
                  <Calendar size={12} />
                  <Text>Created: {formatDate(overview.createdAt)}</Text>
                </HStack>
                <HStack>
                  <Activity size={12} />
                  <Text>Updated: {formatDate(overview.updatedAt)}</Text>
                </HStack>
                <HStack>
                  <Zap size={12} />
                  <Text>Last Analyzed: {formatDate(overview.lastAnalyzed)}</Text>
                </HStack>
              </VStack>
            </VStack>
          </CardBody>
        </Card>

        <Card size="sm">
          <CardBody>
            <VStack align="start" spacing={2}>
              <Text fontSize="sm" fontWeight="medium" color={textColor}>
                Entity Details
              </Text>
              <VStack align="start" spacing={1} fontSize="xs">
                <HStack>
                  <Text fontWeight="medium">ID:</Text>
                  <Text fontFamily="mono" color={textColor}>{overview.repositoryId}</Text>
                </HStack>
                <HStack>
                  <Text fontWeight="medium">Type:</Text>
                  <Text>{overview.entityType}</Text>
                </HStack>
                {overview.language && (
                  <HStack>
                    <Text fontWeight="medium">Language:</Text>
                    <Text>{overview.language}</Text>
                  </HStack>
                )}
              </VStack>
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Health Summary */}
      <Card>
        <CardBody>
          <VStack align="start" spacing={3}>
            <HStack>
              <Shield size={16} />
              <Text fontSize="md" fontWeight="medium">Health Summary</Text>
            </HStack>
            
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} w="full">
              <VStack align="start" spacing={2}>
                <Text fontSize="sm" fontWeight="medium" color="green.500">Strengths</Text>
                <VStack align="start" spacing={1} fontSize="xs">
                  {(overview.securityScore ?? 0) >= 80 && (
                    <HStack>
                      <CheckCircle size={12} color="green" />
                      <Text>Good security posture</Text>
                    </HStack>
                  )}
                  {(overview.testCoverage ?? 0) >= 70 && (
                    <HStack>
                      <CheckCircle size={12} color="green" />
                      <Text>Adequate test coverage</Text>
                    </HStack>
                  )}
                  {(overview.complexity ?? 0) <= 10 && (
                    <HStack>
                      <CheckCircle size={12} color="green" />
                      <Text>Low complexity</Text>
                    </HStack>
                  )}
                  {(overview.maintainabilityIndex ?? 0) >= 70 && (
                    <HStack>
                      <CheckCircle size={12} color="green" />
                      <Text>Good maintainability</Text>
                    </HStack>
                  )}
                </VStack>
              </VStack>

              <VStack align="start" spacing={2}>
                <Text fontSize="sm" fontWeight="medium" color="orange.500">Areas for Improvement</Text>
                <VStack align="start" spacing={1} fontSize="xs">
                  {(overview.securityScore ?? 0) < 80 && (
                    <HStack>
                      <AlertTriangle size={12} color="orange" />
                      <Text>Security score needs improvement</Text>
                    </HStack>
                  )}
                  {(overview.testCoverage ?? 0) < 70 && (
                    <HStack>
                      <AlertTriangle size={12} color="orange" />
                      <Text>Increase test coverage</Text>
                    </HStack>
                  )}
                  {(overview.complexity ?? 0) > 10 && (
                    <HStack>
                      <AlertTriangle size={12} color="orange" />
                      <Text>Consider refactoring for complexity</Text>
                    </HStack>
                  )}
                  {(overview.technicalDebt ?? 0) > 25 && (
                    <HStack>
                      <AlertTriangle size={12} color="orange" />
                      <Text>Address technical debt</Text>
                    </HStack>
                  )}
                </VStack>
              </VStack>
            </SimpleGrid>
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
};

export default OverviewTab;

