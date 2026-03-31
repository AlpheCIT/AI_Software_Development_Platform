import React, { useState, useEffect } from 'react';
import {
  Box, VStack, HStack, Text, Badge, Button, Checkbox,
  Spinner, Icon, Divider, useColorModeValue, Collapse,
  Tooltip, Flex, Code,
} from '@chakra-ui/react';
import {
  GitBranch, FilePlus, FileEdit, FileX, ChevronDown, ChevronRight,
  Play, RefreshCw, AlertCircle, CheckCircle, SkipForward,
} from 'lucide-react';

interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
}

interface ScopeInfo {
  agentsToRun: string[];
  agentsToSkip: string[];
  agentsToInherit: string[];
  reasoning: Record<string, string>;
}

interface DiffPreviewData {
  repositoryId: string;
  lastAnalyzedCommit: string | null;
  lastRunId: string | null;
  diff: {
    fromCommit: string | null;
    toCommit: string;
    isFirstRun: boolean;
    changedFiles: ChangedFile[];
    stats: { added: number; modified: number; deleted: number; renamed: number; total: number };
  };
  scope: ScopeInfo;
}

interface DiffPreviewProps {
  repoUrl: string;
  branch: string;
  qaEngineUrl: string;
  onStartRun: (options: { incremental: boolean; forceAgents: string[] }) => void;
}

const STATUS_ICONS: Record<string, any> = {
  added: FilePlus,
  modified: FileEdit,
  deleted: FileX,
  renamed: FileEdit,
};

const STATUS_COLORS: Record<string, string> = {
  added: 'green',
  modified: 'yellow',
  deleted: 'red',
  renamed: 'blue',
};

const AGENT_LABELS: Record<string, string> = {
  'business-context-analyzer': 'Business Context',
  'code-quality-architect': 'Code Quality',
  'self-healer': 'Self-Healer',
  'api-validator': 'API Validator',
  'coverage-auditor': 'Coverage Auditor',
  'ui-ux-analyst': 'UI/UX Analyst',
  'behavioral-analyst': 'Behavioral Analyst',
  'change-tracker': 'Change Tracker',
  'fullstack-auditor': 'Fullstack Auditor',
  'gherkin-writer': 'Gherkin Writer',
  'product-manager': 'Product Manager',
  'research-assistant': 'Research Assistant',
};

