/**
 * ActivityTicker - Single-line status bar showing current agent activity
 * Compact header element with animated transitions between agent states
 */

import { Box, HStack, Text, Circle, useColorModeValue } from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import type { AgentName, AgentState } from '../../services/qaService';
import type { AgentStreamingState } from '../../hooks/useAgentStream';
import { AGENT_COLORS, AGENT_LABELS } from '../../hooks/useAgentStream';

const MotionHStack = motion(HStack);

interface ActivityTickerProps {
  activeAgent: AgentName | null;
  streamingState: AgentStreamingState | null;
  agents: AgentState[];
}

export default function ActivityTicker({ activeAgent, streamingState, agents }: ActivityTickerProps) {
  const bg = useColorModeValue('gray.100', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.400');

  const summary = useMemo(() => {
    const completed = agents.filter((a) => a.status === 'completed').length;
    const active = agents.filter((a) => a.status === 'active').length;
    const total = agents.length;
    if (completed === 0 && active === 0) return `${total} agents ready`;
    const parts: string[] = [];
    if (completed > 0) parts.push(`${completed} completed`);
    if (active > 0) parts.push(`${active} active`);
    const idle = total - completed - active;
    if (idle > 0) parts.push(`${idle} idle`);
    return parts.join(', ');
  }, [agents]);

  const activityText = streamingState?.text || streamingState?.currentFile || agents.find((a) => a.name === activeAgent)?.message || 'Working...';
  const animKey = activeAgent ? `${activeAgent}-${activityText}` : 'idle';
  const dotColor = activeAgent ? `${AGENT_COLORS[activeAgent]}.400` : 'gray.400';

  return (
    <Box bg={bg} borderRadius="full" px={3} py={1} overflow="hidden" maxW="100%">
      <AnimatePresence mode="wait">
        <MotionHStack
          key={animKey}
          spacing={2}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -20, opacity: 0 }}
          transition={{ duration: 0.3 }}
          align="center"
          overflow="hidden"
        >
          {activeAgent ? (
            <>
              <Circle
                size="8px"
                bg={dotColor}
                flexShrink={0}
                sx={{
                  animation: 'pulse 1.5s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                    '50%': { opacity: 0.5, transform: 'scale(1.4)' },
                  },
                }}
              />
              <Text fontSize="xs" fontWeight="bold" flexShrink={0} whiteSpace="nowrap">
                {AGENT_LABELS[activeAgent]}:
              </Text>
              <Text fontSize="xs" color={textColor} isTruncated maxW="400px">
                {activityText}
              </Text>
            </>
          ) : (
            <>
              <Circle size="8px" bg="gray.400" flexShrink={0} />
              <Text fontSize="xs" color={textColor}>
                {summary}
              </Text>
            </>
          )}
        </MotionHStack>
      </AnimatePresence>
    </Box>
  );
}
