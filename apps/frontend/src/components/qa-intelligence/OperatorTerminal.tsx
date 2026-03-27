/**
 * OperatorTerminal - Full-screen dark terminal showing ALL agent activity
 * The "Claude Code experience" for multi-agent systems
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  HStack,
  Text,
  Badge,
  IconButton,
  Input,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, ArrowDown, Filter, Search } from 'lucide-react';
import type { AgentName } from '../../services/qaService';
import { AGENT_COLORS, AGENT_LABELS, type TimelineEntry } from '../../hooks/useAgentStream';

const MotionBox = motion(Box);

interface OperatorTerminalProps {
  timeline: TimelineEntry[];
  isRunning: boolean;
  onClose: () => void;
}

// Format a timeline entry into terminal output
function formatEntry(entry: TimelineEntry): { prefix: string; icon: string; color: string; text: string; isHandoff: boolean; isResponse: boolean } {
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false });
  const agentColor = AGENT_COLORS[entry.agent as AgentName] || 'gray';
  const agentLabel = (AGENT_LABELS[entry.agent as AgentName] || entry.agent).toUpperCase().padEnd(18);

  switch (entry.event) {
    case 'agent.started':
      return {
        prefix: time,
        icon: '▶',
        color: 'blue.300',
        text: `${agentLabel} ${(entry.data as any)?.step || (entry.data as any)?.message || 'Started'}`,
        isHandoff: false,
        isResponse: false,
      };
    case 'agent.completed': {
      const result = (entry.data as any)?.result;
      const summary = result ? Object.entries(result).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
      return {
        prefix: time,
        icon: '✓',
        color: 'green.300',
        text: `${agentLabel} Completed${summary ? ` (${summary.substring(0, 100)})` : ''}`,
        isHandoff: false,
        isResponse: false,
      };
    }
    case 'agent.streaming': {
      const data = entry.data as any;
      const fileInfo = data?.currentFile ? `Analyzing ${data.currentFile}${data.fileTotal ? ` (${data.fileIndex}/${data.fileTotal})` : ''}` : data?.text || '';
      return {
        prefix: time,
        icon: '│',
        color: 'gray.500',
        text: `  ${agentLabel.trim()} ${fileInfo.substring(0, 120)}`,
        isHandoff: false,
        isResponse: false,
      };
    }
    case 'agent.loop':
      return {
        prefix: time,
        icon: '⟳',
        color: 'orange.300',
        text: `${(entry.data as any)?.from?.toUpperCase()} → ${(entry.data as any)?.to?.toUpperCase()}  Loop: ${(entry.data as any)?.reason || 'Retrying'}`,
        isHandoff: true,
        isResponse: false,
      };
    default:
      return {
        prefix: time,
        icon: '·',
        color: 'gray.500',
        text: `${agentLabel} ${entry.event}: ${JSON.stringify(entry.data).substring(0, 100)}`,
        isHandoff: false,
        isResponse: false,
      };
  }
}

export default function OperatorTerminal({ timeline, isRunning, onClose }: OperatorTerminalProps) {
  const [filterAgent, setFilterAgent] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [timeline.length, autoScroll]);

  // Detect manual scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  }, []);

  // Filter timeline
  const filtered = timeline.filter(entry => {
    if (filterAgent && entry.agent !== filterAgent) return false;
    if (searchText) {
      const formatted = formatEntry(entry);
      if (!formatted.text.toLowerCase().includes(searchText.toLowerCase())) return false;
    }
    return true;
  });

  // Deduplicate rapid streaming events (keep every 3rd)
  const deduped = filtered.filter((entry, i) => {
    if (entry.event !== 'agent.streaming') return true;
    // Keep every 3rd streaming event to reduce noise
    const streamingBefore = filtered.slice(0, i).filter(e => e.event === 'agent.streaming' && e.agent === entry.agent).length;
    return streamingBefore % 3 === 0;
  });

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="gray.950"
      zIndex={1000}
      display="flex"
      flexDirection="column"
    >
      {/* Terminal Header */}
      <HStack
        px={4} py={2}
        bg="gray.900"
        borderBottom="1px solid"
        borderColor="gray.700"
        justify="space-between"
        flexShrink={0}
      >
        <HStack spacing={3}>
          <Terminal size={16} color="var(--chakra-colors-green-400)" />
          <Text color="green.400" fontFamily="mono" fontSize="sm" fontWeight="bold">
            QA Operator Terminal
          </Text>
          {isRunning && (
            <Badge colorScheme="green" variant="solid" fontSize="2xs">
              ● LIVE
            </Badge>
          )}
          <Badge colorScheme="gray" fontSize="2xs">
            {deduped.length} events
          </Badge>
        </HStack>

        <HStack spacing={2}>
          {/* Search */}
          <Input
            size="xs"
            placeholder="Search..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            bg="gray.800"
            borderColor="gray.700"
            color="gray.300"
            w="150px"
            fontFamily="mono"
            _placeholder={{ color: 'gray.600' }}
          />

          {/* Agent filter */}
          {filterAgent && (
            <Badge
              colorScheme={AGENT_COLORS[filterAgent as AgentName] || 'gray'}
              cursor="pointer"
              onClick={() => setFilterAgent(null)}
            >
              {AGENT_LABELS[filterAgent as AgentName] || filterAgent} ×
            </Badge>
          )}

          {/* Scroll to bottom */}
          {!autoScroll && (
            <IconButton
              aria-label="Scroll to bottom"
              icon={<ArrowDown size={14} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              onClick={() => {
                setAutoScroll(true);
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          )}

          {/* Close */}
          <Tooltip label="Press Esc to close">
            <IconButton
              aria-label="Close terminal"
              icon={<X size={16} />}
              size="sm"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'white' }}
              onClick={onClose}
            />
          </Tooltip>
        </HStack>
      </HStack>

      {/* Terminal Content */}
      <Box
        ref={containerRef}
        flex={1}
        overflowY="auto"
        px={4}
        py={2}
        fontFamily="mono"
        fontSize="xs"
        lineHeight="tall"
        onScroll={handleScroll}
        sx={{
          '&::-webkit-scrollbar': { width: '6px' },
          '&::-webkit-scrollbar-thumb': { bg: 'gray.700', borderRadius: 'full' },
        }}
      >
        {deduped.length === 0 ? (
          <Text color="gray.600" textAlign="center" py={8}>
            {isRunning ? 'Waiting for agent events...' : 'No events recorded. Start a QA run to see agent activity.'}
          </Text>
        ) : (
          <AnimatePresence initial={false}>
            {deduped.map((entry, i) => {
              const formatted = formatEntry(entry);
              const agentColor = AGENT_COLORS[entry.agent as AgentName] || 'gray';

              return (
                <MotionBox
                  key={`${entry.timestamp}-${i}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.1 }}
                  py={0.5}
                  _hover={{ bg: 'gray.900' }}
                  borderLeft={formatted.isHandoff ? '2px solid' : 'none'}
                  borderColor={formatted.isHandoff ? 'cyan.500' : 'transparent'}
                  pl={formatted.isHandoff ? 2 : 0}
                >
                  <HStack spacing={2} align="flex-start">
                    {/* Timestamp */}
                    <Text color="gray.600" minW="75px" flexShrink={0}>
                      [{formatted.prefix}]
                    </Text>

                    {/* Status icon */}
                    <Text color={formatted.color} minW="14px" flexShrink={0}>
                      {formatted.icon}
                    </Text>

                    {/* Agent name (clickable to filter) */}
                    <Text
                      color={`${agentColor}.400`}
                      fontWeight="bold"
                      minW="140px"
                      flexShrink={0}
                      cursor="pointer"
                      _hover={{ textDecoration: 'underline' }}
                      onClick={() => setFilterAgent(filterAgent === entry.agent ? null : entry.agent)}
                    >
                      {(AGENT_LABELS[entry.agent as AgentName] || entry.agent).toUpperCase()}
                    </Text>

                    {/* Content */}
                    <Text
                      color={entry.event === 'agent.streaming' ? 'gray.500' : 'gray.300'}
                      wordBreak="break-word"
                    >
                      {formatted.text.replace(formatted.prefix, '').replace(/^\s+/, '')}
                    </Text>
                  </HStack>
                </MotionBox>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </Box>

      {/* Status Bar */}
      <HStack
        px={4} py={1}
        bg="gray.900"
        borderTop="1px solid"
        borderColor="gray.700"
        fontSize="2xs"
        color="gray.500"
        justify="space-between"
        flexShrink={0}
      >
        <HStack spacing={3}>
          <Text>Events: {timeline.length}</Text>
          <Text>Shown: {deduped.length}</Text>
          {filterAgent && <Text>Filter: {AGENT_LABELS[filterAgent as AgentName]}</Text>}
        </HStack>
        <HStack spacing={3}>
          <Text>ESC to close</Text>
          <Text>Click agent name to filter</Text>
        </HStack>
      </HStack>
    </Box>
  );
}
