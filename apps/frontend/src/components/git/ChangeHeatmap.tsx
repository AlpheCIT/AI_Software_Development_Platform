import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  VStack,
  Box,
  HStack,
  Text,
  Alert,
  AlertIcon,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
} from '@chakra-ui/react';
import { Flame, FileText } from 'lucide-react';
import { arangoDBService } from '../../services/arangodbService';

interface ChangeHeatmapProps {
  repositoryId: string;
}

interface FileChurn {
  filePath: string;
  changeCount: number;
}

/**
 * Returns a background color that increases in intensity with change count.
 * Low churn = light yellow, high churn = deep orange/red.
 */
function getHeatColor(changeCount: number, maxCount: number): string {
  if (maxCount === 0) return 'transparent';
  const ratio = changeCount / maxCount;

  if (ratio < 0.2) return 'orange.50';
  if (ratio < 0.4) return 'orange.100';
  if (ratio < 0.6) return 'orange.200';
  if (ratio < 0.8) return 'red.100';
  return 'red.200';
}

function getHeatBadgeScheme(changeCount: number, maxCount: number): string {
  if (maxCount === 0) return 'gray';
  const ratio = changeCount / maxCount;

  if (ratio < 0.3) return 'yellow';
  if (ratio < 0.6) return 'orange';
  return 'red';
}

export default function ChangeHeatmap({ repositoryId }: ChangeHeatmapProps) {
  const { data: rawCommits, isLoading, error } = useQuery({
    queryKey: ['git-file-churn', repositoryId],
    queryFn: async () => {
      // Query commits and aggregate file change counts via AQL
      const result = await arangoDBService.executeAQL(
        `LET commits = (
           FOR c IN git_commits
             FILTER c.repositoryId == @repositoryId
             RETURN c.filesChanged
         )
         LET allFiles = FLATTEN(commits)
         FOR f IN allFiles
           FILTER f != null
           COLLECT filePath = f WITH COUNT INTO changeCount
           SORT changeCount DESC
           LIMIT 20
           RETURN { filePath, changeCount }`,
        { repositoryId }
      );
      return result as FileChurn[];
    },
    enabled: !!repositoryId,
    staleTime: 60000,
  });

  const { fileChurn, maxCount } = useMemo(() => {
    if (!rawCommits || rawCommits.length === 0) {
      return { fileChurn: [], maxCount: 0 };
    }
    const max = Math.max(...rawCommits.map((f) => f.changeCount));
    return { fileChurn: rawCommits, maxCount: max };
  }, [rawCommits]);

  if (isLoading) {
    return (
      <VStack spacing={4} align="center" p={6}>
        <Spinner size="md" />
        <Text fontSize="sm" color="gray.500">Analyzing file churn...</Text>
      </VStack>
    );
  }

  if (error) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          Failed to load file change data. Please try again.
        </Alert>
      </VStack>
    );
  }

  if (fileChurn.length === 0) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          No file change data available for this repository.
        </Alert>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={4}>
      <HStack px={4} pt={4} spacing={2}>
        <Flame size={16} />
        <Text fontSize="sm" fontWeight="semibold">
          Top {fileChurn.length} Most Changed Files
        </Text>
      </HStack>

      <Box overflowX="auto">
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th fontSize="xs" w="40px">#</Th>
              <Th fontSize="xs">File Path</Th>
              <Th fontSize="xs" isNumeric>Changes</Th>
            </Tr>
          </Thead>
          <Tbody>
            {fileChurn.map((file, index) => (
              <Tr
                key={file.filePath}
                bg={getHeatColor(file.changeCount, maxCount)}
                _hover={{ opacity: 0.85 }}
                transition="opacity 0.15s"
              >
                <Td fontSize="xs" color="gray.500" fontWeight="medium">
                  {index + 1}
                </Td>
                <Td>
                  <HStack spacing={2}>
                    <FileText size={12} color="#718096" />
                    <Text fontSize="sm" fontFamily="mono" noOfLines={1}>
                      {file.filePath}
                    </Text>
                  </HStack>
                </Td>
                <Td isNumeric>
                  <Badge
                    colorScheme={getHeatBadgeScheme(file.changeCount, maxCount)}
                    variant="subtle"
                    fontSize="xs"
                  >
                    {file.changeCount}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </VStack>
  );
}
