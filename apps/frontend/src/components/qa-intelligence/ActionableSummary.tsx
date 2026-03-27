/**
 * ActionableSummary - Compact banner showing key health metrics at a glance
 * Always visible at the top of the dashboard with color-coded health indicator
 */

import React from 'react';
import {
  Box,
  HStack,
  Text,
  useColorModeValue,
  Icon,
} from '@chakra-ui/react';
import { Zap, AlertTriangle, CheckCircle } from 'lucide-react';

interface ActionableSummaryProps {
  codeHealth: number;   // 0-100
  mutationScore: number; // 0-100
  criticalSmells: number;
  quickWins: number;
  topAction?: string;
}

function getHealthColor(score: number): { bg: string; border: string; icon: React.ElementType } {
  if (score >= 80) return { bg: 'green.50', border: 'green.400', icon: CheckCircle };
  if (score >= 60) return { bg: 'yellow.50', border: 'yellow.400', icon: AlertTriangle };
  return { bg: 'red.50', border: 'red.400', icon: AlertTriangle };
}

function getHealthColorDark(score: number): { bg: string; border: string } {
  if (score >= 80) return { bg: 'green.900', border: 'green.400' };
  if (score >= 60) return { bg: 'yellow.900', border: 'yellow.400' };
  return { bg: 'red.900', border: 'red.400' };
}

function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

const ActionableSummary: React.FC<ActionableSummaryProps> = ({
  codeHealth,
  mutationScore,
  criticalSmells,
  quickWins,
  topAction,
}) => {
  const lightColors = getHealthColor(codeHealth);
  const darkColors = getHealthColorDark(codeHealth);
  const bg = useColorModeValue(lightColors.bg, darkColors.bg);
  const borderColor = useColorModeValue(lightColors.border, darkColors.border);
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const grade = getGrade(codeHealth);
  const HealthIcon = lightColors.icon;

  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      px={4}
      py={3}
    >
      <HStack spacing={3} flexWrap="wrap">
        <Icon as={HealthIcon} boxSize={5} color={borderColor} />

        <Text fontSize="sm" fontWeight="semibold" color={textColor}>
          Code health: {grade} ({Math.round(codeHealth)}/100)
        </Text>

        <Text fontSize="sm" color={subtextColor}>&middot;</Text>

        <Text fontSize="sm" color={textColor}>
          Mutation: {Math.round(mutationScore)}%
        </Text>

        <Text fontSize="sm" color={subtextColor}>&middot;</Text>

        <Text fontSize="sm" color={criticalSmells > 0 ? 'red.500' : textColor}>
          {criticalSmells} critical smell{criticalSmells !== 1 ? 's' : ''}
        </Text>

        <Text fontSize="sm" color={subtextColor}>&middot;</Text>

        <Text fontSize="sm" color={textColor}>
          {quickWins} quick win{quickWins !== 1 ? 's' : ''}
        </Text>

        {topAction && (
          <>
            <Text fontSize="sm" color={subtextColor}>&middot;</Text>
            <HStack spacing={1}>
              <Icon as={Zap} boxSize={3} color="orange.400" />
              <Text fontSize="sm" color={textColor} fontWeight="medium" noOfLines={1} maxW="300px">
                Next: {topAction}
              </Text>
            </HStack>
          </>
        )}
      </HStack>
    </Box>
  );
};

export default ActionableSummary;
