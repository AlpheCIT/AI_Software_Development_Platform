/**
 * RunReplayPlayer - Replay a completed run as a time-lapse animation
 * Controls: Play/Pause/Restart, Speed selector, Timeline scrubber
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  IconButton,
  Select,
  Progress,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import { Play, Pause, RotateCcw, X, Clock, Zap } from 'lucide-react';
import type { TimelineEntry } from '../../hooks/useAgentStream';
import { AGENT_LABELS } from '../../hooks/useAgentStream';
import type { AgentName } from '../../services/qaService';

interface RunReplayPlayerProps {
  timeline: TimelineEntry[];
  onReplayEvent: (entry: TimelineEntry) => void;
  onClose: () => void;
}

export default function RunReplayPlayer({ timeline, onReplayEvent, onClose }: RunReplayPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speed, setSpeed] = useState(5);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const totalEvents = timeline.length;
  const progress = totalEvents > 0 ? (currentIndex / totalEvents) * 100 : 0;
  const currentEntry = timeline[currentIndex];
  const currentAgent = currentEntry ? (AGENT_LABELS[currentEntry.agent as AgentName] || currentEntry.agent) : '';

  // Calculate time span
  const startTime = timeline.length > 0 ? new Date(timeline[0].timestamp).getTime() : 0;
  const endTime = timeline.length > 0 ? new Date(timeline[timeline.length - 1].timestamp).getTime() : 0;
  const totalDuration = endTime - startTime;
  const currentTime = currentEntry ? new Date(currentEntry.timestamp).getTime() - startTime : 0;

  // Playback loop
  const tick = useCallback((timestamp: number) => {
    if (!isPlaying) return;

    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }

    const elapsed = timestamp - lastTimeRef.current;
    // Advance by speed multiplier (1 event every ~200ms/speed)
    const interval = 200 / speed;

    if (elapsed >= interval) {
      lastTimeRef.current = timestamp;
      setCurrentIndex(prev => {
        const next = prev + 1;
        if (next >= totalEvents) {
          setIsPlaying(false);
          return prev;
        }
        // Emit the event for the flow diagram to animate
        onReplayEvent(timeline[next]);
        return next;
      });
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }, [isPlaying, speed, totalEvents, timeline, onReplayEvent]);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = 0;
      animFrameRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, tick]);

  function restart() {
    setCurrentIndex(0);
    setIsPlaying(false);
    lastTimeRef.current = 0;
  }

  function formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  if (timeline.length === 0) {
    return (
      <Box p={4} textAlign="center">
        <Text color="gray.500">No timeline data to replay</Text>
      </Box>
    );
  }

  return (
    <Box bg={bg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={3}>
      {/* Header */}
      <HStack justify="space-between" mb={2}>
        <HStack spacing={2}>
          <Zap size={16} />
          <Text fontSize="sm" fontWeight="bold">Run Replay</Text>
          <Badge colorScheme={isPlaying ? 'green' : 'gray'} fontSize="2xs">
            {isPlaying ? '▶ Playing' : currentIndex >= totalEvents - 1 ? '■ Finished' : '⏸ Paused'}
          </Badge>
          <Badge colorScheme="blue" fontSize="2xs">{speed}x speed</Badge>
        </HStack>
        <IconButton
          aria-label="Close replay"
          icon={<X size={14} />}
          size="xs"
          variant="ghost"
          onClick={onClose}
        />
      </HStack>

      {/* Timeline Progress */}
      <Box mb={2}>
        <Progress
          value={progress}
          size="sm"
          colorScheme="blue"
          borderRadius="full"
          cursor="pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const idx = Math.floor(pct * totalEvents);
            setCurrentIndex(Math.max(0, Math.min(idx, totalEvents - 1)));
          }}
        />
        <HStack justify="space-between" mt={1}>
          <Text fontSize="2xs" color="gray.500">{formatTime(currentTime)}</Text>
          <Text fontSize="2xs" color="gray.500">
            Event {currentIndex + 1}/{totalEvents}
          </Text>
          <Text fontSize="2xs" color="gray.500">{formatTime(totalDuration)}</Text>
        </HStack>
      </Box>

      {/* Controls */}
      <HStack justify="center" spacing={3}>
        <Tooltip label="Restart">
          <IconButton
            aria-label="Restart"
            icon={<RotateCcw size={16} />}
            size="sm"
            variant="outline"
            onClick={restart}
          />
        </Tooltip>

        <Tooltip label={isPlaying ? 'Pause' : 'Play'}>
          <IconButton
            aria-label={isPlaying ? 'Pause' : 'Play'}
            icon={isPlaying ? <Pause size={18} /> : <Play size={18} />}
            size="md"
            colorScheme="blue"
            borderRadius="full"
            onClick={() => setIsPlaying(!isPlaying)}
          />
        </Tooltip>

        <Select
          size="xs"
          w="80px"
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
        >
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={5}>5x</option>
          <option value={10}>10x</option>
          <option value={20}>20x</option>
        </Select>
      </HStack>

      {/* Current Event Display */}
      {currentEntry && (
        <HStack mt={2} p={2} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md" fontSize="xs">
          <Clock size={12} />
          <Text color="gray.500">{new Date(currentEntry.timestamp).toLocaleTimeString()}</Text>
          <Badge colorScheme="blue" fontSize="2xs">{currentEntry.event}</Badge>
          <Text fontWeight="bold">{currentAgent}</Text>
        </HStack>
      )}
    </Box>
  );
}
