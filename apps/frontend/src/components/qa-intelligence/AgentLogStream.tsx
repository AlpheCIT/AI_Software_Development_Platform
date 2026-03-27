/**
 * AgentLogStream - Scrolling live log feed with color-coded agent messages
 */

import React, { useEffect, useRef } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  useColorModeValue,
  Flex,
  IconButton,
  Tooltip,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Trash2, ArrowDownToLine } from 'lucide-react';
import type { AgentLogEntry, AgentName } from '../../services/qaService';
import { AGENT_COLORS, AGENT_LABELS } from '../../hooks/useAgentStream';

const MotionBox = motion(Box);

// ── Log Entry Component ────────────────────────────────────────────────────

interface LogEntryProps {
  entry: AgentLogEntry;
}

const LEVEL_COLORS: Record<string, string> = {
  info: 'gray',
  warn: 'yellow',
  error: 'red',
  debug: 'gray',
};

const LogEntry: React.FC<LogEntryProps> = ({ entry }) => {
  const agentColor = AGENT_COLORS[entry.agent] || 'gray';
  const levelColor = LEVEL_COLORS[entry.level] || 'gray';
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const timeColor = useColorModeValue('gray.400', 'gray.500');
  const errorBg = useColorModeValue('red.50', 'red.900');

  const formattedTime = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <MotionBox
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      px={2}
      py={1}
      borderRadius="sm"
      bg={entry.level === 'error' ? errorBg : 'transparent'}
      _hover={{ bg: useColorModeValue('gray.50', 'gray.750') }}
      fontFamily="mono"
      fontSize="xs"
    >
      <HStack spacing={2} align="flex-start">
        {/* Timestamp */}
        <Text color={timeColor} flexShrink={0} minW="65px">
          {formattedTime}
        </Text>

        {/* Agent badge */}
        <Badge
          colorScheme={agentColor}
          variant="subtle"
          fontSize="2xs"
          px={1.5}
          borderRadius="sm"
          flexShrink={0}
          minW="70px"
          textAlign="center"
        >
          {AGENT_LABELS[entry.agent] || entry.agent}
        </Badge>

        {/* Level indicator for warnings/errors */}
        {entry.level !== 'info' && (
          <Badge
            colorScheme={levelColor}
            variant="solid"
            fontSize="2xs"
            px={1}
            borderRadius="sm"
            flexShrink={0}
          >
            {entry.level.toUpperCase()}
          </Badge>
        )}

        {/* Message */}
        <Text color={textColor} wordBreak="break-word" flex={1}>
          {entry.message}
        </Text>
      </HStack>
    </MotionBox>
  );
};

// ── Main Log Stream Component ──────────────────────────────────────────────

interface AgentLogStreamProps {
  logs: AgentLogEntry[];
  onClear: () => void;
  maxHeight?: string;
}

const AgentLogStream: React.FC<AgentLogStreamProps> = ({
  logs,
  onClear,
  maxHeight = '300px',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);

  const cardBg = useColorModeValue('gray.900', 'gray.950');
  const borderColor = useColorModeValue('gray.700', 'gray.600');
  const headerBg = useColorModeValue('gray.800', 'gray.850');
  const headerText = useColorModeValue('gray.200', 'gray.300');

  // Auto-scroll to bottom unless user has scrolled up
  useEffect(() => {
    if (scrollRef.current && !isUserScrolledUp.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Consider "scrolled up" if more than 50px from the bottom
    isUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 50;
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      isUserScrolledUp.current = false;
    }
  };

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      overflow="hidden"
    >
      {/* Header */}
      <Flex
        bg={headerBg}
        px={3}
        py={2}
        justify="space-between"
        align="center"
        borderBottom="1px solid"
        borderColor={borderColor}
      >
        <HStack spacing={2}>
          <Terminal size={14} color="#A0AEC0" />
          <Text fontSize="xs" fontWeight="semibold" color={headerText}>
            Agent Activity Log
          </Text>
          <Badge colorScheme="gray" variant="subtle" fontSize="2xs">
            {logs.length} entries
          </Badge>
        </HStack>

        <HStack spacing={1}>
          <Tooltip label="Scroll to bottom">
            <IconButton
              aria-label="Scroll to bottom"
              icon={<ArrowDownToLine size={12} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              onClick={scrollToBottom}
              _hover={{ color: 'white' }}
            />
          </Tooltip>
          <Tooltip label="Clear logs">
            <IconButton
              aria-label="Clear logs"
              icon={<Trash2 size={12} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              onClick={onClear}
              _hover={{ color: 'white' }}
            />
          </Tooltip>
        </HStack>
      </Flex>

      {/* Log entries */}
      <Box
        ref={scrollRef}
        onScroll={handleScroll}
        maxH={maxHeight}
        overflowY="auto"
        p={1}
        css={{
          '&::-webkit-scrollbar': { width: '6px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: '#4A5568',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb:hover': { background: '#718096' },
        }}
      >
        {logs.length === 0 ? (
          <Flex justify="center" align="center" py={8}>
            <Text fontSize="xs" color="gray.500" fontFamily="mono">
              Waiting for agent activity...
            </Text>
          </Flex>
        ) : (
          <AnimatePresence initial={false}>
            <VStack spacing={0} align="stretch">
              {logs.map((entry) => (
                <LogEntry key={entry.id} entry={entry} />
              ))}
            </VStack>
          </AnimatePresence>
        )}
      </Box>
    </Box>
  );
};

export default AgentLogStream;
