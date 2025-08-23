import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  VStack,
  HStack,
  Button,
  Text,
  Card,
  CardHeader,
  CardBody,
  Badge,
  SimpleGrid,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Divider,
  Spinner,
  Icon,
  Avatar,
  Progress,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText
} from '@chakra-ui/react';
import { 
  Plus, 
  RefreshCw,
  Play,
  Eye,
  Database,
  GitBranch,
  Calendar,
  Users,
  Activity,
  Shield,
  BarChart3
} from 'lucide-react';

// Import our new services and components
import { arangoDBService, Repository } from '../services/arangodbService';
import { gitHubService, GitHubRepository, RepoValidationResult } from '../services/gitHubService';
import { ingestionService, IngestionJob } from '../services/ingestionService';
import GitHubRepoSearch from '../components/repository/GitHubRepoSearch';
import LiveIngestionDashboard from '../components/repository/LiveIngestionDashboard';

interface RepositoryWithIngestion extends Repository {
  ingestionJob?: IngestionJob;
  githubData?: GitHubRepository;
}

export default function RepositoryPage() {
  const [repositories, setRepositories] = useState<RepositoryWithIngestion[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<RepositoryWithIngestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [selectedGitHubRepo, setSelectedGitHubRepo] = useState<GitHubRepository | null>(null);
  const [activeIngestionJob, setActiveIngestionJob] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIngestionModal, setShowIngestionModal] = useState(false);
  const [databaseStats, setDatabaseStats] = useState<any>(null);
  
  const toast = useToast();

  useEffect(() => {
    loadRepositories();
    loadDatabaseStats();
  }, []);

  const loadRepositories = async () => {
    try {
      setLoading(true);
      
      // Load repositories from ArangoDB
      const repos = await arangoDBService.getRepositories();
      
      // Enhance with ingestion job data
      const enhancedRepos: RepositoryWithIngestion[] = repos.map(repo => {
        // Find active ingestion jobs
        const jobs = ingestionService.getAllJobs();
        const activeJob = jobs.find(job => 
          job.repositoryName.includes(repo.name) && 
          (job.status === 'running' || job.status === 'queued')
        );
        
        return {
          ...repo,
          ingestionJob: activeJob,
          status: activeJob?.status === 'running' ? 'analyzing' : repo.status
        };
      });
      
      setRepositories(enhancedRepos);
    } catch (error: any) {
      console.error('Failed to load repositories:', error);
      toast({
        title: 'Error',
        description: 'Failed to load repositories from database',
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDatabaseStats = async () => {
    try {
      const stats = await arangoDBService.getDatabaseHealth();
      setDatabaseStats(stats);
    } catch (error) {
      console.error('Failed to load database stats:', error);
    }
  };

  const handleGitHubRepoSelect = async (
    githubRepo: GitHubRepository, 
    validation: RepoValidationResult
  ) => {
    setSelectedGitHubRepo(githubRepo);
    
    if (!validation.isValid) {
      toast({
        title: 'Repository Validation Failed',
        description: validation.errors?.join(' ') || 'Repository cannot be ingested',
        status: 'error',
        duration: 8000,
        isClosable: true
      });
      return;
    }

    // Check if repository already exists
    const existingRepo = repositories.find(repo => 
      repo.url === githubRepo.clone_url || repo.name === githubRepo.full_name
    );

    if (existingRepo) {
      toast({
        title: 'Repository Already Exists',
        description: 'This repository has already been added to the platform',
        status: 'warning',
        duration: 5000,
        isClosable: true
      });
      setSelectedRepo(existingRepo);
      setShowAddModal(false);
      return;
    }

    // Validation passed, show confirmation
    toast({
      title: 'Repository Validated',
      description: `${githubRepo.full_name} is ready for ingestion`,
      status: 'success',
      duration: 3000,
      isClosable: true
    });
  };

  const startRepositoryIngestion = async () => {
    if (!selectedGitHubRepo || ingesting) return;

    try {
      setIngesting(true);

      // Start the ingestion process
      const jobId = await ingestionService.startIngestion(selectedGitHubRepo.clone_url, {
        includeTests: true,
        includeDocs: false,
        deepSecurity: true,
        performanceAnalysis: true,
        qualityAnalysis: true,
        generateInsights: true
      });

      setActiveIngestionJob(jobId);
      setShowAddModal(false);
      setShowIngestionModal(true);

      toast({
        title: 'Ingestion Started',
        description: `Analysis of ${selectedGitHubRepo.full_name} has begun`,
        status: 'success',
        duration: 5000,
        isClosable: true
      });

      // Refresh repositories to show the new one
      await loadRepositories();

    } catch (error: any) {
      toast({
        title: 'Ingestion Failed',
        description: error.message || 'Failed to start repository analysis',
        status: 'error',
        duration: 8000,
        isClosable: true
      });
    } finally {
      setIngesting(false);
    }
  };

  const handleIngestionComplete = async (jobId: string) => {
    toast({
      title: '🎉 Analysis Complete!',
      description: 'Repository has been successfully analyzed and is now available in your dashboard',
      status: 'success',
      duration: 8000,
      isClosable: true
    });
    
    setShowIngestionModal(false);
    setActiveIngestionJob(null);
    await loadRepositories();
    await loadDatabaseStats();
  };

  const handleIngestionFailed = async (jobId: string, error: string) => {
    toast({
      title: 'Analysis Failed',
      description: error,
      status: 'error',
      duration: 10000,
      isClosable: true
    });
    
    setShowIngestionModal(false);
    setActiveIngestionJob(null);
    await loadRepositories();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <VStack spacing={4}>
          <Spinner size="xl" />
          <Text>Loading repository data...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box p={6} maxW="1400px" mx="auto">
      <VStack spacing={6} align="stretch">
        {/* Header with Stats */}
        <HStack justify="space-between" align="start">
          <VStack align="start" spacing={1}>
            <Heading size="lg" color="gray.800">Repository Management</Heading>
            <Text color="gray.600">
              Manage repositories, monitor ingestion, and view AI insights
            </Text>
          </VStack>
          
          <HStack spacing={3}>
            <Button 
              leftIcon={<RefreshCw size={16} />} 
              variant="outline"
              onClick={loadRepositories}
              isLoading={loading}
            >
              Refresh
            </Button>
            <Button 
              leftIcon={<Plus size={16} />} 
              colorScheme="blue"
              onClick={() => setShowAddModal(true)}
              size="lg"
            >
              Add Repository
            </Button>
          </HStack>
        </HStack>

        {/* Database Health Stats */}
        {databaseStats && (
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
            <Stat>
              <StatLabel>Database Status</StatLabel>
              <StatNumber color="green.500" fontSize="lg">
                {databaseStats.status === 'healthy' ? 'Healthy' : 'Issues'}
              </StatNumber>
              <StatHelpText>ArangoDB Connection</StatHelpText>
            </Stat>
            <Stat>
              <StatLabel>Collections</StatLabel>
              <StatNumber fontSize="lg">{databaseStats.totalCollections}</StatNumber>
              <StatHelpText>Available Collections</StatHelpText>
            </Stat>
            <Stat>
              <StatLabel>Repositories</StatLabel>
              <StatNumber fontSize="lg">{repositories.length}</StatNumber>
              <StatHelpText>Total Analyzed</StatHelpText>
            </Stat>
            <Stat>
              <StatLabel>Active Jobs</StatLabel>
              <StatNumber fontSize="lg">
                {repositories.filter(r => r.status === 'analyzing').length}
              </StatNumber>
              <StatHelpText>Currently Processing</StatHelpText>
            </Stat>
          </SimpleGrid>
        )}

        {/* Repository Grid */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {repositories.map(repo => (
            <RepositoryCard
              key={repo._id}
              repository={repo}
              onClick={() => setSelectedRepo(repo)}
              onAnalyze={() => {
                toast({
                  title: 'Re-analysis Started',
                  description: `Re-analyzing ${repo.name}`,
                  status: 'info',
                  duration: 3000,
                  isClosable: true
                });
              }}
            />
          ))}
        </SimpleGrid>

        {/* Empty State */}
        {repositories.length === 0 && (
          <Box textAlign="center" py={16}>
            <VStack spacing={6}>
              <Icon as={Database} size={64} color="gray.300" />
              <VStack spacing={2}>
                <Heading size="lg" color="gray.600">No Repositories Yet</Heading>
                <Text color="gray.500" fontSize="lg">
                  Add your first repository to start analyzing your codebase with AI
                </Text>
              </VStack>
              <Button 
                leftIcon={<Plus size={20} />} 
                colorScheme="blue"
                size="lg"
                onClick={() => setShowAddModal(true)}
              >
                Add Your First Repository
              </Button>
            </VStack>
          </Box>
        )}
      </VStack>

      {/* Add Repository Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <VStack align="start" spacing={1}>
              <Text>Add New Repository</Text>
              <Text fontSize="sm" color="gray.600" fontWeight="normal">
                Search GitHub or paste a repository URL to start analysis
              </Text>
            </VStack>
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody pb={6}>
            <VStack spacing={6} align="stretch">
              <GitHubRepoSearch
                onRepoSelect={handleGitHubRepoSelect}
                showValidation={true}
                showPopular={true}
              />

              {selectedGitHubRepo && (
                <Card border="2px solid" borderColor="blue.500" bg="blue.50">
                  <CardHeader>
                    <HStack justify="space-between">
                      <Text fontWeight="bold" color="blue.700">
                        Selected Repository
                      </Text>
                      <Badge colorScheme="blue">Ready for Ingestion</Badge>
                    </HStack>
                  </CardHeader>
                  <CardBody pt={0}>
                    <VStack spacing={4} align="stretch">
                      <HStack spacing={4}>
                        <Avatar 
                          src={selectedGitHubRepo.owner.avatar_url}
                          name={selectedGitHubRepo.owner.login}
                        />
                        <VStack align="start" spacing={1} flex={1}>
                          <Text fontWeight="bold">{selectedGitHubRepo.full_name}</Text>
                          <Text fontSize="sm" color="gray.600">
                            {selectedGitHubRepo.description || 'No description'}
                          </Text>
                        </VStack>
                      </HStack>

                      <Divider />
                      
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">
                          Repository will be analyzed and populated into database collections
                        </Text>
                        <Button
                          leftIcon={<Play size={16} />}
                          colorScheme="blue"
                          onClick={startRepositoryIngestion}
                          isLoading={ingesting}
                          loadingText="Starting Analysis..."
                          size="lg"
                        >
                          Start Analysis
                        </Button>
                      </HStack>
                    </VStack>
                  </CardBody>
                </Card>
              )}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Live Ingestion Modal */}
      <Modal 
        isOpen={showIngestionModal} 
        onClose={() => setShowIngestionModal(false)} 
        size="6xl"
        closeOnOverlayClick={false}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack justify="space-between">
              <Text>Live Repository Analysis</Text>
              <Badge colorScheme="blue" size="lg">Processing</Badge>
            </HStack>
          </ModalHeader>
          
          <ModalBody pb={6}>
            {activeIngestionJob && (
              <LiveIngestionDashboard
                jobId={activeIngestionJob}
                onJobComplete={handleIngestionComplete}
                onJobFailed={handleIngestionFailed}
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}

// Repository Card Component
interface RepositoryCardProps {
  repository: RepositoryWithIngestion;
  onClick: () => void;
  onAnalyze: () => void;
}

function RepositoryCard({ repository, onClick, onAnalyze }: RepositoryCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Icon as={Activity} color="green.500" />;
      case 'analyzing': return <Spinner size="sm" color="blue.500" />;
      case 'error': return <Icon as={Shield} color="red.500" />;
      default: return <Icon as={Database} color="gray.500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'analyzing': return 'blue';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  return (
    <Card
      cursor="pointer"
      onClick={onClick}
      _hover={{ 
        transform: 'translateY(-2px)',
        shadow: 'xl',
        borderColor: 'blue.400'
      }}
      transition="all 0.2s"
      border="1px solid"
      borderColor="gray.200"
    >
      <CardHeader pb={2}>
        <HStack justify="space-between" align="start">
          <VStack align="start" spacing={1} flex={1}>
            <HStack spacing={2}>
              <Text fontWeight="bold" fontSize="lg" noOfLines={1}>
                {repository.name}
              </Text>
              <Badge colorScheme={getStatusColor(repository.status || 'pending')}>
                {repository.status || 'pending'}
              </Badge>
            </HStack>
            <Text fontSize="sm" color="gray.600" noOfLines={2}>
              {repository.description || 'No description available'}
            </Text>
            <HStack spacing={3} fontSize="xs" color="gray.500">
              <HStack spacing={1}>
                <Icon as={GitBranch} size={12} />
                <Text>{repository.language}</Text>
              </HStack>
              {repository.owner && (
                <HStack spacing={1}>
                  <Icon as={Users} size={12} />
                  <Text>{repository.owner}</Text>
                </HStack>
              )}
              {repository.created_at && (
                <HStack spacing={1}>
                  <Icon as={Calendar} size={12} />
                  <Text>{new Date(repository.created_at).toLocaleDateString()}</Text>
                </HStack>
              )}
            </HStack>
          </VStack>
          
          <VStack spacing={2}>
            {getStatusIcon(repository.status || 'pending')}
            {repository.status === 'analyzing' && repository.ingestionJob && (
              <Text fontSize="xs" color="blue.600">
                {Math.round(repository.ingestionJob.overallProgress)}%
              </Text>
            )}
          </VStack>
        </HStack>
      </CardHeader>
      
      <CardBody pt={0}>
        <VStack spacing={3} align="stretch">
          {repository.status === 'analyzing' && repository.ingestionJob && (
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="xs" color="gray.600">
                  Analysis Progress
                </Text>
                <Text fontSize="xs" color="gray.600">
                  Phase {repository.ingestionJob.currentPhase}/{repository.ingestionJob.totalPhases}
                </Text>
              </HStack>
              <Progress 
                value={repository.ingestionJob.overallProgress} 
                colorScheme="blue"
                size="sm"
                hasStripe
                isAnimated
              />
            </Box>
          )}

          <HStack spacing={2} mt={2}>
            <Button
              leftIcon={<Eye size={14} />}
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              flex={1}
            >
              View Details
            </Button>
            {repository.status !== 'analyzing' && (
              <Button
                leftIcon={<BarChart3 size={14} />}
                size="sm"
                colorScheme="blue"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnalyze();
                }}
              >
                Re-analyze
              </Button>
            )}
          </HStack>

          {repository.updated_at && (
            <HStack spacing={1} justify="center" fontSize="xs" color="gray.500">
              <Text>Last updated: {new Date(repository.updated_at).toLocaleDateString()}</Text>
            </HStack>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}