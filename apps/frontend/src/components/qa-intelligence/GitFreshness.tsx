/**
 * GitFreshness - Shows whether the analyzed commit is up-to-date with the remote.
 * Displays a badge (up to date / stale / unknown) and commit info with a re-analyze button.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Badge,
  Button,
  HStack,
  Text,
  VStack,
  Tooltip,
  Spinner,
  useColorModeValue,
} from '@chakra-ui/react';
import { qaService } from '../../services/qaService';

interface FreshnessData {
  repositoryId: string;
  lastAnalyzedCommit: string | null;
  lastAnalyzedDate: string | null;
  lastAnalyzedMessage: string | null;
  remoteHeadCommit: string | null;
  isStale: boolean | 'unknown';
  commitsBehind: number | null;
}

interface GitFreshnessProps {
  repositoryId: string;
  repoUrl: string;
  onReanalyze: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const GitFreshness: React.FC<GitFreshnessProps> = ({
  repositoryId,
  repoUrl,
  onReanalyze,
}) => {
  const [data, setData] = useState<FreshnessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    let cancelled = false;

    async function fetchFreshness() {
      setLoading(true);
      setError(null);
      try {
        const result = await qaService.getFreshness(repositoryId);
        if (!cancelled) setData(result);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to check freshness');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFreshness();
    return () => { cancelled = true; };
  }, [repositoryId]);

  if (loading) {
    return (
      <HStack spacing={2} p={3} bg={bgColor} borderRadius="md" border="1px" borderColor={borderColor}>
        <Spinner size="sm" />
        <Text fontSize="sm" color={subtextColor}>Checking freshness...</Text>
      </HStack>
    );
  }

  if (error || !data) {
    return (
      <HStack spacing={2} p={3} bg={bgColor} borderRadius="md" border="1px" borderColor={borderColor}>
        <Badge colorScheme="gray">Unknown</Badge>
        <Text fontSize="sm" color={subtextColor}>{error || 'No freshness data'}</Text>
      </HStack>
    );
  }

  const shortSha = data.lastAnalyzedCommit?.slice(0, 7) || '---';
  const timeAgo = data.lastAnalyzedDate ? formatTimeAgo(data.lastAnalyzedDate) : 'unknown';

  let badgeContent: React.ReactNode;
  let badgeColor: string;

  if (data.isStale === 'unknown') {
    badgeColor = 'gray';
    badgeContent = 'Unknown';
  } else if (data.isStale === false) {
    badgeColor = 'green';
    badgeContent = 'Up to date';
  } else {
    badgeColor = 'orange';
    badgeContent = data.commitsBehind && data.commitsBehind > 1
      ? `${data.commitsBehind} commits behind`
      : 'New commits available';
  }

  return (
    <Box p={3} bg={bgColor} borderRadius="md" border="1px" borderColor={borderColor}>
      <VStack align="stretch" spacing={2}>
        <HStack justify="space-between">
          <HStack spacing={2}>
            <Badge colorScheme={badgeColor} fontSize="xs" px={2} py={0.5} borderRadius="full">
              {badgeContent}
            </Badge>
            {data.isStale === true && (
              <Button
                size="xs"
                colorScheme="blue"
                variant="outline"
                onClick={onReanalyze}
              >
                Re-analyze
              </Button>
            )}
          </HStack>
        </HStack>

        <HStack spacing={1} flexWrap="wrap">
          <Text fontSize="xs" color={subtextColor}>Last analyzed:</Text>
          <Tooltip label={data.lastAnalyzedCommit || 'No commit'} placement="top">
            <Text fontSize="xs" fontFamily="mono" fontWeight="bold">
              {shortSha}
            </Text>
          </Tooltip>
          {data.lastAnalyzedMessage && (
            <Text fontSize="xs" color={subtextColor} noOfLines={1} maxW="220px">
              &mdash; &ldquo;{data.lastAnalyzedMessage}&rdquo;
            </Text>
          )}
          <Text fontSize="xs" color={subtextColor}>&mdash; {timeAgo}</Text>
        </HStack>
      </VStack>
    </Box>
  );
};

export default GitFreshness;
