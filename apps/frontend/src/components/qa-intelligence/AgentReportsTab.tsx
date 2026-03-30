/**
 * AgentReportsTab - Wrapper showing all 4 specialist agent reports in an accordion
 * Fetches product intelligence data and renders each panel
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Text,
  Spinner,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  HStack,
  Badge,
  Alert,
  AlertIcon,
  useColorModeValue,
} from '@chakra-ui/react';
import { Wrench, Shield, Layers, Eye } from 'lucide-react';
import qaService from '../../services/qaService';
import type { SelfHealingReport, APIValidationReport, CoverageAuditReport, UIAuditReport } from '../../services/qaService';
import SelfHealerPanel from './SelfHealerPanel';
import APIValidatorPanel from './APIValidatorPanel';
import CoverageAuditorPanel from './CoverageAuditorPanel';
import UIUXAnalystPanel from './UIUXAnalystPanel';
import { ErrorBoundary } from '../ErrorBoundary';

const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || '';

interface AgentReportsTabProps {
  runId?: string;
}

export default function AgentReportsTab({ runId }: AgentReportsTabProps) {
  const [selfHealing, setSelfHealing] = useState<SelfHealingReport | null>(null);
  const [apiValidation, setApiValidation] = useState<APIValidationReport | null>(null);
  const [coverageAudit, setCoverageAudit] = useState<CoverageAuditReport | null>(null);
  const [uiAudit, setUiAudit] = useState<UIAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIndices, setExpandedIndices] = useState<number[]>([]);

  const bg = useColorModeValue('white', 'gray.800');

  useEffect(() => {
    loadReports();
  }, [runId]);

  async function loadReports() {
    setLoading(true);
    try {
      let effectiveRunId = runId;

      // If no runId provided, fetch the latest completed run
      if (!effectiveRunId) {
        try {
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
      setSelfHealing(data.selfHealing || null);
      setApiValidation(data.apiValidation || null);
      setCoverageAudit(data.coverageAudit || null);
      setUiAudit(data.uiAudit || null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  if (loading) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="lg" />
        <Text mt={2} color="gray.500">Loading agent reports...</Text>
      </Box>
    );
  }

  const hasAnyData = selfHealing || apiValidation || coverageAudit || uiAudit;

  if (!hasAnyData) {
    return (
      <Box p={6} textAlign="center">
        <Text color="gray.500">No specialist agent reports available yet. These agents run after the main QA pipeline completes.</Text>
      </Box>
    );
  }

  const panels = [
    { key: 'self-healer', label: 'Self-Healer', icon: Wrench, color: 'pink', data: selfHealing, score: selfHealing?.healthScore },
    { key: 'api-validator', label: 'API Validator', icon: Shield, color: 'orange', data: apiValidation, score: apiValidation?.apiHealthScore },
    { key: 'coverage-auditor', label: 'Coverage Auditor', icon: Layers, color: 'blue', data: coverageAudit, score: coverageAudit?.coverageScore },
    { key: 'ui-ux-analyst', label: 'UI/UX Analyst', icon: Eye, color: 'purple', data: uiAudit, score: uiAudit?.accessibilityScore },
  ];

  // Lazy-render panel content only when accordion is expanded
  function renderPanelContent(panel: typeof panels[number], index: number) {
    // Only render if this panel is expanded
    if (!expandedIndices.includes(index)) return null;

    const report = panel.data as any;
    if (!report || report.status === 'failed' || report.status === 'timeout' || report.status === 'not-run') {
      return renderAgentFallback(panel);
    }

    const PanelMap: Record<string, React.ReactNode> = {
      'self-healer': <SelfHealerPanel report={selfHealing!} />,
      'api-validator': <APIValidatorPanel report={apiValidation!} />,
      'coverage-auditor': <CoverageAuditorPanel report={coverageAudit!} />,
      'ui-ux-analyst': <UIUXAnalystPanel report={uiAudit!} />,
    };

    return (
      <ErrorBoundary fallbackTitle={`${panel.label} report failed to render`}>
        {PanelMap[panel.key] || renderAgentFallback(panel)}
      </ErrorBoundary>
    );
  }

  /** Render a status-aware fallback for agents that didn't produce a full report */
  function renderAgentFallback(panel: typeof panels[number]) {
    const report = panel.data as any;
    if (!report) {
      return <Alert status="info" borderRadius="md"><AlertIcon />{panel.label} was not selected for this repository.</Alert>;
    }
    if (report.status === 'failure' || report.status === 'failed') {
      return <Alert status="error" borderRadius="md"><AlertIcon />{panel.label} failed: {report.error || 'Unknown error'}</Alert>;
    }
    if (report.status === 'timeout') {
      return <Alert status="warning" borderRadius="md"><AlertIcon />{panel.label} timed out after {Math.round((report.duration || 0) / 1000)}s</Alert>;
    }
    if (report.status === 'skipped' || report.status === 'dependency-missing') {
      return <Alert status="info" borderRadius="md"><AlertIcon />{panel.label} skipped: {report.error || 'Dependency not available'}</Alert>;
    }
    if (report.status === 'not-run') {
      return <Alert status="info" borderRadius="md"><AlertIcon />{panel.label} was not selected for this run.</Alert>;
    }
    return <Text color="gray.500" fontSize="sm">This agent has not produced a report for this run yet.</Text>;
  }

  /** Get badge for agent status */
  function getStatusBadge(panel: typeof panels[number]) {
    const report = panel.data as any;
    if (!report) return <Badge colorScheme="gray" variant="outline">Not Selected</Badge>;
    if (report.status === 'failure' || report.status === 'failed') return <Badge colorScheme="red" variant="solid">Failed</Badge>;
    if (report.status === 'timeout') return <Badge colorScheme="orange" variant="solid">Timeout</Badge>;
    if (report.status === 'skipped' || report.status === 'dependency-missing') return <Badge colorScheme="yellow" variant="outline">Skipped</Badge>;
    if (report.status === 'not-run') return <Badge colorScheme="gray" variant="outline">Not Run</Badge>;
    if (panel.score !== undefined && panel.score !== null) {
      return <Badge colorScheme={panel.score >= 80 ? 'green' : panel.score >= 60 ? 'yellow' : 'red'}>{panel.score}/100</Badge>;
    }
    return null;
  }

  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Accordion allowMultiple index={expandedIndices} onChange={(indices) => setExpandedIndices(indices as number[])}>
      {panels.map((panel, index) => (
        <AccordionItem key={panel.key} border="1px solid" borderColor={borderColor} borderRadius="lg" mb={3} overflow="hidden">
          <AccordionButton py={3} _hover={{ bg: `${panel.color}.50` }}>
            <HStack flex={1} spacing={3}>
              <panel.icon size={18} />
              <Text fontWeight="bold" fontSize="sm">{panel.label} Report</Text>
              {getStatusBadge(panel)}
            </HStack>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel pb={4}>
            {renderPanelContent(panel, index)}
          </AccordionPanel>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
