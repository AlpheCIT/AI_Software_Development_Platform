import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Progress,
  Badge,
  SimpleGrid,
  Alert,
  AlertIcon,
  Box
} from '@chakra-ui/react';
import { fetchNodeDetails, createGraphQueryOptions } from '../../../lib/api/graph';
import { PerformanceMetric } from '../../../types/graph';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface PerformanceTabProps {
  nodeId: string;
}

export default function PerformanceTab({ nodeId }: PerformanceTabProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['node', nodeId],
    queryFn: () => fetchNodeDetails(nodeId),
    enabled: !!nodeId,
    ...createGraphQueryOptions(),
  });

  if (isLoading) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Text>Loading performance data...</Text>
      </VStack>
    );
  }

  if (error || !data) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="error">
          <AlertIcon />
          Unable to load performance details. Please try again.
        </Alert>
      </VStack>
    );
  }

  const performanceMetrics = data.performance || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'green';
      case 'warning': return 'yellow';
      case 'critical': return 'red';
      default: return 'gray';
    }
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === 'increasing') return 'increase';
    if (trend === 'decreasing') return 'decrease';
    return undefined;
  };

  if (performanceMetrics.length === 0) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">No Performance Metrics</Text>
            <Text fontSize="sm">No performance monitoring data is currently available for this component.</Text>
          </Box>
        </Alert>
      </VStack>
    );
  }

  const goodMetrics = performanceMetrics.filter(m => m.status === 'good').length;
  const warningMetrics = performanceMetrics.filter(m => m.status === 'warning').length;
  const criticalMetrics = performanceMetrics.filter(m => m.status === 'critical').length;

  return (
    <VStack spacing={6} align="stretch" p={4}>
      <Text fontSize="lg" fontWeight="bold">Performance Metrics</Text>

      {/* Performance Overview */}
      <Card>
        <CardBody>
          <Text fontWeight="medium" mb={3}>Performance Summary</Text>
          <SimpleGrid columns={3} spacing={4}>
            <Box textAlign="center">
              <Text fontSize="2xl" fontWeight="bold" color="green.500">
                {goodMetrics}
              </Text>
              <Text fontSize="sm" color="gray.600">Good</Text>
            </Box>
            <Box textAlign="center">
              <Text fontSize="2xl" fontWeight="bold" color="yellow.500">
                {warningMetrics}
              </Text>
              <Text fontSize="sm" color="gray.600">Warning</Text>
            </Box>
            <Box textAlign="center">
              <Text fontSize="2xl" fontWeight="bold" color="red.500">
                {criticalMetrics}
              </Text>
              <Text fontSize="sm" color="gray.600">Critical</Text>
            </Box>
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* Individual Metrics */}
      <SimpleGrid columns={2} spacing={4}>
        {performanceMetrics.map((metric, index) => (
          <Card key={index}>
            <CardBody>
              <Stat>
                <StatLabel>{metric.name}</StatLabel>
                <StatNumber>
                  {metric.value} {metric.unit}
                </StatNumber>
                <StatHelpText>
                  <HStack>
                    <Badge colorScheme={getStatusColor(metric.status)}>
                      {metric.status}
                    </Badge>
                    {metric.trend && (
                      <StatArrow 
                        type={getTrendIcon(metric.trend)} 
                      />
                    )}
                  </HStack>
                </StatHelpText>
              </Stat>

              <Progress
                value={Math.min((metric.value / metric.threshold) * 100, 100)}
                colorScheme={getStatusColor(metric.status)}
                size="sm"
                mt={2}
              />
              
              <Text fontSize="xs" color="gray.500" mt={1}>
                Threshold: {metric.threshold} {metric.unit}
              </Text>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      {/* Trend Chart for metrics with history */}
      {performanceMetrics.some(m => m.history && m.history.length > 0) && (
        <Card>
          <CardBody>
            <Text fontWeight="medium" mb={4}>Performance Trends</Text>
            <Box height="250px">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart>
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: number, name: string) => [
                      `${value}`,
                      name
                    ]}
                  />
                  {performanceMetrics
                    .filter(m => m.history && m.history.length > 0)
                    .map((metric, index) => (
                      <Line
                        key={index}
                        type="monotone"
                        dataKey="value"
                        data={metric.history || []}
                        stroke={`hsl(${index * 60}, 70%, 50%)`}
                        strokeWidth={2}
                        name={metric.name}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardBody>
        </Card>
      )}
    </VStack>
  );
}
