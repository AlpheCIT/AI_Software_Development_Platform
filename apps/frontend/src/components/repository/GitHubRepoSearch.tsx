/**
 * GitHub Repository Search Component
 * Professional repository selection with real GitHub API integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  VStack,
  HStack,
  Text,
  Badge,
  Card,
  CardBody,
  Spinner,
  Icon,
  Avatar,
  Skeleton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast,
  Divider,
  SimpleGrid,
  Collapse,
  IconButton,
  Tooltip
} from '@chakra-ui/react';
import {
  Search,
  Github,
  Star,
  GitFork,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { gitHubService, GitHubRepository, RepoValidationResult } from '../../services/gitHubService';

export interface GitHubRepoSearchProps {
  onRepoSelect: (repo: GitHubRepository, validation: RepoValidationResult) => void;
  placeholder?: string;
  showValidation?: boolean;
  showPopular?: boolean;
  autoSearch?: boolean;
}

export function GitHubRepoSearch({
  onRepoSelect,
  placeholder = 'Search GitHub repositories or paste URL...',
  showValidation = true,
  showPopular = true,
  autoSearch = true
}: GitHubRepoSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<GitHubRepository[]>([]);
  const [popularRepos, setPopularRepos] = useState<GitHubRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [validation, setValidation] = useState<RepoValidationResult | null>(null);
  const [showPopularExpanded, setShowPopularExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const toast = useToast();

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  const getValidationIcon = (validation: RepoValidationResult) => {
    if (validation.errors?.length) {
      return <Icon as={AlertCircle} color="red.500" />;
    }
    if (validation.warnings?.length) {
      return <Icon as={Clock} color="yellow.500" />;
    }
    return <Icon as={CheckCircle} color="green.500" />;
  };

  const performSearch = useCallback(async (query: string) => {
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      // Check if it's a URL or direct repo reference
      if (query.includes('github.com') || query.includes('/')) {
        const repo = await gitHubService.getRepositoryDetails(query);
        setResults([repo]);
      } else {
        const searchResults = await gitHubService.searchRepositories(query, {
          sort: 'stars',
          per_page: 20
        });
        setResults(searchResults.items);
      }
    } catch (err: any) {
      console.error('Search failed:', err);
      setError(err.message || 'Search failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const loadPopularRepositories = async () => {
    try {
      const popular = await gitHubService.getPopularRepositories(undefined, 8);
      setPopularRepos(popular);
    } catch (err) {
      console.error('Failed to load popular repositories:', err);
    }
  };

  const handleRepoClick = async (repo: GitHubRepository) => {
    if (validating) return;

    setSelectedRepo(repo);
    
    if (showValidation) {
      try {
        setValidating(true);
        const validationResult = await gitHubService.validateRepository(repo.full_name);
        setValidation(validationResult);
        
        if (!validationResult.isValid) {
          toast({
            title: 'Repository Validation Issues',
            description: validationResult.errors?.join(' '),
            status: 'warning',
            duration: 5000,
            isClosable: true
          });
        }
        
        onRepoSelect(repo, validationResult);
      } catch (err: any) {
        toast({
          title: 'Validation Failed',
          description: err.message || 'Failed to validate repository',
          status: 'error',
          duration: 5000,
          isClosable: true
        });
      } finally {
        setValidating(false);
      }
    } else {
      const basicValidation: RepoValidationResult = {
        isValid: true,
        isAccessible: !repo.private,
        size: repo.size,
        language: repo.language,
        defaultBranch: repo.default_branch,
        lastUpdated: repo.updated_at
      };
      
      onRepoSelect(repo, basicValidation);
    }
  };

  const handleManualSearch = () => {
    if (searchTerm.trim()) {
      performSearch(searchTerm.trim());
    }
  };

  // Debounced search
  useEffect(() => {
    if (!autoSearch || !searchTerm || searchTerm.length < 3) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(searchTerm);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, autoSearch, performSearch]);

  // Load popular repositories on mount
  useEffect(() => {
    if (showPopular) {
      loadPopularRepositories();
    }
  }, [showPopular]);

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        <InputGroup size="lg">
          <InputLeftElement>
            <Icon as={Github} color="gray.500" />
          </InputLeftElement>
          <Input
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
            bg="white"
            border="2px solid"
            borderColor="gray.200"
            _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px #3182CE' }}
            _hover={{ borderColor: 'gray.300' }}
          />
          <InputRightElement>
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <IconButton
                aria-label="Search"
                icon={<Search size={16} />}
                size="sm"
                variant="ghost"
                onClick={handleManualSearch}
                isDisabled={!searchTerm.trim()}
              />
            )}
          </InputRightElement>
        </InputGroup>

        {/* Error Display */}
        {error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Search Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Box>
          </Alert>
        )}

        {/* Search Results */}
        {results.length > 0 && (
          <VStack spacing={3} align="stretch">
            <Text fontWeight="semibold" color="gray.700">
              Search Results ({results.length})
            </Text>
            {results.map((repo) => (
              <RepositoryCard
                key={repo.id}
                repo={repo}
                isSelected={selectedRepo?.id === repo.id}
                isValidating={validating && selectedRepo?.id === repo.id}
                validation={selectedRepo?.id === repo.id ? validation : null}
                onClick={() => handleRepoClick(repo)}
                showValidation={showValidation}
                formatNumber={formatNumber}
                getValidationIcon={getValidationIcon}
              />
            ))}
          </VStack>
        )}

        {/* Loading State */}
        {loading && results.length === 0 && (
          <VStack spacing={3}>
            {[...Array(3)].map((_, i) => (
              <Card key={i} w="full">
                <CardBody>
                  <VStack spacing={2} align="stretch">
                    <Skeleton height="20px" />
                    <Skeleton height="16px" width="80%" />
                    <HStack spacing={2}>
                      <Skeleton height="12px" width="60px" />
                      <Skeleton height="12px" width="60px" />
                      <Skeleton height="12px" width="80px" />
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>
            ))}
          </VStack>
        )}
      </VStack>
    </Box>
  );
}

