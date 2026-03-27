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
  useColorModeValue,
} from '@chakra-ui/react';
import { Wrench, Shield, Layers, Eye } from 'lucide-react';
import qaService from '../../services/qaService';
import type { SelfHealingReport, APIValidationReport, CoverageAuditReport, UIAuditReport } from '../../services/qaService';
import SelfHealerPanel from './SelfHealerPanel';
import APIValidatorPanel from './APIValidatorPanel';
import CoverageAuditorPanel from './CoverageAuditorPanel';
import UIUXAnalystPanel from './UIUXAnalystPanel';

interface AgentReportsTabProps {
  runId?: string;
}

export default function AgentReportsTab({ runId }: AgentReportsTabProps) {
  const [selfHealing, setSelfHealing] = useState<SelfHealingReport | null>(null);
  const [apiValidation, setApiValidation] = useState<APIValidationReport | null>(null);
  const [coverageAudit, setCoverageAudit] = useState<CoverageAuditReport | null>(null);
  const [uiAudit, setUiAudit] = useState<UIAuditReport | null>(null);
  const [loading, setLoading] = useState(false);

  const bg = useColorModeValue('white', 'gray.800');

  useEffect(() => {
    if (runId) loadReports();
  }, [runId]);

  async function loadReports() {
    setLoading(true);
    try {
      const data = await qaService.getProductIntelligence(runId!);
      setSelfHealing(data.selfHealing || null);
      setApiValidation(data.apiValidation || null);
      setCoverageAudit(data.coverageAudit || null);
      setUiAudit(data.uiAudit || null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  if (!runId) {
    return (
      <Box p={6} textAlign="center">
        <Text color="gray.500">Run a QA analysis to see specialist agent reports</Text>
      </Box>
    );
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
    { key: 'self-healer', label: 'Self-Healer Report', icon: Wrench, color: 'pink', data: selfHealing, score: selfHealing?.healthScore, component: selfHealing ? <SelfHealerPanel report={selfHealing} /> : null },
    { key: 'api-validator', label: 'API Validator Report', icon: Shield, color: 'orange', data: apiValidation, score: apiValidation?.apiHealthScore, component: apiValidation ? <APIValidatorPanel report={apiValidation} /> : null },
    { key: 'coverage-auditor', label: 'Coverage Auditor Report', icon: Layers, color: 'blue', data: coverageAudit, score: coverageAudit?.coverageScore, component: coverageAudit ? <CoverageAuditorPanel report={coverageAudit} /> : null },
    { key: 'ui-ux-analyst', label: 'UI/UX Analyst Report', icon: Eye, color: 'purple', data: uiAudit, score: uiAudit?.accessibilityScore, component: uiAudit ? <UIUXAnalystPanel report={uiAudit} /> : null },
  ];

  return (
    <Accordion allowMultiple defaultIndex={[0]}>
      {panels.map(panel => (
        <AccordionItem key={panel.key} border="1px solid" borderColor={useColorModeValue('gray.200', 'gray.600')} borderRadius="lg" mb={3} overflow="hidden">
          <AccordionButton py={3} _hover={{ bg: `${panel.color}.50` }}>
            <HStack flex={1} spacing={3}>
              <panel.icon size={18} />
              <Text fontWeight="bold" fontSize="sm">{panel.label}</Text>
              {panel.score !== undefined && panel.score !== null && (
                <Badge colorScheme={panel.score >= 80 ? 'green' : panel.score >= 60 ? 'yellow' : 'red'}>
                  {panel.score}/100
                </Badge>
              )}
              {!panel.data && (
                <Badge colorScheme="gray" variant="outline">Not Available</Badge>
              )}
            </HStack>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel pb={4}>
            {panel.component || (
              <Text color="gray.500" fontSize="sm">This agent hasn't produced a report for this run yet.</Text>
            )}
          </AccordionPanel>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
