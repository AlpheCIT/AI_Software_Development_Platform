/**
 * ActionableSummary - Compact banner showing key health metrics at a glance
 * Always visible at the top of the dashboard with color-coded health indicator.
 * Now supports unified CodeHealth from the Zustand store with agent score breakdown.
 */

import React from 'react';
import {
  Box,
  HStack,
  Text,
  Badge,
  Tooltip,
  useColorModeValue,
  Icon,
} from '@chakra-ui/react';
import { Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import type { CodeHealth } from '../../stores/qa-run-store';

// ── Agent label map for breakdown display ─────────────────────────────────

const AGENT_SCORE_LABELS: Record<string, { label: string; color: string }> = {
  selfHealer: { label: 'Self-Healer', color: 'pink' },
  apiValidator: { label: 'API', color: 'orange' },
  coverage: { label: 'Coverage', color: 'blue' },
  codeQuality: { label: 'Quality', color: 'yellow' },
  accessibility: { label: 'A11y', color: 'purple' },
  ux: { label: 'UX', color: 'teal' },
};

function getScoreBadgeColor(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

// ── Props ─────────────────────────────────────────────────────────────────

interface ActionableSummaryProps {
  codeHealth: number;        // 0-100 (legacy prop, used as fallback)
  mutationScore: number;     // 0-100
  criticalSmells: number;
  quickWins: number;
  topAction?: string;
  unifiedHealth?: CodeHealth | null;  // From store — preferred over codeHealth prop
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

const ActionableSummary: React.FC<ActionableSummaryProps> = ({
  codeHealth: codeHealthProp,
  mutationScore,
  criticalSmells,
  quickWins,
  topAction,
  unifiedHealth,
}) => {
  // Prefer unified health from store, fall back to legacy prop
  const effectiveScore = unifiedHealth?.score ?? codeHealthProp;
  const grade = unifiedHealth?.grade ?? (effectiveScore >= 90 ? 'A' : effectiveScore >= 80 ? 'B' : effectiveScore >= 70 ? 'C' : effectiveScore >= 60 ? 'D' : 'F');
  const gradeDescription = unifiedHealth?.gradeDescription ?? '';

  const lightColors = getHealthColor(effectiveScore);
  const darkColors = getHealthColorDark(effectiveScore);
  const bg = useColorModeValue(lightColors.bg, darkColors.bg);
  const borderColor = useColorModeValue(lightColors.border, darkColors.border);
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
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

        <Tooltip
          label={gradeDescription ? `${gradeDescription} (weighted average of agent scores)` : 'Weighted average of agent scores'}
          fontSize="xs"
          hasArrow
        >
          <Text fontSize="sm" fontWeight="semibold" color={textColor}>
            Code health: {grade} ({Math.round(effectiveScore)}/100)
          </Text>
        </Tooltip>

        {/* Agent score breakdown badges */}
        {unifiedHealth?.breakdown && Object.keys(unifiedHealth.breakdown).length > 0 && (
          <>
            <Text fontSize="sm" color={subtextColor}>&middot;</Text>
            <HStack spacing={1} flexWrap="wrap">
              {Object.entries(unifiedHealth.breakdown).map(([key, score]) => {
                const config = AGENT_SCORE_LABELS[key];
                if (!config) return null;
                return (
                  <Tooltip key={key} label={`${config.label}: ${Math.round(score)}/100`} fontSize="xs" hasArrow>
                    <Badge
                      colorScheme={getScoreBadgeColor(score)}
                      variant="subtle"
                      fontSize="2xs"
                      px={1.5}
                      borderRadius="full"
                    >
                      {config.label} {Math.round(score)}
                    </Badge>
                  </Tooltip>
                );
              })}
            </HStack>
          </>
        )}

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
