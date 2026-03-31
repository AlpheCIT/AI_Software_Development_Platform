/**
 * AgentDeepDivePanel - 5-tab deep-dive into any agent's work
 * Tabs: Transcript, Input/Output, Metrics, Chat, Report (for agents with structured reports)
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Code,
  Collapse,
  Spinner,
  IconButton,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Progress,
  Divider,
  useColorModeValue,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import {
  X,
  FileText,
  ArrowLeftRight,
  BarChart3,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  DollarSign,
  Zap,
  Bot,
  User,
} from 'lucide-react';
import qaService, { AgentConversation } from '../../services/qaService';
import type { HandoffInfo } from '../../hooks/useAgentStream';
import AgentChat from './AgentChat';
import SelfHealerPanel from './SelfHealerPanel';
import APIValidatorPanel from './APIValidatorPanel';
import CoverageAuditorPanel from './CoverageAuditorPanel';
import UIUXAnalystPanel from './UIUXAnalystPanel';

// Agents that produce structured reports
const REPORT_AGENTS = ['self-healer', 'api-validator', 'coverage-auditor', 'ui-ux-analyst', 'code-quality-architect'];

const MotionBox = motion(Box);

interface AgentDeepDivePanelProps {
  runId: string;
  agent: string;
  agentLabel: string;
  agentColor: string;
  handoffData?: HandoffInfo;
  isAgentActive?: boolean;
  streamingText?: string;
  onClose: () => void;
}

export default function AgentDeepDivePanel({
  runId,
  agent,
  agentLabel,
  agentColor,
  handoffData,
  isAgentActive,
  streamingText,
  onClose,
}: AgentDeepDivePanelProps) {
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ 'resp-0': true });
  const [reportData, setReportData] = useState<any>(null);

  const hasReport = REPORT_AGENTS.includes(agent);

  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const metaBg = useColorModeValue('gray.50', 'gray.700');
  const sysBg = useColorModeValue('purple.50', 'purple.900');
  const userBg = useColorModeValue('blue.50', 'blue.900');
  const respBg = useColorModeValue('green.50', 'green.900');

  useEffect(() => {
    loadConversations();
    if (hasReport) loadReport();
  }, [runId, agent]);

  async function loadConversations() {
    setLoading(true);
    try {
      const result = await qaService.getConversations(runId, agent);
      setConversations(result.conversations);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function loadReport() {
    try {
      const data = await qaService.getProductIntelligence(runId);
      const reportMap: Record<string, any> = {
        'self-healer': data.selfHealing,
        'api-validator': data.apiValidation,
        'coverage-auditor': data.coverageAudit,
        'ui-ux-analyst': data.uiAudit,
        'code-quality-architect': data.codeQuality,
      };
      setReportData(reportMap[agent] || null);
    } catch { /* ignore */ }
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Compute metrics from conversations
  const totalDuration = conversations.reduce((sum, c) => sum + (c.durationMs || 0), 0);
  const totalInputTokens = conversations.reduce((sum, c) => sum + (c.tokensUsed?.input || 0), 0);
  const totalOutputTokens = conversations.reduce((sum, c) => sum + (c.tokensUsed?.output || 0), 0);
  const totalTokens = totalInputTokens + totalOutputTokens;
  const estimatedCost = (totalInputTokens * 0.003 + totalOutputTokens * 0.015) / 1000; // Claude pricing estimate

  return (
    <MotionBox
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 50, opacity: 0 }}
      transition={{ duration: 0.3 }}
      bg={bg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      overflow="hidden"
      h="full"
      maxH="600px"
    >
      {/* Header */}
      <HStack
        px={3} py={2}
        bg={`${agentColor}.500`}
        color="white"
        justify="space-between"
      >
        <HStack spacing={2}>
          <Bot size={16} />
          <Text fontWeight="bold" fontSize="sm">{agentLabel}</Text>
          <Badge colorScheme="whiteAlpha" fontSize="2xs">Deep Dive</Badge>
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

      {loading ? (
        <VStack py={8}><Spinner color={`${agentColor}.500`} /><Text fontSize="sm" color={subtextColor}>Loading...</Text></VStack>
      ) : (
        <Tabs size="sm" colorScheme={agentColor} variant="enclosed-colored" isLazy>
          <TabList px={2} pt={1}>
            <Tab fontSize="xs"><FileText size={12} />&nbsp;Transcript</Tab>
            <Tab fontSize="xs"><ArrowLeftRight size={12} />&nbsp;I/O</Tab>
            <Tab fontSize="xs"><BarChart3 size={12} />&nbsp;Metrics</Tab>
            <Tab fontSize="xs"><MessageSquare size={12} />&nbsp;Chat</Tab>
            {hasReport && <Tab fontSize="xs"><BarChart3 size={12} />&nbsp;Report</Tab>}
          </TabList>

          <TabPanels>
            {/* Tab 1: Transcript */}
            <TabPanel p={2} maxH="480px" overflowY="auto">
              {conversations.length === 0 ? (
                isAgentActive ? (
                  <Box bg="gray.900" borderRadius="md" p={3} fontFamily="mono" fontSize="xs" color="green.300" maxH="400px" overflowY="auto">
                    <HStack mb={2}>
                      <Box w="6px" h="6px" borderRadius="full" bg="green.400" />
                      <Text color="green.400" fontWeight="bold">{agentLabel} is thinking...</Text>
                    </HStack>
                    {streamingText ? (
                      <Text whiteSpace="pre-wrap" color="gray.300">{streamingText}<Box as="span" display="inline-block" w="2px" h="14px" bg="green.400" ml={1} animation="blink 1s step-end infinite" /></Text>
                    ) : (
                      <Text color="gray.500">Waiting for Claude response...</Text>
                    )}
                  </Box>
                ) : (
                  <Text fontSize="sm" color={subtextColor} textAlign="center" py={4}>
                    No conversation data yet. The transcript populates after the agent completes its LLM call.
                  </Text>
                )
              ) : (
                <VStack spacing={3} align="stretch">
                  {conversations.map((conv, idx) => (
                    <Box key={idx} border="1px solid" borderColor={borderColor} borderRadius="md" overflow="hidden">
                      {/* Meta */}
                      <HStack px={2} py={1} bg={metaBg} fontSize="2xs" color={subtextColor} spacing={3}>
                        <HStack><Clock size={10} /><Text>{new Date(conv.timestamp).toLocaleTimeString()}</Text></HStack>
                        <HStack><Cpu size={10} /><Text>{(conv.durationMs / 1000).toFixed(1)}s</Text></HStack>
                        {conv.tokensUsed?.input && <Text>{((conv.tokensUsed.input || 0) + (conv.tokensUsed.output || 0)).toLocaleString()} tokens</Text>}
                      </HStack>

                      {/* System Prompt */}
                      <Box px={2} py={1} bg={sysBg} cursor="pointer" onClick={() => toggleSection(`sys-${idx}`)}>
                        <HStack justify="space-between">
                          <HStack><Bot size={12} /><Text fontSize="xs" fontWeight="semibold" color="purple.500">System Prompt</Text></HStack>
                          {expandedSections[`sys-${idx}`] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </HStack>
                      </Box>
                      <Collapse in={expandedSections[`sys-${idx}`]}>
                        <Box px={2} py={1} maxH="200px" overflowY="auto">
                          <Code display="block" whiteSpace="pre-wrap" fontSize="2xs" p={1}>{conv.systemPrompt}</Code>
                        </Box>
                      </Collapse>

                      {/* User Message */}
                      <Box px={2} py={1} bg={userBg} cursor="pointer" onClick={() => toggleSection(`user-${idx}`)}>
                        <HStack justify="space-between">
                          <HStack><User size={12} /><Text fontSize="xs" fontWeight="semibold" color="blue.500">Context Sent</Text></HStack>
                          {expandedSections[`user-${idx}`] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </HStack>
                      </Box>
                      <Collapse in={expandedSections[`user-${idx}`]}>
                        <Box px={2} py={1} maxH="200px" overflowY="auto">
                          <Code display="block" whiteSpace="pre-wrap" fontSize="2xs" p={1}>{conv.userMessage}</Code>
                        </Box>
                      </Collapse>

                      {/* Response */}
                      <Box px={2} py={1} bg={respBg} cursor="pointer" onClick={() => toggleSection(`resp-${idx}`)}>
                        <HStack justify="space-between">
                          <HStack><Bot size={12} /><Text fontSize="xs" fontWeight="semibold" color="green.500">Claude Response</Text></HStack>
                          {expandedSections[`resp-${idx}`] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </HStack>
                      </Box>
                      <Collapse in={expandedSections[`resp-${idx}`] !== false}>
                        <Box px={2} py={1} maxH="300px" overflowY="auto">
                          <Code display="block" whiteSpace="pre-wrap" fontSize="2xs" p={1}>{conv.response}</Code>
                        </Box>
                      </Collapse>
                    </Box>
                  ))}
                </VStack>
              )}
            </TabPanel>

            {/* Tab 2: Input / Output */}
            <TabPanel p={3} maxH="480px" overflowY="auto">
              <VStack spacing={4} align="stretch">
                {/* Input */}
                <Box>
                  <HStack mb={2}>
                    <Badge colorScheme="blue" fontSize="xs">INPUT</Badge>
                    <Text fontSize="sm" fontWeight="bold">What {agentLabel} Received</Text>
                  </HStack>
                  <Box p={3} bg={userBg} borderRadius="md" fontSize="sm">
                    {conversations[0] ? (
                      <VStack align="start" spacing={1}>
                        <Text>Context size: <strong>{conversations[0].userMessage.length.toLocaleString()}</strong> characters</Text>
                        <Text>System prompt: <strong>{conversations[0].systemPrompt.length.toLocaleString()}</strong> characters</Text>
                        {conversations.length > 1 && <Text>Iterations: <strong>{conversations.length}</strong></Text>}
                      </VStack>
                    ) : (
                      <Text color={subtextColor}>No input data available</Text>
                    )}
                  </Box>
                </Box>

                <Divider />

                {/* Output */}
                <Box>
                  <HStack mb={2}>
                    <Badge colorScheme="green" fontSize="xs">OUTPUT</Badge>
                    <Text fontSize="sm" fontWeight="bold">What {agentLabel} Produced</Text>
                  </HStack>
                  <Box p={3} bg={respBg} borderRadius="md" fontSize="sm">
                    {handoffData ? (
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold">{handoffData.summary}</Text>
                        {conversations[conversations.length - 1] && (
                          <Text>Response size: <strong>{conversations[conversations.length - 1].response.length.toLocaleString()}</strong> characters</Text>
                        )}
                      </VStack>
                    ) : conversations[conversations.length - 1] ? (
                      <Text>Response: <strong>{conversations[conversations.length - 1].response.length.toLocaleString()}</strong> characters</Text>
                    ) : (
                      <Text color={subtextColor}>No output data available</Text>
                    )}
                  </Box>
                </Box>
              </VStack>
            </TabPanel>

            {/* Tab 3: Metrics */}
            <TabPanel p={3} maxH="480px" overflowY="auto">
              <SimpleGrid columns={{ base: 2, md: 2 }} spacing={3}>
                <Stat>
                  <StatLabel fontSize="xs"><HStack><Clock size={12} /><Text>Duration</Text></HStack></StatLabel>
                  <StatNumber fontSize="lg">{(totalDuration / 1000).toFixed(1)}s</StatNumber>
                  <StatHelpText fontSize="2xs">Total LLM time</StatHelpText>
                </Stat>

                <Stat>
                  <StatLabel fontSize="xs"><HStack><Cpu size={12} /><Text>Tokens</Text></HStack></StatLabel>
                  <StatNumber fontSize="lg">{totalTokens.toLocaleString()}</StatNumber>
                  <StatHelpText fontSize="2xs">In: {totalInputTokens.toLocaleString()} / Out: {totalOutputTokens.toLocaleString()}</StatHelpText>
                </Stat>

                <Stat>
                  <StatLabel fontSize="xs"><HStack><DollarSign size={12} /><Text>Est. Cost</Text></HStack></StatLabel>
                  <StatNumber fontSize="lg">${estimatedCost.toFixed(4)}</StatNumber>
                  <StatHelpText fontSize="2xs">Based on Claude pricing</StatHelpText>
                </Stat>

                <Stat>
                  <StatLabel fontSize="xs"><HStack><Zap size={12} /><Text>Iterations</Text></HStack></StatLabel>
                  <StatNumber fontSize="lg">{conversations.length}</StatNumber>
                  <StatHelpText fontSize="2xs">{conversations.length > 1 ? 'Multiple passes' : 'Single pass'}</StatHelpText>
                </Stat>
              </SimpleGrid>

              {/* Token distribution bar */}
              {totalTokens > 0 && (
                <Box mt={4}>
                  <Text fontSize="xs" fontWeight="bold" mb={1}>Token Distribution</Text>
                  <HStack spacing={0} h="20px" borderRadius="md" overflow="hidden">
                    <Box bg="blue.400" w={`${(totalInputTokens / totalTokens) * 100}%`} h="full" />
                    <Box bg="green.400" w={`${(totalOutputTokens / totalTokens) * 100}%`} h="full" />
                  </HStack>
                  <HStack justify="space-between" mt={1}>
                    <HStack><Box w="8px" h="8px" bg="blue.400" borderRadius="sm" /><Text fontSize="2xs">Input ({Math.round((totalInputTokens / totalTokens) * 100)}%)</Text></HStack>
                    <HStack><Box w="8px" h="8px" bg="green.400" borderRadius="sm" /><Text fontSize="2xs">Output ({Math.round((totalOutputTokens / totalTokens) * 100)}%)</Text></HStack>
                  </HStack>
                </Box>
              )}

              {/* Speed per iteration */}
              {conversations.length > 0 && (
                <Box mt={4}>
                  <Text fontSize="xs" fontWeight="bold" mb={2}>Speed per Iteration</Text>
                  <VStack spacing={1} align="stretch">
                    {conversations.map((conv, i) => (
                      <HStack key={i} fontSize="2xs" spacing={2}>
                        <Text w="60px" color={subtextColor}>Pass {i + 1}</Text>
                        <Progress
                          value={(conv.durationMs / Math.max(totalDuration, 1)) * 100}
                          size="xs"
                          colorScheme={agentColor}
                          flex={1}
                          borderRadius="full"
                        />
                        <Text w="50px" textAlign="right">{(conv.durationMs / 1000).toFixed(1)}s</Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              )}
            </TabPanel>

            {/* Tab 4: Chat */}
            <TabPanel p={0}>
              <AgentChat
                runId={runId}
                agent={agent}
                agentLabel={agentLabel}
                agentColor={agentColor}
                onClose={onClose}
              />
            </TabPanel>

            {/* Tab 5: Report (only for agents with structured reports) */}
            {hasReport && (
              <TabPanel p={2} maxH="480px" overflowY="auto">
                {reportData ? (
                  <>
                    {agent === 'self-healer' && <SelfHealerPanel report={reportData} />}
                    {agent === 'api-validator' && <APIValidatorPanel report={reportData} />}
                    {agent === 'coverage-auditor' && <CoverageAuditorPanel report={reportData} />}
                    {agent === 'ui-ux-analyst' && <UIUXAnalystPanel report={reportData} />}
                    {agent === 'code-quality-architect' && (
                      <Box>
                        <HStack mb={2}>
                          <Badge colorScheme={reportData.overallHealth?.score >= 80 ? 'green' : reportData.overallHealth?.score >= 60 ? 'yellow' : 'red'}>
                            Grade {reportData.overallHealth?.grade} ({reportData.overallHealth?.score}/100)
                          </Badge>
                        </HStack>
                        <Text fontSize="sm">{reportData.overallHealth?.summary}</Text>
                      </Box>
                    )}
                  </>
                ) : (
                  <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
                    No report data available. Run the pipeline to generate this agent's report.
                  </Text>
                )}
              </TabPanel>
            )}
          </TabPanels>
        </Tabs>
      )}
    </MotionBox>
  );
}
