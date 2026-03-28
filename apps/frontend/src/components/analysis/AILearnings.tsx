/**
 * AILearnings - Displays AI learning patterns from the AI Orchestration service
 *
 * Fetches learnings from GET /api/v1/ai-orchestration/learnings and groups
 * them by domain with trend indicators.
 */

import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  Divider,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  IconButton,
  Tooltip,
  Tag,
  Wrap,
  WrapItem,
  useColorModeValue
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { apiClient } from '../../lib/api/client';

interface LearningPattern {
  id?: string;
  patternName: string;
  domain: string;
  frequency: number;
  trend: 'improving' | 'worsening' | 'stable';
  lastSeen?: string;
  relatedFiles?: string[];
  description?: string;
  confidence?: number;
}

const domainColorMap: Record<string, string> = {
  SECURITY: 'red',
  Security: 'red',
  security: 'red',
  PERFORMANCE: 'orange',
  Performance: 'orange',
  performance: 'orange',
  DOCUMENTATION: 'blue',
  Documentation: 'blue',
  documentation: 'blue',
  ARCHITECTURE: 'purple',
  Architecture: 'purple',
  architecture: 'purple',
  QUALITY: 'teal',
  Quality: 'teal',
  quality: 'teal',
  DEPENDENCY: 'cyan',
  Dependency: 'cyan',
  dependency: 'cyan',
};

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'improving':
      return <TrendingUp size={16} color="green" />;
    case 'worsening':
      return <TrendingDown size={16} color="red" />;
    case 'stable':
    default:
      return <Minus size={16} color="gray" />;
  }
}

function getTrendColor(trend: string): string {
  switch (trend) {
    case 'improving': return 'green';
    case 'worsening': return 'red';
    case 'stable':
    default: return 'gray';
  }
}

export default function AILearnings() {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['ai-learnings'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/ai-orchestration/learnings');
      return response.data;
    },
    retry: 2,
  });

  const learnings: LearningPattern[] = data?.learnings || [];

  // Group by domain
  const grouped = learnings.reduce<Record<string, LearningPattern[]>>((acc, learning) => {
    const domain = learning.domain || 'Other';
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(learning);
    return acc;
  }, {});

  // Summary stats
  const improving = learnings.filter(l => l.trend === 'improving').length;
  const worsening = learnings.filter(l => l.trend === 'worsening').length;
  const stable = learnings.filter(l => l.trend === 'stable').length;

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between" align="center">
        <Heading size="lg">AI Learnings</Heading>
        <HStack spacing={2}>
          {isFetching && !isLoading && <Spinner size="sm" color="blue.500" />}
          <Tooltip label="Refresh">
            <IconButton
              aria-label="Refresh learnings"
              icon={<RefreshCw size={16} />}
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              isLoading={isFetching}
            />
          </Tooltip>
        </HStack>
      </HStack>

      {isLoading ? (
        <HStack spacing={3} justify="center" py={12}>
          <Spinner size="lg" color="blue.500" />
          <Text>Loading AI learnings...</Text>
        </HStack>
      ) : isError ? (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">Could not load AI learnings</Text>
            <Text fontSize="sm">
              {error instanceof Error ? error.message : 'AI Orchestration service may be offline.'}
            </Text>
            <Text fontSize="sm" mt={1}>
              Ensure the AI Orchestration service is running on port 8003.
            </Text>
          </Box>
        </Alert>
      ) : learnings.length === 0 ? (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Text>Run analysis to generate AI learnings. Learnings accumulate as the system analyzes more repositories.</Text>
        </Alert>
      ) : (
        <>
          {/* Summary Stats */}
          <StatGroup
            bg={cardBg}
            p={4}
            borderRadius="lg"
            border="1px solid"
            borderColor={borderColor}
          >
            <Stat>
              <StatLabel>Improving</StatLabel>
              <HStack>
                <StatNumber color="green.500">{improving}</StatNumber>
                <TrendingUp size={20} color="green" />
              </HStack>
            </Stat>
            <Stat>
              <StatLabel>Worsening</StatLabel>
              <HStack>
                <StatNumber color="red.500">{worsening}</StatNumber>
                <TrendingDown size={20} color="red" />
              </HStack>
            </Stat>
            <Stat>
              <StatLabel>Stable</StatLabel>
              <HStack>
                <StatNumber color="gray.500">{stable}</StatNumber>
                <Minus size={20} color="gray" />
              </HStack>
            </Stat>
            <Stat>
              <StatLabel>Total Patterns</StatLabel>
              <StatNumber>{learnings.length}</StatNumber>
            </Stat>
          </StatGroup>

          {/* Grouped by domain */}
          {Object.entries(grouped).map(([domain, patterns]) => (
            <Box
              key={domain}
              bg={cardBg}
              p={5}
              borderRadius="lg"
              border="1px solid"
              borderColor={borderColor}
            >
              <HStack mb={4}>
                <Badge
                  colorScheme={domainColorMap[domain] || 'gray'}
                  fontSize="sm"
                  px={3}
                  py={1}
                >
                  {domain}
                </Badge>
                <Text fontSize="sm" color="gray.500">
                  {patterns.length} pattern{patterns.length !== 1 ? 's' : ''}
                </Text>
              </HStack>

              <VStack spacing={3} align="stretch">
                {patterns.map((pattern, index) => (
                  <Box key={pattern.id || index}>
                    {index > 0 && <Divider mb={3} />}
                    <HStack justify="space-between" align="start">
                      <VStack align="start" spacing={1} flex={1}>
                        <HStack>
                          <Text fontWeight="medium" fontSize="sm">
                            {pattern.patternName}
                          </Text>
                          <Badge
                            colorScheme={getTrendColor(pattern.trend)}
                            variant="subtle"
                            fontSize="xs"
                          >
                            <HStack spacing={1}>
                              <TrendIcon trend={pattern.trend} />
                              <Text>{pattern.trend}</Text>
                            </HStack>
                          </Badge>
                        </HStack>

                        {pattern.description && (
                          <Text fontSize="xs" color="gray.500">
                            {pattern.description}
                          </Text>
                        )}

                        <HStack spacing={3} fontSize="xs" color="gray.400">
                          <Text>Frequency: {pattern.frequency}</Text>
                          {pattern.confidence !== undefined && (
                            <Text>Confidence: {Math.round(pattern.confidence * 100)}%</Text>
                          )}
                          {pattern.lastSeen && (
                            <Text>Last seen: {new Date(pattern.lastSeen).toLocaleDateString()}</Text>
                          )}
                        </HStack>

                        {pattern.relatedFiles && pattern.relatedFiles.length > 0 && (
                          <Wrap spacing={1} mt={1}>
                            {pattern.relatedFiles.slice(0, 5).map((file, i) => (
                              <WrapItem key={i}>
                                <Tag size="sm" variant="outline" fontSize="xs">
                                  {file}
                                </Tag>
                              </WrapItem>
                            ))}
                            {pattern.relatedFiles.length > 5 && (
                              <WrapItem>
                                <Tag size="sm" variant="subtle" fontSize="xs">
                                  +{pattern.relatedFiles.length - 5} more
                                </Tag>
                              </WrapItem>
                            )}
                          </Wrap>
                        )}
                      </VStack>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            </Box>
          ))}
        </>
      )}
    </VStack>
  );
}
