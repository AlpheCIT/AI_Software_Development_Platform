import React from 'react';
import { Box, HStack, Text, Badge, Progress, useColorModeValue } from '@chakra-ui/react';
import { Activity } from 'lucide-react';
import { useQARunStore } from '../../stores/qa-run-store';

const PIPELINE_STEPS = [
  'repo-ingester', 'strategist', 'generator', 'critic', 'executor', 'mutation',
  'product-manager', 'research-assistant',
  'code-quality', 'self-healer', 'api-validator', 'coverage-auditor', 'ui-ux-analyst',
];

const STEP_LABELS: Record<string, string> = {
  'repo-ingester': 'Ingester', 'strategist': 'Strategist', 'generator': 'Generator',
  'critic': 'Critic', 'executor': 'Executor', 'mutation': 'Mutation',
  'product-manager': 'PM', 'research-assistant': 'Research',
  'code-quality': 'Quality', 'code-quality-architect': 'Quality',
  'self-healer': 'Healer', 'api-validator': 'API', 'coverage-auditor': 'Coverage', 'ui-ux-analyst': 'UX',
};

interface Props {
  onNavigate: () => void;
}

export const GlobalRunBanner: React.FC<Props> = ({ onNavigate }) => {
  const runStatus = useQARunStore(s => s.runStatus);
  const repoUrl = useQARunStore(s => s.repoUrl);
  const agentStatuses = useQARunStore(s => s.agentStatuses);
  const bg = useColorModeValue('blue.50', 'blue.900');
  const borderColor = useColorModeValue('blue.200', 'blue.700');

  if (runStatus !== 'running') return null;

  const activeAgent = Object.entries(agentStatuses).find(([, s]) => s.status === 'running');
  const completedCount = Object.values(agentStatuses).filter(s => s.status === 'completed').length;
  const totalAgents = PIPELINE_STEPS.length;
  const progress = Math.round((completedCount / totalAgents) * 100);
  const repoName = repoUrl?.split('/').pop() || 'Repository';

  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="md"
      px={4}
      py={2}
      mb={3}
      cursor="pointer"
      onClick={onNavigate}
      _hover={{ opacity: 0.9 }}
    >
      <HStack spacing={3} justify="space-between">
        <HStack spacing={2}>
          <Box w={2} h={2} borderRadius="full" bg="green.400" className="pulse-dot"
            sx={{ animation: 'pulse 1.5s infinite', '@keyframes pulse': {
              '0%': { opacity: 1 }, '50%': { opacity: 0.4 }, '100%': { opacity: 1 }
            }}}
          />
          <Activity size={14} />
          <Text fontSize="sm" fontWeight="bold">QA Run in progress</Text>
          <Badge colorScheme="purple" fontSize="2xs">{repoName}</Badge>
          {activeAgent && (
            <Badge colorScheme="blue" fontSize="2xs">{STEP_LABELS[activeAgent[0]] || activeAgent[0]}</Badge>
          )}
        </HStack>
        <HStack spacing={2}>
          <Text fontSize="xs" color="gray.500">{completedCount}/{totalAgents} agents</Text>
          <Badge colorScheme="green" fontSize="2xs">{progress}%</Badge>
        </HStack>
      </HStack>
      <Progress size="xs" value={progress} colorScheme="blue" mt={2} borderRadius="full" />
    </Box>
  );
};
