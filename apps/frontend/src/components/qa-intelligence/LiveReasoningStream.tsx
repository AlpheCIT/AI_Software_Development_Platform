/**
 * LiveReasoningStream - "Watch Claude think in real-time" terminal component
 * Renders a dark terminal-style panel that streams agent reasoning text
 * with auto-scroll, blinking cursor, file headers, and token estimates.
 */

import React, { useEffect, useRef, useMemo, memo } from 'react';
import {
  Box,
  HStack,
  Text,
  Badge,
  Flex,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Circle, Terminal } from 'lucide-react';
import type { AgentName } from '../../services/qaService';
import type { AgentStreamingState } from '../../hooks/useAgentStream';

// ── Types ──────────────────────────────────────────────────────────────────

export interface LiveReasoningStreamProps {
  agentName: AgentName;
  agentLabel: string;
  agentColor: string;
  streamingState: AgentStreamingState | null;
  streamingBuffer: string;
  isActive: boolean;
}

// ── Keyframes ──────────────────────────────────────────────────────────────

const blinkCursor = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`;

const pulseDot = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
`;

// ── Styled scrollbar CSS (applied via sx) ──────────────────────────────────

const scrollbarSx = {
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    bg: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    bg: 'gray.700',
    borderRadius: '3px',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    bg: 'gray.600',
  },
};

// ── Motion wrapper ─────────────────────────────────────────────────────────

const MotionBox = motion(Box);

// ── File header line ───────────────────────────────────────────────────────

const FileHeader = memo(({ file, index, total }: { file: string; index: number; total: number }) => (
  <Text color="cyan.400" fontWeight="bold" fontSize="xs" mt={1} mb={0.5}>
    --- Analyzing: {file} ({index}/{total}) ---
  </Text>
));
FileHeader.displayName = 'FileHeader';

// ── Main Component ─────────────────────────────────────────────────────────

const LiveReasoningStream: React.FC<LiveReasoningStreamProps> = ({
  agentLabel,
  agentColor,
  streamingState,
  streamingBuffer,
  isActive,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevBufferLenRef = useRef(0);

  // Auto-scroll to bottom when buffer grows
  useEffect(() => {
    if (streamingBuffer.length > prevBufferLenRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevBufferLenRef.current = streamingBuffer.length;
  }, [streamingBuffer]);

  // Token estimate: ~4 chars per token
  const tokenEstimate = useMemo(
    () => Math.round(streamingBuffer.length / 4),
    [streamingBuffer.length],
  );

  const hasContent = streamingBuffer.length > 0;
  const isCollapsed = !isActive && !hasContent;

  const borderColor = isActive ? `${agentColor}.400` : 'gray.700';

  return (
    <Box
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="md"
      overflow="hidden"
      transition="border-color 0.3s ease"
    >
      {/* ── Header Bar ──────────────────────────────────────────────── */}
      <Flex
        bg="gray.850"
        bgGradient={isActive ? undefined : undefined}
        backgroundColor="gray.800"
        px={3}
        py={1.5}
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth="1px"
        borderBottomColor="gray.700"
      >
        <HStack spacing={2}>
          <Box as={Terminal} boxSize={3.5} color={`${agentColor}.400`} />
          <Text fontSize="xs" fontWeight="bold" color="gray.200" fontFamily="mono">
            {agentLabel}
          </Text>

          {isActive && (
            <Badge
              colorScheme="green"
              variant="subtle"
              fontSize="9px"
              px={1.5}
              py={0}
              borderRadius="full"
              display="flex"
              alignItems="center"
              gap={1}
            >
              <Box
                as={Circle}
                boxSize={1.5}
                fill="green.400"
                color="green.400"
                animation={`${pulseDot} 1.5s ease-in-out infinite`}
              />
              LIVE
            </Badge>
          )}
        </HStack>

        {hasContent && (
          <Text fontSize="9px" color="gray.500" fontFamily="mono">
            ~{tokenEstimate.toLocaleString()} tokens
          </Text>
        )}
      </Flex>

      {/* ── Content Area ────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {isCollapsed ? (
          <MotionBox
            key="collapsed"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            bg="gray.900"
            px={3}
            py={2}
          >
            <Text fontSize="xs" color="gray.500" fontFamily="mono" textAlign="center">
              Waiting for agent to start reasoning...
            </Text>
          </MotionBox>
        ) : (
          <MotionBox
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            bg="gray.900"
          >
            <Box
              ref={scrollRef}
              maxH="250px"
              overflowY="auto"
              px={3}
              py={2}
              sx={scrollbarSx}
            >
              {/* File header if present */}
              {streamingState?.currentFile && (
                <FileHeader
                  file={streamingState.currentFile}
                  index={streamingState.fileIndex ?? 1}
                  total={streamingState.fileTotal ?? 1}
                />
              )}

              {/* Streaming text */}
              {hasContent ? (
                <Text
                  fontSize="xs"
                  fontFamily="mono"
                  color={isActive ? 'green.300' : 'gray.500'}
                  whiteSpace="pre-wrap"
                  wordBreak="break-word"
                  lineHeight="tall"
                  transition="color 0.3s ease"
                >
                  {streamingBuffer}
                  {isActive && (
                    <Box
                      as="span"
                      animation={`${blinkCursor} 1s step-end infinite`}
                      color="green.300"
                      fontWeight="bold"
                    >
                      |
                    </Box>
                  )}
                </Text>
              ) : (
                <Text fontSize="xs" color="gray.500" fontFamily="mono" textAlign="center" py={4}>
                  Waiting for agent to start reasoning...
                </Text>
              )}

              {/* Invisible scroll anchor */}
              <Box h={0} />
            </Box>
          </MotionBox>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default memo(LiveReasoningStream);
