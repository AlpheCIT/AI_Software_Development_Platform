import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  IconButton,
  Badge,
  Spinner,
  useColorModeValue,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, MessageSquare, Bot, User } from 'lucide-react';
import qaService from '../../services/qaService';

const MotionBox = motion(Box);

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AgentChatProps {
  runId: string;
  agent: string;
  agentLabel: string;
  agentColor: string;
  onClose: () => void;
}

export default function AgentChat({
  runId,
  agent,
  agentLabel,
  agentColor,
  onClose,
}: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const bg = useColorModeValue('gray.50', 'gray.800');
  const cardBg = useColorModeValue('white', 'gray.750');
  const userBubbleBg = useColorModeValue('blue.500', 'blue.400');
  const assistantBubbleBg = useColorModeValue('gray.100', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    }]);
    setLoading(true);

    try {
      const result = await qaService.chat(runId, agent, userMessage, conversationId || undefined);
      setConversationId(result.conversationId);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString(),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  const suggestedQuestions: Record<string, string[]> = {
    strategist: [
      'Why did you flag those files as high risk?',
      'Which module should we test first?',
      'What test types would give us the best coverage?',
    ],
    generator: [
      'Can you generate more edge case tests?',
      'Why did you choose these test patterns?',
      'How would you test the error handling?',
    ],
    critic: [
      'Which tests need the most improvement?',
      'What edge cases are we missing?',
      'How confident are you in the test suite?',
    ],
    'mutation-verifier': [
      'Which surviving mutants are most concerning?',
      'How can we catch the boundary condition mutations?',
      'What mutation score should we target?',
    ],
    'product-manager': [
      'What\'s the highest ROI feature to build next?',
      'Who are our target users?',
      'What competitive advantages can we create?',
    ],
    'research-assistant': [
      'What emerging tech should we adopt?',
      'How do competitors handle this?',
      'What market trends affect our roadmap?',
    ],
    'code-quality-architect': [
      'What\'s the biggest tech debt item?',
      'Which refactoring gives the best ROI?',
      'How can we reduce code duplication?',
    ],
    'self-healer': [
      'Which type mismatches are most dangerous?',
      'Are there any circular dependencies?',
      'Which auto-fixes are safe to apply immediately?',
    ],
    'api-validator': [
      'Which endpoints have the worst security?',
      'Are there any unprotected routes?',
      'What error handling is missing?',
    ],
    'coverage-auditor': [
      'Which backend features are hidden from users?',
      'Are there broken frontend API calls?',
      'What CRUD operations are incomplete?',
    ],
  };

  const suggestions = suggestedQuestions[agent] || [];

  return (
    <Box bg={bg} borderRadius="lg" border="1px solid" borderColor={borderColor} overflow="hidden">
      {/* Header */}
      <HStack
        px={3} py={2}
        bg={`${agentColor}.500`}
        color="white"
        justify="space-between"
      >
        <HStack>
          <MessageSquare size={16} />
          <Text fontSize="sm" fontWeight="bold">Chat with {agentLabel}</Text>
          {conversationId && (
            <Badge colorScheme="whiteAlpha" fontSize="2xs">{messages.length} messages</Badge>
          )}
        </HStack>
        <IconButton
          aria-label="Close chat"
          icon={<X size={14} />}
          size="xs"
          variant="ghost"
          color="white"
          _hover={{ bg: 'whiteAlpha.200' }}
          onClick={onClose}
        />
      </HStack>

      {/* Messages */}
      <Box maxH="350px" overflowY="auto" p={3}>
        <VStack spacing={3} align="stretch">
          {messages.length === 0 && (
            <VStack spacing={2} py={4}>
              <Bot size={24} color="gray" />
              <Text fontSize="sm" color="gray.500" textAlign="center">
                Ask {agentLabel} about their analysis
              </Text>
              {/* Suggested questions */}
              <VStack spacing={1} w="full">
                {suggestions.map((q, i) => (
                  <Box
                    key={i}
                    w="full"
                    px={3}
                    py={1.5}
                    bg={cardBg}
                    border="1px solid"
                    borderColor={borderColor}
                    borderRadius="md"
                    cursor="pointer"
                    fontSize="xs"
                    color="gray.600"
                    _hover={{ bg: `${agentColor}.50`, borderColor: `${agentColor}.200` }}
                    onClick={() => {
                      setInput(q);
                    }}
                  >
                    {q}
                  </Box>
                ))}
              </VStack>
            </VStack>
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <MotionBox
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                alignSelf={msg.role === 'user' ? 'flex-end' : 'flex-start'}
                maxW="85%"
              >
                <HStack spacing={2} align="flex-start">
                  {msg.role === 'assistant' && (
                    <Box flexShrink={0} mt={1}>
                      <Bot size={14} />
                    </Box>
                  )}
                  <Box
                    px={3}
                    py={2}
                    borderRadius="lg"
                    bg={msg.role === 'user' ? userBubbleBg : assistantBubbleBg}
                    color={msg.role === 'user' ? 'white' : 'inherit'}
                    fontSize="sm"
                    whiteSpace="pre-wrap"
                    wordBreak="break-word"
                  >
                    {msg.content}
                  </Box>
                  {msg.role === 'user' && (
                    <Box flexShrink={0} mt={1}>
                      <User size={14} />
                    </Box>
                  )}
                </HStack>
              </MotionBox>
            ))}
          </AnimatePresence>

          {loading && (
            <HStack spacing={2} px={2}>
              <Bot size={14} />
              <HStack spacing={1}>
                {[0, 1, 2].map(i => (
                  <MotionBox
                    key={i}
                    w="6px"
                    h="6px"
                    borderRadius="full"
                    bg="gray.400"
                    animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                  />
                ))}
              </HStack>
            </HStack>
          )}

          <div ref={messagesEndRef} />
        </VStack>
      </Box>

      {/* Input */}
      <HStack px={3} py={2} borderTop="1px solid" borderColor={borderColor}>
        <Input
          size="sm"
          placeholder={`Ask ${agentLabel}...`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
          isDisabled={loading}
          borderRadius="full"
        />
        <IconButton
          aria-label="Send message"
          icon={loading ? <Spinner size="xs" /> : <Send size={14} />}
          size="sm"
          colorScheme={agentColor}
          borderRadius="full"
          onClick={sendMessage}
          isDisabled={!input.trim() || loading}
        />
      </HStack>
    </Box>
  );
}
