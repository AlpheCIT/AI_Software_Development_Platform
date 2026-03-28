import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  VStack,
  Box,
  HStack,
  Text,
  Badge,
  Code,
  Alert,
  AlertIcon,
  Spinner,
  Divider,
} from '@chakra-ui/react';
import { GitCommit, User, Clock } from 'lucide-react';
import { arangoDBService } from '../../services/arangodbService';

interface CommitHistoryProps {
  repositoryId: string;
}

interface Commit {
  _key: string;
  hash: string;
  author: string;
  date: string;
  message: string;
  repositoryId: string;
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
  return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
}

export default function CommitHistory({ repositoryId }: CommitHistoryProps) {
  const { data: commits, isLoading, error } = useQuery({
    queryKey: ['git-commits', repositoryId],
    queryFn: async () => {
      const result = await arangoDBService.executeAQL(
        `FOR c IN git_commits
           FILTER c.repositoryId == @repositoryId
           SORT c.date DESC
           LIMIT 50
           RETURN c`,
        { repositoryId }
      );
      return result as Commit[];
    },
    enabled: !!repositoryId,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <VStack spacing={4} align="center" p={6}>
        <Spinner size="md" />
        <Text fontSize="sm" color="gray.500">Loading commit history...</Text>
      </VStack>
    );
  }

  if (error) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          Failed to load commit history. Please try again.
        </Alert>
      </VStack>
    );
  }

  if (!commits || commits.length === 0) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          No commits found for this repository.
        </Alert>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={0} maxH="600px" overflowY="auto">
      <HStack px={4} py={3} bg="gray.50" borderBottom="1px" borderColor="gray.200">
        <GitCommit size={16} />
        <Text fontSize="sm" fontWeight="semibold">
          {commits.length} commit{commits.length !== 1 ? 's' : ''}
        </Text>
      </HStack>

      {commits.map((commit, index) => (
        <Box
          key={commit._key || commit.hash || index}
          px={4}
          py={3}
          borderBottom="1px"
          borderColor="gray.100"
          _hover={{ bg: 'gray.50' }}
          transition="background 0.15s"
        >
          <HStack spacing={3} align="start">
            <Box mt={1} color="gray.400">
              <GitCommit size={14} />
            </Box>

            <Box flex="1" minW={0}>
              <Text fontSize="sm" fontWeight="medium" noOfLines={1} mb={1}>
                {commit.message}
              </Text>

              <HStack spacing={3} flexWrap="wrap">
                <Code
                  fontSize="xs"
                  px={2}
                  py={0.5}
                  borderRadius="md"
                  colorScheme="blue"
                  fontFamily="mono"
                >
                  {commit.hash ? commit.hash.substring(0, 7) : 'unknown'}
                </Code>

                <HStack spacing={1} color="gray.500">
                  <User size={12} />
                  <Text fontSize="xs">{commit.author}</Text>
                </HStack>

                <HStack spacing={1} color="gray.500">
                  <Clock size={12} />
                  <Text fontSize="xs">{formatRelativeDate(commit.date)}</Text>
                </HStack>
              </HStack>
            </Box>
          </HStack>
        </Box>
      ))}
    </VStack>
  );
}
