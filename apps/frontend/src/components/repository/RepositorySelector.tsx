/**
 * RepositorySelector - Compact repository and branch selector for header/nav area
 *
 * Fetches repositories from the ingestion service and branches from ArangoDB.
 * Updates the global Zustand repository store when selections change.
 */

import React, { useEffect } from 'react';
import {
  Box,
  HStack,
  Select,
  Text,
  Spinner,
  Badge,
  Tooltip,
  useColorModeValue
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, Database } from 'lucide-react';
import { apiClient } from '../../lib/api/client';
import { useRepositoryStore } from '../../stores/repositoryStore';
import type { Repository, Branch } from '../../stores/repositoryStore';

const RepositorySelector: React.FC = () => {
  const {
    repositories,
    selectedRepositoryId,
    selectedBranch,
    branches,
    setRepositories,
    selectRepository,
    selectBranch,
    setBranches
  } = useRepositoryStore();

  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const selectBg = useColorModeValue('white', 'gray.700');

  // Fetch repositories
  const {
    data: repoData,
    isLoading: reposLoading,
    error: reposError
  } = useQuery({
    queryKey: ['repositories'],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/ingestion/repositories');
      return res.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2
  });

  // Fetch branches when a repository is selected
  const {
    data: branchData,
    isLoading: branchesLoading
  } = useQuery({
    queryKey: ['branches', selectedRepositoryId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/ingestion/repositories/${selectedRepositoryId}/branches`);
      return res.data;
    },
    enabled: !!selectedRepositoryId,
    staleTime: 2 * 60 * 1000,
    retry: 2
  });

  // Sync fetched repositories into store
  useEffect(() => {
    if (repoData?.repositories) {
      const mapped: Repository[] = repoData.repositories.map((r: any) => ({
        id: r.id || r._key || r._id,
        url: r.url || '',
        name: r.name || r.url?.split('/').pop() || 'Unknown',
        defaultBranch: r.defaultBranch || 'main',
        lastAnalyzed: r.lastAnalyzed,
        totalRuns: r.totalRuns || 0
      }));
      setRepositories(mapped);
    }
  }, [repoData, setRepositories]);

  // Sync fetched branches into store
  useEffect(() => {
    if (branchData?.branches) {
      const mapped: Branch[] = branchData.branches.map((b: any) => ({
        id: b.id || b._key || b.name,
        name: b.name,
        commitHash: b.commitHash || b.latestCommit,
        lastAnalyzed: b.lastAnalyzed
      }));
      setBranches(mapped);
    } else {
      setBranches([]);
    }
  }, [branchData, setBranches]);

  const handleRepositoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const repoId = e.target.value;
    if (repoId) {
      selectRepository(repoId);
    }
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const branch = e.target.value;
    if (branch) {
      selectBranch(branch);
    }
  };

  // No repositories state
  if (!reposLoading && !reposError && repositories.length === 0 && repoData) {
    return (
      <HStack spacing={2} px={2}>
        <Database size={14} />
        <Text fontSize="sm" color="gray.500">
          No repositories ingested
        </Text>
      </HStack>
    );
  }

  return (
    <HStack spacing={3} align="center">
      {/* Repository Select */}
      <HStack spacing={2} align="center">
        <Tooltip label="Select repository">
          <Box>
            <Database size={14} color="gray" />
          </Box>
        </Tooltip>
        {reposLoading ? (
          <Spinner size="xs" />
        ) : reposError ? (
          <Badge colorScheme="red" fontSize="xs">API offline</Badge>
        ) : (
          <Select
            size="sm"
            width="200px"
            bg={selectBg}
            borderColor={borderColor}
            placeholder="Select repository"
            value={selectedRepositoryId || ''}
            onChange={handleRepositoryChange}
          >
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.name}
              </option>
            ))}
          </Select>
        )}
      </HStack>

      {/* Branch Select */}
      {selectedRepositoryId && (
        <HStack spacing={2} align="center">
          <Tooltip label="Select branch">
            <Box>
              <GitBranch size={14} color="gray" />
            </Box>
          </Tooltip>
          {branchesLoading ? (
            <Spinner size="xs" />
          ) : (
            <Select
              size="sm"
              width="160px"
              bg={selectBg}
              borderColor={borderColor}
              placeholder="Branch"
              value={selectedBranch || ''}
              onChange={handleBranchChange}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.name}>
                  {branch.name}
                </option>
              ))}
            </Select>
          )}
          {selectedBranch && (
            <Badge colorScheme="green" fontSize="xs" variant="subtle">
              {selectedBranch}
            </Badge>
          )}
        </HStack>
      )}
    </HStack>
  );
};

export default RepositorySelector;