export default function DiffPreview({ repoUrl, branch, qaEngineUrl, onStartRun }: DiffPreviewProps) {
  const [data, setData] = useState<DiffPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFiles, setShowFiles] = useState(false);
  const [forceAgents, setForceAgents] = useState<Set<string>>(new Set());

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const addedBg = useColorModeValue('green.50', 'green.900');
  const modifiedBg = useColorModeValue('yellow.50', 'yellow.900');
  const deletedBg = useColorModeValue('red.50', 'red.900');
  const inheritBg = useColorModeValue('blue.50', 'blue.900');

  const repositoryId = `repo_${btoa(`${repoUrl}:${branch}`).replace(/[+/=]/g, '').substring(0, 32)}`;

  useEffect(() => {
    fetchDiffPreview();
  }, [repoUrl, branch]);

  async function fetchDiffPreview() {
    setLoading(true);
    setError(null);
    try {
      const url = `${qaEngineUrl}/qa/diff-preview/${repositoryId}?repoUrl=${encodeURIComponent(repoUrl)}&branch=${encodeURIComponent(branch)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleForceAgent(agentId: string) {
    setForceAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  }

  if (loading) {
    return (
      <Box p={4} bg={cardBg} borderWidth={1} borderColor={borderColor} borderRadius="md">
        <HStack><Spinner size="sm" /><Text>Computing diff preview...</Text></HStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4} bg={cardBg} borderWidth={1} borderColor={borderColor} borderRadius="md">
        <HStack color="red.500">
          <Icon as={AlertCircle} />
          <Text>Diff preview unavailable: {error}</Text>
          <Button size="xs" onClick={fetchDiffPreview}>Retry</Button>
        </HStack>
      </Box>
    );
  }

  if (!data) return null;

  const { diff, scope } = data;
  const allForceAgents = Array.from(forceAgents);

  return (
    <Box p={4} bg={cardBg} borderWidth={1} borderColor={borderColor} borderRadius="md">
      <VStack align="stretch" spacing={3}>
        {/* Header */}
        <HStack justify="space-between">
          <HStack>
            <Icon as={GitBranch} color="purple.500" />
            <Text fontWeight="bold" fontSize="sm">
              {diff.isFirstRun ? 'First Analysis' : `Changes since last analysis`}
            </Text>
          </HStack>
          {data.lastAnalyzedCommit && (
            <Code fontSize="xs" colorScheme="gray">
              {data.lastAnalyzedCommit.substring(0, 7)}..{diff.toCommit.substring(0, 7)}
            </Code>
          )}
        </HStack>

        {/* Stats */}
        {diff.isFirstRun ? (
          <Box p={2} bg={inheritBg} borderRadius="sm">
            <Text fontSize="sm">No previous analysis found. Full scan will run all agents.</Text>
          </Box>
        ) : diff.stats.total === 0 ? (
          <Box p={2} bg={addedBg} borderRadius="sm">
            <HStack>
              <Icon as={CheckCircle} color="green.500" boxSize={4} />
              <Text fontSize="sm">No changes since last analysis. All results are current.</Text>
            </HStack>
          </Box>
        ) : (
          <>
            <HStack spacing={3} fontSize="sm">
              {diff.stats.added > 0 && (
                <Badge colorScheme="green">+{diff.stats.added} added</Badge>
              )}
              {diff.stats.modified > 0 && (
                <Badge colorScheme="yellow">~{diff.stats.modified} modified</Badge>
              )}
              {diff.stats.deleted > 0 && (
                <Badge colorScheme="red">-{diff.stats.deleted} deleted</Badge>
              )}
              {diff.stats.renamed > 0 && (
                <Badge colorScheme="blue">R{diff.stats.renamed} renamed</Badge>
              )}
              <Text color={subtextColor}>{diff.stats.total} files total</Text>
            </HStack>

            {/* Changed files (collapsible) */}
            <Box>
              <Button
                size="xs"
                variant="ghost"
                leftIcon={<Icon as={showFiles ? ChevronDown : ChevronRight} />}
                onClick={() => setShowFiles(!showFiles)}
              >
                {showFiles ? 'Hide' : 'Show'} changed files
              </Button>
              <Collapse in={showFiles}>
                <VStack align="stretch" spacing={1} mt={2} maxH="200px" overflowY="auto">
                  {diff.changedFiles.map((f, i) => (
                    <HStack key={i} fontSize="xs" px={2} py={1}
                      bg={f.status === 'added' ? addedBg : f.status === 'deleted' ? deletedBg : modifiedBg}
                      borderRadius="sm"
                    >
                      <Icon as={STATUS_ICONS[f.status]} boxSize={3} color={`${STATUS_COLORS[f.status]}.500`} />
                      <Text fontFamily="mono" flex={1}>{f.path}</Text>
                      {f.additions > 0 && <Text color="green.500">+{f.additions}</Text>}
                      {f.deletions > 0 && <Text color="red.500">-{f.deletions}</Text>}
                    </HStack>
                  ))}
                </VStack>
              </Collapse>
            </Box>
          </>
        )}

        <Divider />

        {/* Agent Scope */}
        <Text fontWeight="bold" fontSize="sm">Agent Scope</Text>
        <VStack align="stretch" spacing={1}>
          {scope.agentsToRun.map(agentId => (
            <HStack key={agentId} fontSize="xs" px={2} py={1} bg={addedBg} borderRadius="sm">
              <Icon as={Play} boxSize={3} color="green.500" />
              <Text fontWeight="medium">{AGENT_LABELS[agentId] || agentId}</Text>
              <Text color={subtextColor} flex={1} noOfLines={1}>
                {scope.reasoning[agentId]}
              </Text>
            </HStack>
          ))}
          {scope.agentsToInherit.map(agentId => (
            <HStack key={agentId} fontSize="xs" px={2} py={1} bg={inheritBg} borderRadius="sm">
              <Icon as={SkipForward} boxSize={3} color="blue.500" />
              <Text>{AGENT_LABELS[agentId] || agentId}</Text>
              <Text color={subtextColor} flex={1} noOfLines={1}>inherited</Text>
              <Tooltip label="Force this agent to re-run">
                <Checkbox
                  size="sm"
                  isChecked={forceAgents.has(agentId)}
                  onChange={() => toggleForceAgent(agentId)}
                >
                  <Text fontSize="xs">Force</Text>
                </Checkbox>
              </Tooltip>
            </HStack>
          ))}
        </VStack>

        <Divider />

        {/* Action buttons */}
        <Flex gap={2}>
          <Button
            size="sm"
            colorScheme="green"
            leftIcon={<Icon as={Play} />}
            onClick={() => onStartRun({ incremental: true, forceAgents: allForceAgents })}
          >
            {diff.isFirstRun ? 'Start Full Analysis' : 'Start Incremental Run'}
          </Button>
          {!diff.isFirstRun && (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Icon as={RefreshCw} />}
              onClick={() => onStartRun({ incremental: false, forceAgents: [] })}
            >
              Full Re-scan
            </Button>
          )}
        </Flex>
      </VStack>
    </Box>
  );
}
