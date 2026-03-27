/**
 * RepoWiki - Main container for the auto-generated repository wiki view
 *
 * Split pane layout:
 *   Left  (40%): DirectoryTree with search & collapsible folders
 *   Right (60%): FileDetail for the selected file
 *
 * Header shows repo name, branch, file/entity counts, and doc coverage.
 * A summary card highlights documentation gaps and code health.
 */

import React, { useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Icon,
  useColorModeValue,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Spinner,
  Alert,
  AlertIcon,
  Grid,
  GridItem,
  Heading,
  Tag,
  Divider,
} from '@chakra-ui/react';
import {
  FileCode,
  Book,
  AlertTriangle,
  CheckCircle,
  Code,
  Search,
} from 'lucide-react';

import DirectoryTree from './DirectoryTree';
import FileDetail from './FileDetail';
import { useRepoWiki } from '../../hooks/useRepoWiki';
import type { WikiFile, WikiEntity } from '../../hooks/useRepoWiki';

// ── Props ──────────────────────────────────────────────────────────────────

interface RepoWikiProps {
  runId: string | null;
}

// ── Grade color mapping ────────────────────────────────────────────────────

function gradeColor(grade: string | null): string {
  if (!grade) return 'gray';
  switch (grade) {
    case 'A':
      return 'green';
    case 'B':
      return 'teal';
    case 'C':
      return 'yellow';
    case 'D':
      return 'orange';
    case 'F':
      return 'red';
    default:
      return 'gray';
  }
}

// ── Extract repo name from URL ─────────────────────────────────────────────

function repoName(url: string): string {
  try {
    const parts = url.replace(/\.git$/, '').split('/');
    return parts.slice(-2).join('/');
  } catch {
    return url;
  }
}

// ── Main Component ─────────────────────────────────────────────────────────

