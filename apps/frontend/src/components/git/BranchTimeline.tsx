import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  VStack,
  Box,
  HStack,
  Text,
  Badge,
  Tag,
  TagLabel,
  TagLeftIcon,
  List,
  ListItem,
  Alert,
  AlertIcon,
  Spinner,
  Divider,
} from '@chakra-ui/react';
import { GitBranch, Globe, Monitor } from 'lucide-react';
import { arangoDBService } from '../../services/arangodbService';

interface BranchTimelineProps {
  repositoryId: string;
}

interface Branch {
  _key: string;
  name: string;
  repositoryId: string;
  status: 'active' | 'merged' | 'deleted';
  isDefault: boolean;
  isRemote: boolean;
  lastCommitDate?: string;
  lastCommitHash?: string;
  ahead?: number;
  behind?: number;
}

function getStatusColorScheme(status: string): string {
  switch (status) {
    case 'active': return 'green';
    case 'merged': return 'purple';
    case 'deleted': return 'red';
    default: return 'gray';
  }
}

export default function BranchTimeline({ repositoryId }: BranchTimelineProps) {
  const { data: branches, isLoading, error } = useQuery({
    queryKey: ['git-branches', repositoryId],
    queryFn: async () => {
      const result = await arangoDBService.executeAQL(
        `FOR b IN git_branches
           FILTER b.repositoryId == @repositoryId
           SORT b.isDefault DESC, b.status ASC, b.name ASC
           RETURN b`,
        { repositoryId }
      );
      return result as Branch[];
    },
    enabled: !!repositoryId,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <VStack spacing={4} align="center" p={6}>
        <Spinner size="md" />
        <Text fontSize="sm" color="gray.500">Loading branches...</Text>
      </VStack>
    );
  }

  if (error) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          Failed to load branch data. Please try again.
        </Alert>
      </VStack>
    );
  }

  if (!branches || branches.length === 0) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          No branches found for this repository.
        </Alert>
      </VStack>
    );
  }

  const localBranches = branches.filter((b) => !b.isRemote);
  const remoteBranches = branches.filter((b) => b.isRemote);

  return (
    <VStack align="stretch" spacing={4} p={4}>
      <HStack>
        <GitBranch size={16} />
        <Text fontSize="sm" fontWeight="semibold">
          {branches.length} branch{branches.length !== 1 ? 'es' : ''}
        </Text>
      </HStack>

      {/* Local Branches */}
      {localBranches.length > 0 && (
        <Box>
          <HStack mb={2} spacing={2}>
            <Monitor size={14} />
            <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" color="gray.500">
              Local
            </Text>
          </HStack>

          <List spacing={2}>
            {localBranches.map((branch, index) => (
              <ListItem key={branch._key || index}>
                <HStack
                  px={3}
                  py={2}
                  borderRadius="md"
                  bg={branch.isDefault ? 'blue.50' : 'gray.50'}
                  border="1px"
                  borderColor={branch.isDefault ? 'blue.200' : 'gray.200'}
                  justify="space-between"
                >
                  <HStack spacing={2} minW={0} flex={1}>
                    <GitBranch
                      size={14}
                      color={branch.isDefault ? '#3182CE' : '#718096'}
                    />
                    <Text
                      fontSize="sm"
                      fontWeight={branch.isDefault ? 'semibold' : 'normal'}
                      color={branch.isDefault ? 'blue.700' : 'gray.800'}
                      noOfLines={1}
                    >
                      {branch.name}
                    </Text>

                    {branch.isDefault && (
                      <Tag size="sm" colorScheme="blue" variant="subtle">
                        <TagLabel>default</TagLabel>
                      </Tag>
                    )}
                  </HStack>

                  <Badge
                    colorScheme={getStatusColorScheme(branch.status)}
                    variant="subtle"
                    fontSize="xs"
                  >
                    {branch.status}
                  </Badge>
                </HStack>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {remoteBranches.length > 0 && localBranches.length > 0 && <Divider />}

      {/* Remote Branches */}
      {remoteBranches.length > 0 && (
        <Box>
          <HStack mb={2} spacing={2}>
            <Globe size={14} />
            <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" color="gray.500">
              Remote
            </Text>
          </HStack>

          <List spacing={2}>
            {remoteBranches.map((branch, index) => (
              <ListItem key={branch._key || index}>
                <HStack
                  px={3}
                  py={2}
                  borderRadius="md"
                  bg="gray.50"
                  border="1px"
                  borderColor="gray.100"
                  borderStyle="dashed"
                  justify="space-between"
                >
                  <HStack spacing={2} minW={0} flex={1}>
                    <Globe size={14} color="#A0AEC0" />
                    <Text fontSize="sm" color="gray.600" noOfLines={1}>
                      {branch.name}
                    </Text>
                  </HStack>

                  <Badge
                    colorScheme={getStatusColorScheme(branch.status)}
                    variant="outline"
                    fontSize="xs"
                  >
                    {branch.status}
                  </Badge>
                </HStack>
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </VStack>
  );
}
