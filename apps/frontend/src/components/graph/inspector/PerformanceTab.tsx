import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Progress,
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  useColorModeValue,
  Icon,
  Alert,
  AlertIcon,
  AlertDescription
} from '@chakra-ui/react';
import {
  Zap,
  Clock,
  MemoryStick,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Cpu,
  HardDrive
} from 'lucide-react';
import { InspectorPerformanceData } from '../../../lib/api/inspector';

interface PerformanceTabProps {
  performance: InspectorPerformanceData;
  isLoading?: boolean;
}

export const PerformanceTab: React.FC<PerformanceTabProps> = ({ performance, isLoading = false }) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const statBgColor = useColorModeValue('gray.50', 'gray.700');

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'green';
      case 'B': return 'blue';
      case 'C': return 'yellow';
      case 'D': return 'orange';
      case 'F': return 'red';
      default: return 'gray';
    }
  };

  const getGradeScore = (grade: string): number => {
    switch (grade) {
      case 'A': return 90;
      case 'B': return 80;
      case 'C': return 70;
      case 'D': return 60;
      case 'F': return 40;
      default: return 50;
    }
  };

  const getComplexityColor = (complexity: number) => {
    if (complexity <= 5) return 'green';
    if (complexity <= 10) return 'yellow';
    if (complexity <= 20) return 'orange';
    return 'red';
  };

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 80) return 'green';
    if (coverage >= 60) return 'yellow';
    if (coverage >= 40) return 'orange';
    return 'red';
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving': return TrendingUp;
      case 'degrading': return TrendingDown;
      case 'stable': return Minus;
      default: return Minus;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'improving': return 'green';
      case 'degrading': return 'red';
      case 'stable': return 'blue';
      default: return 'gray';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  const formatExecutionTime = (time: number, unit: string) => {
    if (unit === 's' && time < 1) {
      return `${(time * 1000).toFixed(0)}ms`;
    }
    return `${time.toFixed(time < 10 ? 1 : 0)}${unit}`;
  };

  const formatMemory = (memory: number, unit: string) => {
    if (unit === 'GB' && memory < 1) {
      return `${(memory * 1024).toFixed(0)}MB`;
    }
    return `${memory.toFixed(memory < 10 ? 1 : 0)}${unit}`;
  };

  if (isLoading) {
    return (
      <Box p={4}>
        <Text>Loading performance data...</Text>
      </Box>
    );
  }

  const TrendIcon = getTrendIcon(performance.trends.performanceChange);

  return (
    <VStack spacing={6} align="stretch" p={4}>
      {/* Performance Grade Header */}
      <Card>
        <CardBody>
          <HStack justify="space-between" w="full">
            <VStack align="start" spacing={1}>
              <HStack>
                <Zap size={20} />
                <Text fontSize="lg" fontWeight="bold">Performance Metrics</Text>
              </HStack>
              <Text fontSize="sm" color={textColor}>
                Execution, memory, and complexity analysis
              </Text>
            </VStack>
            
            <VStack align="end" spacing={1}>
              <HStack>
                <Badge 
                  colorScheme={getGradeColor(performance.performanceGrade)} 
                  variant="solid"
                  fontSize="2xl"
                  px={4}
                  py={2}
                  borderRadius="full"
                >
                  {performance.performanceGrade}
                </Badge>
                <Icon 
                  as={TrendIcon} 
                  color={`${getTrendColor(performance.trends.performanceChange)}.500`}
                  boxSize={5}
                />
              </HStack>
              <Text fontSize="xs" color={textColor}>
                {performance.trends.changePercentage !== 0 && `${performance.trends.changePercentage}% over ${performance.trends.period}`}
                {performance.trends.changePercentage === 0 && 'No change'}
              </Text>
            </VStack>
          </HStack>

          <Progress 
            value={getGradeScore(performance.performanceGrade)} 
            colorScheme={getGradeColor(performance.performanceGrade)}
            size="lg"
            borderRadius="md"
            bg={statBgColor}
            mt={4}
          />
        </CardBody>
      </Card>

      {/* Core Performance Metrics */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        <Card size="sm" bg={statBgColor}>
          <CardBody>
            <Stat size="sm">
              <StatLabel>
                <HStack>
                  <Clock size={14} />
                  <Text>Execution Time</Text>
                </HStack>
              </StatLabel>
              <StatNumber>{formatExecutionTime(performance.executionTime.average, performance.executionTime.unit)}</StatNumber>
              <StatHelpText fontSize="xs">
                P95: {formatExecutionTime(performance.executionTime.p95, performance.executionTime.unit)}
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card size="sm" bg={statBgColor}>
          <CardBody>
            <Stat size="sm">
              <StatLabel>
                <HStack>
                  <MemoryStick size={14} />
                  <Text>Memory Usage</Text>
                </HStack>
              </StatLabel>
              <StatNumber>{formatMemory(performance.memoryUsage.average, performance.memoryUsage.unit)}</StatNumber>
              <StatHelpText fontSize="xs">
                Peak: {formatMemory(performance.memoryUsage.peak, performance.memoryUsage.unit)}
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card size="sm" bg={statBgColor}>
          <CardBody>
            <Stat size="sm">
              <StatLabel>
                <HStack>
                  <BarChart3 size={14} />
                  <Text>Test Coverage</Text>
                </HStack>
              </StatLabel>
              <StatNumber color={`${getCoverageColor(performance.testCoverage.percentage)}.500`}>
                {performance.testCoverage.percentage}%
              </StatNumber>
              <StatHelpText fontSize="xs">
                {performance.testCoverage.covered} of {performance.testCoverage.total} lines
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Complexity Analysis */}
      <Card>
        <CardHeader>
          <HStack>
            <Cpu size={16} />
            <Text fontSize="md" fontWeight="medium">Complexity Analysis</Text>
          </HStack>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <VStack align="start" spacing={2}>
              <HStack justify="space-between" w="full">
                <Text fontSize="sm" fontWeight="medium">Cognitive Complexity</Text>
                <Badge 
                  colorScheme={getComplexityColor(performance.complexity.cognitive)}
                  variant="solid"
                  size="sm"
                >
                  {performance.complexity.cognitive <= 5 ? 'LOW' : 
                   performance.complexity.cognitive <= 10 ? 'MEDIUM' : 'HIGH'}
                </Badge>
              </HStack>
              <Text fontSize="2xl" fontWeight="bold" color={`${getComplexityColor(performance.complexity.cognitive)}.500`}>
                {performance.complexity.cognitive}
              </Text>
              <Progress 
                value={Math.min(performance.complexity.cognitive * 5, 100)} 
                colorScheme={getComplexityColor(performance.complexity.cognitive)}
                size="sm"
                w="full"
                borderRadius="md"
              />
            </VStack>

            <VStack align="start" spacing={2}>
              <HStack justify="space-between" w="full">
                <Text fontSize="sm" fontWeight="medium">Cyclomatic Complexity</Text>
                <Badge 
                  colorScheme={getComplexityColor(performance.complexity.cyclomatic)}
                  variant="solid"
                  size="sm"
                >
                  {performance.complexity.cyclomatic <= 5 ? 'LOW' : 
                   performance.complexity.cyclomatic <= 10 ? 'MEDIUM' : 'HIGH'}
                </Badge>
              </HStack>
              <Text fontSize="2xl" fontWeight="bold" color={`${getComplexityColor(performance.complexity.cyclomatic)}.500`}>
                {performance.complexity.cyclomatic}
              </Text>
              <Progress 
                value={Math.min(performance.complexity.cyclomatic * 5, 100)} 
                colorScheme={getComplexityColor(performance.complexity.cyclomatic)}
                size="sm"
                w="full"
                borderRadius="md"
              />
            </VStack>
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* Performance Bottlenecks */}
      {performance.performanceBottlenecks.length > 0 && (
        <Card>
          <CardHeader>
            <HStack>
              <AlertTriangle size={16} />
              <Text fontSize="md" fontWeight="medium">Performance Bottlenecks</Text>
              <Badge variant="outline">{performance.performanceBottlenecks.length}</Badge>
            </HStack>
          </CardHeader>
          <CardBody>
            <VStack spacing={3} align="stretch">
              {performance.performanceBottlenecks.map((bottleneck, index) => (
                <Alert 
                  key={index} 
                  status={bottleneck.impact === 'high' ? 'error' : bottleneck.impact === 'medium' ? 'warning' : 'info'}
                  borderRadius="md"
                >
                  <AlertIcon />
                  <Box flex="1">
                    <HStack justify="space-between" mb={1}>
                      <Badge colorScheme={getSeverityColor(bottleneck.impact)} size="sm" variant="solid">
                        {bottleneck.impact.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" size="sm">
                        <HStack spacing={1}>
                          {bottleneck.type === 'cpu' && <Cpu size={10} />}
                          {bottleneck.type === 'memory' && <MemoryStick size={10} />}
                          {bottleneck.type === 'io' && <HardDrive size={10} />}
                          <Text>{bottleneck.type.toUpperCase()}</Text>
                        </HStack>
                      </Badge>
                    </HStack>
                    <Text fontSize="sm" mb={2}>{bottleneck.description}</Text>
                    <Text fontSize="xs" color={textColor} fontStyle="italic">
                      💡 {bottleneck.recommendation}
                    </Text>
                  </Box>
                </Alert>
              ))}
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* Optimization Opportunities */}
      {performance.optimizationOpportunities.length > 0 && (
        <Card>
          <CardHeader>
            <HStack>
              <TrendingUp size={16} />
              <Text fontSize="md" fontWeight="medium">Optimization Opportunities</Text>
              <Badge variant="outline">{performance.optimizationOpportunities.length}</Badge>
            </HStack>
          </CardHeader>
          <CardBody>
            <VStack spacing={3} align="stretch">
              {performance.optimizationOpportunities.slice(0, 5).map((opportunity, index) => (
                <Card key={index} size="sm" variant="outline">
                  <CardBody>
                    <HStack justify="space-between" mb={2}>
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" fontWeight="medium">{opportunity.type}</Text>
                        <HStack spacing={2}>
                          <Badge 
                            colorScheme={opportunity.priority === 'high' ? 'red' : opportunity.priority === 'medium' ? 'yellow' : 'green'}
                            size="xs"
                            variant="solid"
                          >
                            {opportunity.priority.toUpperCase()} PRIORITY
                          </Badge>
                          <Badge 
                            colorScheme={opportunity.effort === 'high' ? 'red' : opportunity.effort === 'medium' ? 'yellow' : 'green'}
                            size="xs"
                            variant="outline"
                          >
                            {opportunity.effort.toUpperCase()} EFFORT
                          </Badge>
                        </HStack>
                      </VStack>
                    </HStack>
                    
                    <Text fontSize="sm" mb={2}>{opportunity.description}</Text>
                    
                    <Alert status="success" size="sm" mt={2}>
                      <AlertIcon boxSize={3} />
                      <AlertDescription fontSize="xs">
                        <Text fontWeight="medium">Potential Improvement:</Text>
                        <Text>{opportunity.potentialImprovement}</Text>
                      </AlertDescription>
                    </Alert>
                  </CardBody>
                </Card>
              ))}
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <HStack>
            <BarChart3 size={16} />
            <Text fontSize="md" fontWeight="medium">Performance Summary</Text>
          </HStack>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            <VStack align="start" spacing={3}>
              <Text fontSize="sm" fontWeight="medium" color="green.500">Strengths</Text>
              <VStack align="start" spacing={1} fontSize="xs">
                {(performance.performanceGrade === 'A' || performance.performanceGrade === 'B') && (
                  <HStack>
                    <CheckCircle size={12} color="green" />
                    <Text>Good overall performance grade</Text>
                  </HStack>
                )}
                
                {performance.complexity.cognitive <= 5 && (
                  <HStack>
                    <CheckCircle size={12} color="green" />
                    <Text>Low cognitive complexity</Text>
                  </HStack>
                )}
                
                {performance.testCoverage.percentage >= 80 && (
                  <HStack>
                    <CheckCircle size={12} color="green" />
                    <Text>Excellent test coverage</Text>
                  </HStack>
                )}
                
                {performance.performanceBottlenecks.length === 0 && (
                  <HStack>
                    <CheckCircle size={12} color="green" />
                    <Text>No performance bottlenecks detected</Text>
                  </HStack>
                )}
              </VStack>
            </VStack>

            <VStack align="start" spacing={3}>
              <Text fontSize="sm" fontWeight="medium" color="orange.500">Areas for Improvement</Text>
              <VStack align="start" spacing={1} fontSize="xs">
                {(performance.performanceGrade === 'D' || performance.performanceGrade === 'F') && (
                  <HStack>
                    <AlertTriangle size={12} color="red" />
                    <Text>Performance needs significant improvement</Text>
                  </HStack>
                )}
                
                {performance.complexity.cognitive > 10 && (
                  <HStack>
                    <AlertTriangle size={12} color="orange" />
                    <Text>High complexity - consider refactoring</Text>
                  </HStack>
                )}
                
                {performance.testCoverage.percentage < 70 && (
                  <HStack>
                    <AlertTriangle size={12} color="orange" />
                    <Text>Insufficient test coverage</Text>
                  </HStack>
                )}
                
                {performance.trends.performanceChange === 'degrading' && (
                  <HStack>
                    <AlertTriangle size={12} color="red" />
                    <Text>Performance is trending downward</Text>
                  </HStack>
                )}
              </VStack>
            </VStack>
          </SimpleGrid>
        </CardBody>
      </Card>
    </VStack>
  );
};

export default PerformanceTab;


