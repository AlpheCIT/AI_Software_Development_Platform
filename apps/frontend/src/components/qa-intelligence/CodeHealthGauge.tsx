/**
 * CodeHealthGauge - Circular gauge showing code health score and letter grade
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

interface CodeHealthGaugeProps {
  score: number; // 0-100
  grade: string; // A, B, C, D, F
  summary: string;
  size?: string;
  thickness?: string;
}

function getGradeColor(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

function getGradeColorHex(score: number): string {
  if (score >= 80) return '#38A169';
  if (score >= 60) return '#D69E2E';
  return '#E53E3E';
}

const CodeHealthGauge: React.FC<CodeHealthGaugeProps> = ({
  score,
  grade,
  summary,
  size = '140px',
  thickness = '10px',
}) => {
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const trackColor = useColorModeValue('gray.100', 'gray.700');
  const colorScheme = getGradeColor(score);
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
                color={getGradeColorHex(score)}
                lineHeight={1}
              >
                {grade}
              </Text>
              <Text fontSize="xs" color={subtextColor} lineHeight={1} mt={1}>
                {displayScore}/100
              </Text>
            </VStack>
          </CircularProgressLabel>
        </CircularProgress>
      </Box>

      <Text
        fontSize="xs"
        fontWeight="semibold"
        color={subtextColor}
        textTransform="uppercase"
        letterSpacing="wide"
      >
        Code Health
      </Text>

      <Text
        fontSize="xs"
        color={subtextColor}
        textAlign="center"
        noOfLines={2}
        maxW="200px"
      >
        {summary}
      </Text>
    </VStack>
  );
};

export default CodeHealthGauge;
