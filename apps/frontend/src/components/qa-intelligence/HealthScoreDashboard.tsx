/**
 * HealthScoreDashboard - Aggregate health scores from all agents
 * 7 circular gauges + overall health score
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  SimpleGrid,
  Spinner,
  Badge,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  Activity,
  Shield,
  Layers,
  Eye,
  Palette,
  Bug,
  Code,
  Wrench,
  Heart,
} from 'lucide-react';
import qaService from '../../services/qaService';
import type { HealthScores } from '../../services/qaService';

interface HealthScoreDashboardProps {
  runId?: string;
}

// Circular gauge component
function ScoreGauge({
  score,
  label,
  icon: IconComponent,
  color,
  onClick,
}: {
  score: number | null;
  label: string;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
}) {
  const bg = useColorModeValue('white', 'gray.750');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.700', 'gray.200');

  const displayScore = score ?? 0;
  const scoreColor = score === null ? 'gray' : displayScore >= 80 ? 'green' : displayScore >= 60 ? 'yellow' : 'red';
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (circumference * displayScore) / 100;

  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      p={3}
      textAlign="center"
      cursor={onClick ? 'pointer' : 'default'}
      _hover={onClick ? { shadow: 'md', borderColor: `${color}.300` } : {}}
      onClick={onClick}
      transition="all 0.2s"
    >
      <Box position="relative" w="90px" h="90px" mx="auto" mb={2}>
        <svg width="90" height="90" viewBox="0 0 90 90">
          {/* Background circle */}
          <circle cx="45" cy="45" r="40" fill="none" stroke={useColorModeValue('#E2E8F0', '#2D3748')} strokeWidth="6" />
          {/* Score arc */}
          <circle
            cx="45" cy="45" r="40" fill="none"
            stroke={score === null ? '#A0AEC0' : `var(--chakra-colors-${scoreColor}-400)`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 45 45)"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" textAlign="center">
          <Text fontSize="xl" fontWeight="bold" color={score === null ? 'gray.400' : `${scoreColor}.500`}>
            {score === null ? '—' : displayScore}
          </Text>
        </Box>
      </Box>
      <HStack justify="center" spacing={1}>
        <IconComponent size={12} />
        <Text fontSize="xs" fontWeight="bold" color={textColor} noOfLines={1}>{label}</Text>
      </HStack>
      <Badge colorScheme={scoreColor} fontSize="2xs" mt={1}>
        {score === null ? 'N/A' : displayScore >= 80 ? 'Healthy' : displayScore >= 60 ? 'Needs Work' : 'Critical'}
      </Badge>
    </Box>
  );
}

export default function HealthScoreDashboard({ runId }: HealthScoreDashboardProps) {
  const [scores, setScores] = useState<HealthScores | null>(null);
  const [loading, setLoading] = useState(false);
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  useEffect(() => {
    loadScores();
  }, [runId]);

  async function loadScores() {
    setLoading(true);
    try {
      let effectiveRunId = runId;

      // If no runId provided, fetch the latest completed run
      if (!effectiveRunId) {
        try {
          const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || '';
          const runsResponse = await fetch(`${QA_ENGINE_URL}/qa/runs`);
          if (runsResponse.ok) {
            const runsData = await runsResponse.json();
            const completedRuns = (runsData.runs || []).filter((r: any) => r.status === 'completed');
            const latestRun = completedRuns[0];
            if (latestRun) {
              effectiveRunId = latestRun._key || latestRun.runId;
            }
          }
        } catch { /* ignore */ }
      }

      if (!effectiveRunId) {
        setLoading(false);
        return;
      }

      const data = await qaService.getProductIntelligence(effectiveRunId);
      // Use unified health score breakdown when available, fall back to individual scores
      const unified = data.summary?.unifiedHealthScore;
      setScores({
        codeQuality: unified?.breakdown?.['code-quality']?.score ?? data.summary?.codeHealthScore ?? null,
        selfHealing: unified?.breakdown?.['self-healer']?.score ?? data.summary?.selfHealingScore ?? null,
        apiHealth: unified?.breakdown?.['api-validator']?.score ?? data.summary?.apiHealthScore ?? null,
        coverage: unified?.breakdown?.['coverage-auditor']?.score ?? data.summary?.coverageScore ?? null,
        accessibility: data.summary?.accessibilityScore ?? null,
        ux: unified?.breakdown?.['ui-ux-analyst']?.score ?? data.summary?.uxScore ?? null,
        mutation: null, // Comes from run data, not product intelligence
      });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  // Calculate overall health — prefer unified score from backend, fall back to simple average
  const scoreEntries = scores ? Object.values(scores).filter((s): s is number => s !== null) : [];
  const overallHealth = scoreEntries.length > 0
    ? Math.round(scoreEntries.reduce((a, b) => a + b, 0) / scoreEntries.length)
    : null;

  const overallColor = overallHealth === null ? 'gray' : overallHealth >= 80 ? 'green' : overallHealth >= 60 ? 'yellow' : 'red';

  const gaugeConfigs = [
    { key: 'codeQuality', label: 'Code Quality', icon: Code, color: 'yellow' },
    { key: 'selfHealing', label: 'Self-Healing', icon: Wrench, color: 'pink' },
    { key: 'apiHealth', label: 'API Health', icon: Shield, color: 'orange' },
    { key: 'coverage', label: 'Coverage', icon: Layers, color: 'blue' },
    { key: 'accessibility', label: 'Accessibility', icon: Eye, color: 'purple' },
    { key: 'ux', label: 'UX Score', icon: Palette, color: 'teal' },
    { key: 'mutation', label: 'Mutation', icon: Bug, color: 'red' },
  ];

  if (loading) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="lg" />
        <Text mt={2} color="gray.500">Loading health scores...</Text>
      </Box>
    );
  }

  return (
    <Box bg={bg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
      {/* Overall Health */}
      <VStack mb={4}>
        <HStack>
          <Heart size={20} />
          <Text fontSize="lg" fontWeight="bold">Platform Health</Text>
          {overallHealth !== null && (
            <Badge colorScheme={overallColor} fontSize="sm" px={2}>
              {overallHealth}/100
            </Badge>
          )}
        </HStack>
        {!scores && !loading && (
          <Text fontSize="sm" color="gray.500">Run a QA analysis to see health scores</Text>
        )}
      </VStack>

      {/* Score Gauges Grid */}
      <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 7 }} spacing={3}>
        {gaugeConfigs.map(cfg => (
          <ScoreGauge
            key={cfg.key}
            score={scores ? (scores as any)[cfg.key] : null}
            label={cfg.label}
            icon={cfg.icon}
            color={cfg.color}
          />
        ))}
      </SimpleGrid>

      {/* Legend */}
      <HStack justify="center" mt={4} spacing={4} fontSize="xs" color="gray.500">
        <HStack><Box w="8px" h="8px" bg="green.400" borderRadius="full" /><Text>≥80 Healthy</Text></HStack>
        <HStack><Box w="8px" h="8px" bg="yellow.400" borderRadius="full" /><Text>60-79 Needs Work</Text></HStack>
        <HStack><Box w="8px" h="8px" bg="red.400" borderRadius="full" /><Text>&lt;60 Critical</Text></HStack>
      </HStack>
    </Box>
  );
}
