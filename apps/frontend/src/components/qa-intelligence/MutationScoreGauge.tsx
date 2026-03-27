/**
 * MutationScoreGauge - Circular gauge showing mutation testing score
 */

import React from 'react';
import {
  Box,
  CircularProgress,
  CircularProgressLabel,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';

interface MutationScoreGaugeProps {
  score: number; // 0-100
  totalMutants: number;
  killed: number;
  survived: number;
  size?: string;
  thickness?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

function getScoreColorHex(score: number): string {
  if (score >= 80) return '#38A169';
  if (score >= 60) return '#D69E2E';
  return '#E53E3E';
}

const MutationScoreGauge: React.FC<MutationScoreGaugeProps> = ({
  score,
  totalMutants,
  killed,
  survived,
  size = '140px',
  thickness = '10px',
}) => {
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const trackColor = useColorModeValue('gray.100', 'gray.700');
  const colorScheme = getScoreColor(score);
  const displayScore = Math.round(score);

  return (
    <VStack spacing={2} align="center">
      <Box position="relative">
        {/* Background track */}
        <CircularProgress
          value={100}
          size={size}
          thickness={thickness}
          color={trackColor}
          trackColor="transparent"
          position="absolute"
          top={0}
          left={0}
        />
        {/* Score fill */}
        <CircularProgress
          value={score}
          size={size}
          thickness={thickness}
          color={`${colorScheme}.400`}
          trackColor={trackColor}
          capIsRound
        >
          <CircularProgressLabel>
            <VStack spacing={0}>
              <Text
                fontSize="2xl"
                fontWeight="bold"
                color={getScoreColorHex(score)}
                lineHeight={1}
              >
                {displayScore}%
              </Text>
            </VStack>
          </CircularProgressLabel>
        </CircularProgress>

        {/* Target threshold indicator (80% line) */}
        <Box
          position="absolute"
          top="6px"
          left="50%"
          transform="translateX(-50%)"
          width="2px"
          height="6px"
          bg="green.600"
          borderRadius="full"
          opacity={0.6}
          title="80% target"
        />
      </Box>

      <Text fontSize="xs" fontWeight="semibold" color={subtextColor} textTransform="uppercase" letterSpacing="wide">
        Mutation Score
      </Text>

      <Text fontSize="xs" color={subtextColor}>
        {killed}/{totalMutants} killed &middot; {survived} survived
      </Text>
    </VStack>
  );
};

export default MutationScoreGauge;
