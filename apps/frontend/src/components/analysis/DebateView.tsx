import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Badge,
  Text,
  Progress,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Divider,
  Heading,
  Spinner,
  Alert,
  AlertIcon,
  useColorModeValue,
  SimpleGrid,
  Icon,
  Flex,
} from '@chakra-ui/react';
import { arangoDBService } from '../../services/arangodbService';

// =====================================================
// TYPES
// =====================================================

interface DebateRound {
  roundNumber: number;
  agentName: string;
  role: 'analyzer' | 'challenger' | 'synthesizer';
  findingsCount: number;
  verifiedCount: number;
  falsePositiveCount: number;
  timestamp: string;
  duration: number;
  summary: string;
}

interface DebateResult {
  debateId: string;
  domain: string;
  rounds: DebateRound[];
  totalProposed: number;
  totalVerified: number;
  totalFalsePositives: number;
  convergenceScore: number;
  status: 'in_progress' | 'converged' | 'max_rounds_reached';
}

interface DebateViewProps {
  repositoryId: string;
  analysisType?: string;
}

// =====================================================
// ROLE DISPLAY HELPERS
// =====================================================

const ROLE_COLORS: Record<string, string> = {
  analyzer: 'blue',
  challenger: 'orange',
  synthesizer: 'green',
};

const ROLE_LABELS: Record<string, string> = {
  analyzer: 'Analyzer',
  challenger: 'Challenger',
  synthesizer: 'Synthesizer',
};

const ROLE_ICONS: Record<string, string> = {
  analyzer: '\uD83D\uDD0D',
  challenger: '\u2694\uFE0F',
  synthesizer: '\uD83E\uDD1D',
};

// =====================================================
// DEBATE VIEW COMPONENT
// =====================================================

