/**
 * AgentControlRoom - The "Plant Manager" container
 * Combines: Flow Diagram + Live Reasoning Stream + Agent Deep-Dive Panel
 * Layout: Flow on left, deep-dive on right (when agent selected)
 */

import React, { useState } from 'react';
import {
  Box,
  Grid,
  useColorModeValue,
} from '@chakra-ui/react';
import { AnimatePresence } from 'framer-motion';
import type { AgentState, AgentName } from '../../services/qaService';
import type { AgentStreamingState, HandoffInfo } from '../../hooks/useAgentStream';
import AgentFlowDiagram from './AgentFlowDiagram';
import LiveReasoningStream from './LiveReasoningStream';
import AgentDeepDivePanel from './AgentDeepDivePanel';

// Agent config for labels/colors (shared)
const AGENT_META: Record<string, { label: string; color: string }> = {
  'repo-ingester': { label: 'Repo Ingester', color: 'gray' },
  strategist: { label: 'Strategist', color: 'blue' },
  generator: { label: 'Generator', color: 'green' },
  critic: { label: 'Critic', color: 'orange' },
  executor: { label: 'Executor', color: 'purple' },
  mutation: { label: 'Mutation Verifier', color: 'red' },
  'product-manager': { label: 'Product Manager', color: 'teal' },
  'research-assistant': { label: 'Research Assistant', color: 'cyan' },
  'code-quality-architect': { label: 'Code Quality Architect', color: 'yellow' },
  'self-healer': { label: 'Self-Healer', color: 'pink' },
  'api-validator': { label: 'API Validator', color: 'orange' },
  'coverage-auditor': { label: 'Coverage Auditor', color: 'linkedin' },
  'ui-ux-analyst': { label: 'UI/UX Analyst', color: 'purple' },
};

interface AgentControlRoomProps {
  agents: AgentState[];
  runId?: string;
  activeAgent: AgentName | null;
  streamingState: AgentStreamingState | null;
  streamingBuffer: string;
  handoffData: Record<string, HandoffInfo>;
}

export default function AgentControlRoom({
  agents,
  runId,
  activeAgent,
  streamingState,
  streamingBuffer,
  handoffData,
}: AgentControlRoomProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const bg = useColorModeValue('white', 'gray.800');

  const activeAgentMeta = activeAgent ? AGENT_META[activeAgent] : null;
  const selectedAgentMeta = selectedAgent ? AGENT_META[selectedAgent] : null;

  // Map mutation agent name for backend queries
  const selectedAgentBackendName = selectedAgent === 'mutation' ? 'mutation-verifier' : selectedAgent;

  return (
    <Box bg={bg} border="1px solid" borderColor={borderColor} borderRadius="lg" overflow="hidden">
      <Grid
        templateColumns={{ base: '1fr', xl: selectedAgent ? '3fr 2fr' : '1fr' }}
        transition="all 0.3s"
      >
        {/* Left: Flow Diagram + Live Reasoning */}
        <Box p={3}>
          {/* Flow Diagram */}
          <AgentFlowDiagram
            agents={agents}
            runId={runId}
            streamingState={streamingState}
            activeAgent={activeAgent}
            handoffData={handoffData}
            onAgentClick={(name) => setSelectedAgent(selectedAgent === name ? null : name)}
            selectedAgent={selectedAgent}
          />

          {/* Live Reasoning Stream (below flow, when an agent is active) */}
          {activeAgent && activeAgentMeta && (
            <Box mt={3}>
              <LiveReasoningStream
                agentName={activeAgent}
                agentLabel={activeAgentMeta.label}
                agentColor={activeAgentMeta.color}
                streamingState={streamingState}
                streamingBuffer={streamingBuffer}
                isActive={true}
              />
            </Box>
          )}
        </Box>

        {/* Right: Deep Dive Panel (slides in when agent selected) */}
        <AnimatePresence>
          {selectedAgent && selectedAgentMeta && runId && (
            <Box
              borderLeft="1px solid"
              borderColor={borderColor}
              overflow="hidden"
            >
              <AgentDeepDivePanel
                runId={runId}
                agent={selectedAgentBackendName || selectedAgent}
                agentLabel={selectedAgentMeta.label}
                agentColor={selectedAgentMeta.color}
                handoffData={handoffData[selectedAgent]}
                onClose={() => setSelectedAgent(null)}
              />
            </Box>
          )}
        </AnimatePresence>
      </Grid>
    </Box>
  );
}
