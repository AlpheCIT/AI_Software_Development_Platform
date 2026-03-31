/**
 * AgentDebateView - Split-screen showing agent disagreements and feedback loops
 * Shows Generator vs Critic side-by-side with iteration markers
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Grid,
  Code,
  Spinner,
  Divider,
  IconButton,
  useColorModeValue,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { X, RotateCcw, ArrowRight, Code as CodeIcon, MessageSquare } from 'lucide-react';
import qaService, { AgentConversation } from '../../services/qaService';

const MotionBox = motion(Box);

interface AgentDebateViewProps {
  runId: string;
  onClose: () => void;
}

export default function AgentDebateView({ runId, onClose }: AgentDebateViewProps) {
  const [generatorConvos, setGeneratorConvos] = useState<AgentConversation[]>([]);
  const [criticConvos, setCriticConvos] = useState<AgentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIteration, setSelectedIteration] = useState(0);

  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const genBg = useColorModeValue('green.50', 'green.900');
  const criticBg = useColorModeValue('orange.50', 'orange.900');
  const dividerBg = useColorModeValue('gray.50', 'gray.750');

  useEffect(() => {
    loadDebateData();
  }, [runId]);

  async function loadDebateData() {
    setLoading(true);
    try {
      const [genResult, criticResult] = await Promise.all([
        qaService.getConversations(runId, 'generator'),
        qaService.getConversations(runId, 'critic'),
      ]);
      setGeneratorConvos(genResult.conversations);
      setCriticConvos(criticResult.conversations);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  const maxIterations = Math.max(generatorConvos.length, criticConvos.length);
  const currentGen = generatorConvos[selectedIteration];
  const currentCritic = criticConvos[selectedIteration];

  if (loading) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="lg" />
        <Text mt={2} color="gray.500">Loading debate data...</Text>
      </Box>
    );
  }

  if (maxIterations === 0) {
    return (
      <Box p={6} textAlign="center">
        <Text color="gray.500">No debate data available. Generator and Critic haven't interacted yet.</Text>
      </Box>
    );
  }

  return (
    <Box bg={bg} border="1px solid" borderColor={borderColor} borderRadius="lg" overflow="hidden">
      {/* Header */}
      <HStack px={4} py={2} bg="gray.700" color="white" justify="space-between">
        <HStack spacing={3}>
          <RotateCcw size={16} />
          <Text fontWeight="bold" fontSize="sm">Agent Debate View</Text>
          <Badge colorScheme="orange">{maxIterations} iteration{maxIterations > 1 ? 's' : ''}</Badge>
        </HStack>
        <IconButton
          aria-label="Close"
          icon={<X size={14} />}
          size="xs"
          variant="ghost"
          color="white"
          _hover={{ bg: 'whiteAlpha.200' }}
          onClick={onClose}
        />
      </HStack>

      {/* Iteration Selector */}
      {maxIterations > 1 && (
        <HStack px={4} py={2} borderBottom="1px solid" borderColor={borderColor} spacing={2}>
          <Text fontSize="xs" color="gray.500" fontWeight="bold">Iteration:</Text>
          {Array.from({ length: maxIterations }, (_, i) => (
            <Badge
              key={i}
              cursor="pointer"
              colorScheme={i === selectedIteration ? 'blue' : 'gray'}
              variant={i === selectedIteration ? 'solid' : 'outline'}
              onClick={() => setSelectedIteration(i)}
              fontSize="xs"
            >
              {i + 1}
            </Badge>
          ))}
        </HStack>
      )}

      {/* Split View */}
      <Grid templateColumns="1fr auto 1fr" maxH="450px" overflow="hidden">
        {/* Generator Side */}
        <Box bg={genBg} p={3} overflowY="auto" maxH="450px">
          <HStack mb={2}>
            <CodeIcon size={14} color="var(--chakra-colors-green-500)" />
            <Text fontSize="sm" fontWeight="bold" color="green.600">Generator</Text>
            <Badge colorScheme="green" fontSize="2xs">Iteration {selectedIteration + 1}</Badge>
          </HStack>

          {currentGen ? (
            <VStack spacing={2} align="stretch">
              <Box>
                <Text fontSize="2xs" fontWeight="bold" color="gray.500" mb={1}>PROMPT CONTEXT</Text>
                <Code display="block" whiteSpace="pre-wrap" fontSize="2xs" p={2} maxH="150px" overflowY="auto" borderRadius="md">
                  {currentGen.userMessage.substring(0, 2000)}
                  {currentGen.userMessage.length > 2000 && '...'}
                </Code>
              </Box>
              <Divider />
              <Box>
                <Text fontSize="2xs" fontWeight="bold" color="green.500" mb={1}>GENERATED OUTPUT</Text>
                <Code display="block" whiteSpace="pre-wrap" fontSize="2xs" p={2} maxH="200px" overflowY="auto" borderRadius="md">
                  {currentGen.response.substring(0, 3000)}
                  {currentGen.response.length > 3000 && '...'}
                </Code>
              </Box>
              <Text fontSize="2xs" color="gray.500">
                {(currentGen.durationMs / 1000).toFixed(1)}s · {((currentGen.tokensUsed?.input || 0) + (currentGen.tokensUsed?.output || 0)).toLocaleString()} tokens
              </Text>
            </VStack>
          ) : (
            <Text fontSize="sm" color="gray.500">No generator data for this iteration</Text>
          )}
        </Box>

        {/* Center Divider with Arrow */}
        <VStack
          px={2}
          py={4}
          borderLeft="1px solid"
          borderRight="1px solid"
          borderColor={borderColor}
          justify="center"
          spacing={3}
          bg={dividerBg}
        >
          <MotionBox
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ArrowRight size={16} color="var(--chakra-colors-orange-400)" />
          </MotionBox>
          <Badge colorScheme="orange" fontSize="2xs" transform="rotate(90deg)">
            REVIEW
          </Badge>
          {selectedIteration < maxIterations - 1 && (
            <>
              <MotionBox
                animate={{ rotate: [0, -360] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              >
                <RotateCcw size={14} color="var(--chakra-colors-orange-400)" />
              </MotionBox>
              <Badge colorScheme="orange" fontSize="2xs" transform="rotate(90deg)">
                LOOP
              </Badge>
            </>
          )}
        </VStack>

        {/* Critic Side */}
        <Box bg={criticBg} p={3} overflowY="auto" maxH="450px">
          <HStack mb={2}>
            <MessageSquare size={14} color="var(--chakra-colors-orange-500)" />
            <Text fontSize="sm" fontWeight="bold" color="orange.600">Critic</Text>
            <Badge colorScheme="orange" fontSize="2xs">Review {selectedIteration + 1}</Badge>
          </HStack>

          {currentCritic ? (
            <VStack spacing={2} align="stretch">
              <Box>
                <Text fontSize="2xs" fontWeight="bold" color="gray.500" mb={1}>TESTS REVIEWED</Text>
                <Code display="block" whiteSpace="pre-wrap" fontSize="2xs" p={2} maxH="150px" overflowY="auto" borderRadius="md">
                  {currentCritic.userMessage.substring(0, 2000)}
                  {currentCritic.userMessage.length > 2000 && '...'}
                </Code>
              </Box>
              <Divider />
              <Box>
                <Text fontSize="2xs" fontWeight="bold" color="orange.500" mb={1}>CRITIQUE & FEEDBACK</Text>
                <Code display="block" whiteSpace="pre-wrap" fontSize="2xs" p={2} maxH="200px" overflowY="auto" borderRadius="md">
                  {currentCritic.response.substring(0, 3000)}
                  {currentCritic.response.length > 3000 && '...'}
                </Code>
              </Box>
              <Text fontSize="2xs" color="gray.500">
                {(currentCritic.durationMs / 1000).toFixed(1)}s · {((currentCritic.tokensUsed?.input || 0) + (currentCritic.tokensUsed?.output || 0)).toLocaleString()} tokens
              </Text>
            </VStack>
          ) : (
            <Text fontSize="sm" color="gray.500">No critic data for this iteration</Text>
          )}
        </Box>
      </Grid>
    </Box>
  );
}