export const DebateView: React.FC<DebateViewProps> = ({
  repositoryId,
  analysisType = 'security',
}) => {
  const [debateResult, setDebateResult] = useState<DebateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const roundBg = useColorModeValue('gray.50', 'gray.700');
  const timelineBg = useColorModeValue('gray.300', 'gray.500');

  const fetchDebateResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await arangoDBService.executeAQL(
        `FOR d IN doc_agent_analyses
          FILTER d.repositoryId == @repoId
            AND d.analysisType == @type
            AND d.debateRounds != null
          SORT d.created_at DESC
          LIMIT 1
          RETURN d`,
        { repoId: repositoryId, type: analysisType }
      );

      if (results.length > 0) {
        const raw = results[0];
        const rounds: DebateRound[] = (raw.debateRounds || []).map(
          (r: any, idx: number) => ({
            roundNumber: idx + 1,
            agentName: r.agentName || r.agent || 'Unknown',
            role: r.role || 'analyzer',
            findingsCount: r.findingsCount || r.findings?.length || 0,
            verifiedCount: r.verifiedCount || 0,
            falsePositiveCount: r.falsePositiveCount || r.falsePositives || 0,
            timestamp: r.timestamp || r.completedAt || new Date().toISOString(),
            duration: r.duration || 0,
            summary: r.summary || '',
          })
        );

        const totalProposed = raw.totalProposed || rounds.reduce((s, r) => s + r.findingsCount, 0);
        const totalVerified = raw.totalVerified || rounds.reduce((s, r) => s + r.verifiedCount, 0);
        const totalFP = raw.totalFalsePositives || rounds.reduce((s, r) => s + r.falsePositiveCount, 0);

        setDebateResult({
          debateId: raw._key || raw.debateId || '',
          domain: raw.domain || analysisType,
          rounds,
          totalProposed,
          totalVerified,
          totalFalsePositives: totalFP,
          convergenceScore: raw.convergenceScore || (totalProposed > 0 ? totalVerified / totalProposed : 0),
          status: raw.status || 'converged',
        });
      } else {
        setDebateResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load debate results');
    } finally {
      setLoading(false);
    }
  }, [repositoryId, analysisType]);

  useEffect(() => {
    fetchDebateResults();
  }, [fetchDebateResults]);

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="lg" />
        <Text mt={3} color="gray.500">Loading debate results...</Text>
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

  if (!debateResult) {
    return (
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        No debate analysis found for this repository. Run a comprehensive analysis to see debate results.
      </Alert>
    );
  }

  const fpRate =
    debateResult.totalProposed > 0
      ? ((debateResult.totalFalsePositives / debateResult.totalProposed) * 100).toFixed(1)
      : '0.0';

  const verificationRate =
    debateResult.totalProposed > 0
      ? (debateResult.totalVerified / debateResult.totalProposed) * 100
      : 0;

  return (
    <Box bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor} p={6}>
      {/* Header */}
      <HStack justify="space-between" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="md">Debate Analysis</Heading>
          <Text fontSize="sm" color="gray.500">
            {debateResult.domain.charAt(0).toUpperCase() + debateResult.domain.slice(1)} domain
            {' \u2022 '} {debateResult.rounds.length} rounds
          </Text>
        </VStack>
        <Badge
          colorScheme={debateResult.status === 'converged' ? 'green' : 'yellow'}
          fontSize="sm"
          px={3}
          py={1}
          borderRadius="full"
        >
          {debateResult.status === 'converged' ? 'Converged' : 'In Progress'}
        </Badge>
      </HStack>

      {/* Summary Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Stat>
          <StatLabel>Proposed</StatLabel>
          <StatNumber>{debateResult.totalProposed}</StatNumber>
          <StatHelpText>Total findings</StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Verified</StatLabel>
          <StatNumber color="green.500">{debateResult.totalVerified}</StatNumber>
          <StatHelpText>Confirmed real</StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>False Positives</StatLabel>
          <StatNumber color="red.400">{debateResult.totalFalsePositives}</StatNumber>
          <StatHelpText>Caught by challenger</StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>FP Rate</StatLabel>
          <StatNumber>{fpRate}%</StatNumber>
          <StatHelpText>False positive rate</StatHelpText>
        </Stat>
      </SimpleGrid>

      {/* Verification Progress Bar */}
      <Box mb={6}>
        <HStack justify="space-between" mb={1}>
          <Text fontSize="sm" fontWeight="medium">Verification Rate</Text>
          <Text fontSize="sm" color="gray.500">{verificationRate.toFixed(1)}%</Text>
        </HStack>
        <Progress
          value={verificationRate}
          colorScheme={verificationRate > 80 ? 'green' : verificationRate > 50 ? 'yellow' : 'red'}
          borderRadius="full"
          size="md"
          hasStripe
        />
      </Box>

      <Divider mb={6} />

      {/* Debate Timeline */}
      <Heading size="sm" mb={4}>Debate Timeline</Heading>
      <VStack spacing={0} align="stretch" position="relative">
        {/* Vertical timeline line */}
        <Box
          position="absolute"
          left="20px"
          top="0"
          bottom="0"
          width="2px"
          bg={timelineBg}
          zIndex={0}
        />

        {debateResult.rounds.map((round, idx) => (
          <HStack
            key={idx}
            spacing={4}
            p={4}
            bg={roundBg}
            borderRadius="md"
            mb={idx < debateResult.rounds.length - 1 ? 3 : 0}
            position="relative"
            zIndex={1}
            ml="10px"
          >
            {/* Timeline dot */}
            <Box
              position="absolute"
              left="-14px"
              top="50%"
              transform="translateY(-50%)"
              w="10px"
              h="10px"
              borderRadius="full"
              bg={`${ROLE_COLORS[round.role] || 'gray'}.400`}
              border="2px solid"
              borderColor={bgColor}
            />

            <Flex direction="column" flex={1}>
              <HStack mb={1}>
                <Text fontSize="lg">{ROLE_ICONS[round.role] || ''}</Text>
                <Text fontWeight="bold" fontSize="sm">{round.agentName}</Text>
                <Badge colorScheme={ROLE_COLORS[round.role] || 'gray'} size="sm">
                  {ROLE_LABELS[round.role] || round.role}
                </Badge>
                <Text fontSize="xs" color="gray.500" ml="auto">
                  Round {round.roundNumber}
                </Text>
              </HStack>

              <HStack spacing={4} fontSize="sm" color="gray.600">
                <Text>{round.findingsCount} findings</Text>
                {round.role === 'challenger' && (
                  <>
                    <Text color="green.500">{round.verifiedCount} verified</Text>
                    <Text color="red.400">{round.falsePositiveCount} FP caught</Text>
                  </>
                )}
                {round.duration > 0 && <Text>{(round.duration / 1000).toFixed(1)}s</Text>}
              </HStack>

              {round.summary && (
                <Text fontSize="xs" color="gray.500" mt={1} noOfLines={2}>
                  {round.summary}
                </Text>
              )}
            </Flex>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
};

export default DebateView;
