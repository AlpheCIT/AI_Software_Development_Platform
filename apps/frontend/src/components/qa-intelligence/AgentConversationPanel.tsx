import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Spinner,
  IconButton,
  Collapse,
  Code,
  Divider,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Bot,
  User,
  Clock,
  Cpu,
  X,
} from 'lucide-react';
import qaService, { AgentConversation } from '../../services/qaService';
import AgentChat from './AgentChat';

interface AgentConversationPanelProps {
  runId: string;
  agent: string;
  agentLabel: string;
  agentColor: string;
  onClose: () => void;
}

export default function AgentConversationPanel({
  runId,
  agent,
  agentLabel,
  agentColor,
  onClose,
}: AgentConversationPanelProps) {
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [showChat, setShowChat] = useState(false);

  const bg = useColorModeValue('gray.50', 'gray.800');
  const cardBg = useColorModeValue('white', 'gray.750');
  const systemBg = useColorModeValue('purple.50', 'purple.900');
  const userBg = useColorModeValue('blue.50', 'blue.900');
  const responseBg = useColorModeValue('green.50', 'green.900');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    loadConversations();
  }, [runId, agent]);

  async function loadConversations() {
    setLoading(true);
    try {
      const result = await qaService.getConversations(runId, agent);
      setConversations(result.conversations);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) {
    return (
      <Box p={6} bg={bg} borderRadius="lg" border="1px solid" borderColor={borderColor}>
        <HStack justify="center" py={8}>
          <Spinner size="md" color={`${agentColor}.500`} />
          <Text color="gray.500">Loading {agentLabel} conversation...</Text>
        </HStack>
      </Box>
    );
  }

  if (conversations.length === 0) {
    return (
      <Box p={6} bg={bg} borderRadius="lg" border="1px solid" borderColor={borderColor}>
        <HStack justify="space-between" mb={4}>
          <HStack>
            <MessageSquare size={18} />
            <Text fontWeight="bold">{agentLabel} — Conversation</Text>
          </HStack>
          <IconButton
            aria-label="Close"
            icon={<X size={16} />}
            size="sm"
            variant="ghost"
            onClick={onClose}
          />
        </HStack>
        <Text color="gray.500" textAlign="center" py={4}>
          No conversation data yet. Run the pipeline to see what this agent thinks.
        </Text>
      </Box>
    );
  }

  return (
    <Box p={4} bg={bg} borderRadius="lg" border="1px solid" borderColor={borderColor} maxH="600px" overflowY="auto">
      <HStack justify="space-between" mb={4} position="sticky" top={0} bg={bg} zIndex={1} pb={2}>
        <HStack>
          <MessageSquare size={18} />
          <HStack spacing={0}>
            <Box
              px={3} py={1} cursor="pointer" borderRadius="md"
              bg={!showChat ? `${agentColor}.100` : 'transparent'}
              fontWeight={!showChat ? 'bold' : 'normal'}
              fontSize="sm"
              onClick={() => setShowChat(false)}
            >
              LLM Transcript
            </Box>
            <Box
              px={3} py={1} cursor="pointer" borderRadius="md"
              bg={showChat ? `${agentColor}.100` : 'transparent'}
              fontWeight={showChat ? 'bold' : 'normal'}
              fontSize="sm"
              onClick={() => setShowChat(true)}
            >
              Ask Follow-up
            </Box>
          </HStack>
          {!showChat && (
            <Badge colorScheme={agentColor}>{conversations.length} exchange{conversations.length > 1 ? 's' : ''}</Badge>
          )}
        </HStack>
        <IconButton
          aria-label="Close"
          icon={<X size={16} />}
          size="sm"
          variant="ghost"
          onClick={onClose}
        />
      </HStack>

      {showChat && (
        <AgentChat
          runId={runId}
          agent={agent}
          agentLabel={agentLabel}
          agentColor={agentColor}
          onClose={() => setShowChat(false)}
        />
      )}

      {!showChat && <VStack spacing={4} align="stretch">
        {conversations.map((conv, idx) => {
          const sysKey = `sys-${idx}`;
          const userKey = `user-${idx}`;
          const respKey = `resp-${idx}`;

          return (
            <Box key={idx} bg={cardBg} borderRadius="md" border="1px solid" borderColor={borderColor} overflow="hidden">
              {/* Meta info */}
              <HStack px={3} py={2} bg={useColorModeValue('gray.100', 'gray.700')} fontSize="xs" color="gray.500" spacing={4}>
                <HStack>
                  <Clock size={12} />
                  <Text>{new Date(conv.timestamp).toLocaleTimeString()}</Text>
                </HStack>
                <HStack>
                  <Cpu size={12} />
                  <Text>{(conv.durationMs / 1000).toFixed(1)}s</Text>
                </HStack>
                {conv.tokensUsed?.input && (
                  <Tooltip label={`Input: ${conv.tokensUsed.input}, Output: ${conv.tokensUsed.output}`}>
                    <Text>{((conv.tokensUsed.input || 0) + (conv.tokensUsed.output || 0)).toLocaleString()} tokens</Text>
                  </Tooltip>
                )}
                {conversations.length > 1 && (
                  <Badge size="sm" colorScheme="gray">Iteration {idx + 1}</Badge>
                )}
              </HStack>

              {/* System Prompt (collapsible) */}
              <Box
                px={3} py={2} bg={systemBg} cursor="pointer"
                onClick={() => toggleSection(sysKey)}
                _hover={{ opacity: 0.9 }}
              >
                <HStack justify="space-between">
                  <HStack>
                    <Bot size={14} />
                    <Text fontSize="sm" fontWeight="semibold" color="purple.600">System Prompt</Text>
                    <Text fontSize="xs" color="gray.500">({conv.systemPrompt.length.toLocaleString()} chars)</Text>
                  </HStack>
                  {expandedSections[sysKey] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </HStack>
              </Box>
              <Collapse in={expandedSections[sysKey]}>
                <Box px={3} py={2} maxH="300px" overflowY="auto">
                  <Code display="block" whiteSpace="pre-wrap" fontSize="xs" p={2} borderRadius="sm">
                    {conv.systemPrompt}
                  </Code>
                </Box>
              </Collapse>

              <Divider />

              {/* User Message (collapsible) */}
              <Box
                px={3} py={2} bg={userBg} cursor="pointer"
                onClick={() => toggleSection(userKey)}
                _hover={{ opacity: 0.9 }}
              >
                <HStack justify="space-between">
                  <HStack>
                    <User size={14} />
                    <Text fontSize="sm" fontWeight="semibold" color="blue.600">User Message (Context)</Text>
                    <Text fontSize="xs" color="gray.500">({conv.userMessage.length.toLocaleString()} chars)</Text>
                  </HStack>
                  {expandedSections[userKey] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </HStack>
              </Box>
              <Collapse in={expandedSections[userKey]}>
                <Box px={3} py={2} maxH="300px" overflowY="auto">
                  <Code display="block" whiteSpace="pre-wrap" fontSize="xs" p={2} borderRadius="sm">
                    {conv.userMessage}
                  </Code>
                </Box>
              </Collapse>

              <Divider />

              {/* Response (expanded by default) */}
              <Box
                px={3} py={2} bg={responseBg} cursor="pointer"
                onClick={() => toggleSection(respKey)}
                _hover={{ opacity: 0.9 }}
              >
                <HStack justify="space-between">
                  <HStack>
                    <Bot size={14} />
                    <Text fontSize="sm" fontWeight="semibold" color="green.600">Claude's Response</Text>
                    <Text fontSize="xs" color="gray.500">({conv.response.length.toLocaleString()} chars)</Text>
                  </HStack>
                  {expandedSections[respKey] !== false ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </HStack>
              </Box>
              <Collapse in={expandedSections[respKey] !== false}>
                <Box px={3} py={2} maxH="400px" overflowY="auto">
                  <Code display="block" whiteSpace="pre-wrap" fontSize="xs" p={2} borderRadius="sm">
                    {conv.response}
                  </Code>
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </VStack>}
    </Box>
  );
}