const RepoWiki: React.FC<RepoWikiProps> = ({ runId }) => {
  const { wikiData, loading, error, selectedFile, setSelectedFile } = useRepoWiki(runId);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const treeBg = useColorModeValue('gray.50', 'gray.900');
  const paneBorder = useColorModeValue('gray.200', 'gray.700');

  // Resolve selected file data
  const selectedFileData: WikiFile | null = useMemo(() => {
    if (!wikiData || !selectedFile) return null;
    return wikiData.files.find((f) => f.path === selectedFile) || null;
  }, [wikiData, selectedFile]);

  const selectedFileEntities: WikiEntity[] = useMemo(() => {
    if (!wikiData || !selectedFile) return [];
    return wikiData.entities.filter((e) => e.file === selectedFile);
  }, [wikiData, selectedFile]);

  // ── No runId state ─────────────────────────────────────────────────────

  if (!runId) {
    return (
      <Box p={8} textAlign="center">
        <VStack spacing={4}>
          <Icon as={Book} boxSize={12} color="gray.400" />
          <Heading size="md" color={subtextColor}>
            Repository Wiki
          </Heading>
          <Text color={subtextColor}>
            Run a QA analysis to generate the repository wiki. The wiki is built from
            code files, entities, test coverage, and code quality data.
          </Text>
        </VStack>
      </Box>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box p={8} textAlign="center">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" thickness="4px" />
          <Text color={subtextColor}>Loading repository wiki...</Text>
        </VStack>
      </Box>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────

  if (error) {
    return (
      <Box p={4}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {error}
        </Alert>
      </Box>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────

  if (!wikiData || wikiData.files.length === 0) {
    return (
      <Box p={8} textAlign="center">
        <VStack spacing={4}>
          <Icon as={Search} boxSize={12} color="gray.400" />
          <Heading size="md" color={subtextColor}>
            No Wiki Data
          </Heading>
          <Text color={subtextColor}>
            The QA run has not produced file or entity data yet. This may happen if the
            repository ingestion step was skipped or failed.
          </Text>
        </VStack>
      </Box>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────

  const repo = wikiData.repository;
  const docs = wikiData.documentation;
  const summary = wikiData.summary;

  return (
    <VStack spacing={0} align="stretch" h="100%">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Box
        bg={cardBg}
        borderBottom="1px solid"
        borderColor={borderColor}
        px={4}
        py={3}
      >
        <HStack spacing={3} mb={2} flexWrap="wrap">
          <Icon as={Book} boxSize={5} color="blue.500" />
          <Heading size="md">{repoName(repo.url)}</Heading>
          <Badge colorScheme="blue" variant="outline" fontSize="xs">
            {repo.branch}
          </Badge>
        </HStack>

        <SimpleGrid columns={{ base: 2, md: 5 }} spacing={3}>
          <Stat size="sm">
            <StatLabel fontSize="xs">Files</StatLabel>
            <StatNumber fontSize="md">{repo.totalFiles}</StatNumber>
          </Stat>
          <Stat size="sm">
            <StatLabel fontSize="xs">Entities</StatLabel>
            <StatNumber fontSize="md">{repo.totalEntities}</StatNumber>
          </Stat>
          <Stat size="sm">
            <StatLabel fontSize="xs">Doc Coverage</StatLabel>
            <StatNumber fontSize="md">{docs.coverage}</StatNumber>
          </Stat>
          <Stat size="sm">
            <StatLabel fontSize="xs">Code Health</StatLabel>
            <HStack spacing={1}>
              {summary.codeHealthGrade && (
                <Badge colorScheme={gradeColor(summary.codeHealthGrade)} fontSize="md">
                  {summary.codeHealthGrade}
                </Badge>
              )}
              {summary.codeHealthScore != null && (
                <Text fontSize="sm" color={subtextColor}>
                  ({summary.codeHealthScore})
                </Text>
              )}
              {!summary.codeHealthGrade && !summary.codeHealthScore && (
                <Text fontSize="sm" color={subtextColor}>
                  --
                </Text>
              )}
            </HStack>
          </Stat>
          <Stat size="sm">
            <StatLabel fontSize="xs">TODOs</StatLabel>
            <StatNumber fontSize="md">{summary.totalTODOs}</StatNumber>
          </Stat>
        </SimpleGrid>
      </Box>

      {/* ── Documentation Gaps Summary ──────────────────────────────────── */}
      {docs.gaps.length > 0 && (
        <Box
          bg={cardBg}
          borderBottom="1px solid"
          borderColor={borderColor}
          px={4}
          py={3}
        >
          <HStack spacing={2} mb={2}>
            <Icon as={AlertTriangle} boxSize={4} color="yellow.500" />
            <Text fontSize="sm" fontWeight="bold">
              Documentation Gaps
            </Text>
            <Badge colorScheme="yellow" variant="subtle" fontSize="xs">
              {docs.gaps.length} files need docs
            </Badge>
          </HStack>
          <HStack spacing={2} flexWrap="wrap">
            {docs.gaps.slice(0, 8).map((gap) => (
              <Tag
                key={gap}
                size="sm"
                colorScheme="yellow"
                variant="subtle"
                cursor="pointer"
                onClick={() => setSelectedFile(gap)}
                _hover={{ opacity: 0.8 }}
              >
                {gap.split('/').pop()}
              </Tag>
            ))}
            {docs.gaps.length > 8 && (
              <Text fontSize="xs" color={subtextColor}>
                +{docs.gaps.length - 8} more
              </Text>
            )}
          </HStack>
        </Box>
      )}

      {/* ── Split Pane ──────────────────────────────────────────────────── */}
      <Grid
        templateColumns={{ base: '1fr', md: '40% 60%' }}
        flex={1}
        overflow="hidden"
      >
        {/* Left: File tree */}
        <GridItem
          bg={treeBg}
          borderRight={{ md: '1px solid' }}
          borderColor={paneBorder}
          overflow="hidden"
          h="100%"
          minH="400px"
        >
          <DirectoryTree
            files={wikiData.files}
            entities={wikiData.entities}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
          />
        </GridItem>

        {/* Right: File detail */}
        <GridItem overflow="hidden" h="100%" minH="400px">
          {selectedFileData ? (
            <FileDetail
              file={selectedFileData}
              entities={selectedFileEntities}
              testCount={selectedFileData.testCount}
            />
          ) : (
            <Box p={8} textAlign="center">
              <VStack spacing={4}>
                <Icon as={FileCode} boxSize={10} color="gray.400" />
                <Text color={subtextColor} fontSize="sm">
                  Select a file from the tree to view its details
                </Text>
              </VStack>
            </Box>
          )}
        </GridItem>
      </Grid>
    </VStack>
  );
};

export default RepoWiki;