interface RepositoryCardProps {
  repo: GitHubRepository;
  isSelected: boolean;
  isValidating: boolean;
  validation: RepoValidationResult | null;
  onClick: () => void;
  showValidation: boolean;
  formatNumber: (num: number) => string;
  getValidationIcon: (validation: RepoValidationResult) => JSX.Element;
  compact?: boolean;
}

function RepositoryCard({
  repo,
  isSelected,
  isValidating,
  validation,
  onClick,
  showValidation,
  formatNumber,
  getValidationIcon,
  compact = false
}: RepositoryCardProps) {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
    return `${Math.ceil(diffDays / 365)} years ago`;
  };

  return (
    <Card
      cursor="pointer"
      onClick={onClick}
      border="2px solid"
      borderColor={isSelected ? 'blue.500' : 'gray.200'}
      bg={isSelected ? 'blue.50' : 'white'}
      _hover={{ 
        borderColor: 'blue.400', 
        transform: 'translateY(-1px)',
        shadow: 'md'
      }}
      transition="all 0.2s"
    >
      <CardBody p={compact ? 4 : 6}>
        <VStack spacing={compact ? 2 : 3} align="stretch">
          <HStack justify="space-between" align="start">
            <HStack spacing={3} flex={1} minW={0}>
              <Avatar
                src={repo.owner.avatar_url}
                name={repo.owner.login}
                size={compact ? "sm" : "md"}
              />
              <VStack spacing={1} align="start" flex={1} minW={0}>
                <HStack spacing={2} wrap="wrap">
                  <Text
                    fontWeight="bold"
                    fontSize={compact ? "sm" : "md"}
                    color={isSelected ? 'blue.700' : 'gray.800'}
                    noOfLines={1}
                  >
                    {repo.full_name}
                  </Text>
                  {repo.private && (
                    <Badge colorScheme="red" size="sm">Private</Badge>
                  )}
                </HStack>
                <Text
                  fontSize="xs"
                  color="gray.500"
                  noOfLines={compact ? 1 : 2}
                >
                  {repo.description || 'No description available'}
                </Text>
              </VStack>
            </HStack>
            
            {showValidation && (
              <Box>
                {isValidating ? (
                  <Spinner size="sm" color="blue.500" />
                ) : validation ? (
                  <Tooltip
                    label={
                      validation.errors?.length
                        ? `Errors: ${validation.errors.join(', ')}`
                        : validation.warnings?.length
                        ? `Warnings: ${validation.warnings.join(', ')}`
                        : 'Repository is valid for ingestion'
                    }
                  >
                    {getValidationIcon(validation)}
                  </Tooltip>
                ) : null}
              </Box>
            )}
          </HStack>

          <HStack spacing={4} fontSize="sm" color="gray.600">
            {repo.language && (
              <HStack spacing={1}>
                <Box w={3} h={3} bg="blue.500" borderRadius="full" />
                <Text>{repo.language}</Text>
              </HStack>
            )}
            <HStack spacing={1}>
              <Icon as={Star} size={14} />
              <Text>{formatNumber(repo.stargazers_count)}</Text>
            </HStack>
            <HStack spacing={1}>
              <Icon as={GitFork} size={14} />
              <Text>{formatNumber(repo.forks_count)}</Text>
            </HStack>
            <HStack spacing={1}>
              <Icon as={Calendar} size={14} />
              <Text>{formatDate(repo.updated_at)}</Text>
            </HStack>
          </HStack>

          {showValidation && validation && (validation.errors?.length || validation.warnings?.length) && (
            <Collapse in={isSelected}>
              <Divider my={2} />
              <VStack spacing={2} align="stretch">
                {validation.errors?.map((error, index) => (
                  <Alert key={index} status="error" size="sm" borderRadius="md">
                    <AlertIcon boxSize={4} />
                    <Text fontSize="sm">{error}</Text>
                  </Alert>
                ))}
                {validation.warnings?.map((warning, index) => (
                  <Alert key={index} status="warning" size="sm" borderRadius="md">
                    <AlertIcon boxSize={4} />
                    <Text fontSize="sm">{warning}</Text>
                  </Alert>
                ))}
              </VStack>
            </Collapse>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}

export default GitHubRepoSearch;

