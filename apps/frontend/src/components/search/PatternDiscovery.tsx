import React, { useState, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Button,
  Text,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Spinner,
  Alert,
  AlertIcon,
  Select,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Progress,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatGroup,
  Divider,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  useToast,
  SimpleGrid,
  Center,
  Tag,
  TagLabel,
  Wrap,
  WrapItem
} from '@chakra-ui/react';
import { Eye, Info, TrendingUp, AlertTriangle } from 'lucide-react';

interface BusinessPattern {
  anchor_entity: {
    _key: string;
    name: string;
    entity_type: string;
    file_path: string;
    language: string;
  };
  patterns: Array<{
    business_purpose: string;
    entity_count: number;
    avg_similarity: number;
  }>;
  cluster_size: number;
}

interface TechnicalPattern {
  anchor_entity: {
    _key: string;
    name: string;
    entity_type: string;
    file_path: string;
    language: string;
  };
  patterns: Array<{
    entity_type: string;
    language: string;
    entity_count: number;
    avg_similarity: number;
  }>;
  cluster_size: number;
}

interface PatternDiscoveryResult {
  business_clusters: BusinessPattern[];
  technical_clusters: TechnicalPattern[];
  cross_domain_patterns: any[];
  outliers: any[];
}

interface DiscoveryOptions {
  clustering_threshold: number;
  min_cluster_size: number;
  business_domain?: string;
}

export default function PatternDiscovery() {
  const [repositoryId, setRepositoryId] = useState('default_repo');
  const [patterns, setPatterns] = useState<PatternDiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<DiscoveryOptions>({
    clustering_threshold: 0.75,
    min_cluster_size: 3,
    business_domain: undefined
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<'business' | 'technical' | 'cross-domain'>('business');
  
  const toast = useToast();

  const discoverPatterns = useCallback(async () => {
    if (!repositoryId.trim()) {
      toast({
        title: "Repository Required",
        description: "Please enter a repository ID",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = import.meta.env.VITE_VECTOR_API_URL || 'http://localhost:8005';
      const response = await fetch(`${apiUrl}/discovery/patterns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository_id: repositoryId,
          options
        })
      });

      if (!response.ok) {
        throw new Error(`Pattern discovery failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setPatterns(data.patterns);
        
        toast({
          title: "Pattern Discovery Complete",
          description: `Found ${data.patterns.business_clusters.length} business patterns and ${data.patterns.technical_clusters.length} technical patterns`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      } else {
        throw new Error(data.message || 'Pattern discovery failed');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      toast({
        title: "Discovery Failed",
        description: errorMessage,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [repositoryId, options, toast]);

  const getBusinessContextColor = (context: string): string => {
    const colors: Record<string, string> = {
      'Authentication & Security': 'red',
      'Financial Operations': 'green',
      'User Management': 'blue',
      'Data Management': 'purple',
      'API Services': 'orange',
      'Communication': 'cyan',
      'Business Intelligence': 'pink',
      'General Business Logic': 'gray'
    };
    return colors[context] || 'gray';
  };

  const getEntityTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      'function': '⚡',
      'class': '🏗️',
      'variable': '📦',
      'module': '📁',
      'interface': '🔗',
      'component': '🧩'
    };
    return icons[type] || '📄';
  };

  const renderBusinessPatterns = () => {
    if (!patterns?.business_clusters.length) {
      return (
        <Center p={8}>
          <VStack>
            <Info size={32} color="gray" />
            <Text color="gray.600">No business patterns discovered</Text>
          </VStack>
        </Center>
      );
    }

    return (
      <VStack spacing={4} align="stretch">
        {patterns.business_clusters.map((cluster, index) => (
          <Card key={index} variant="outline" _hover={{ shadow: 'md' }}>
            <CardHeader>
              <HStack justify="space-between">
                <HStack>
                  <Text fontSize="lg">
                    {getEntityTypeIcon(cluster.anchor_entity.entity_type)}
                  </Text>
                  <Heading size="sm">{cluster.anchor_entity.name}</Heading>
                  <Badge colorScheme="blue">{cluster.cluster_size} entities</Badge>
                </HStack>
                <Text fontSize="sm" color="gray.600">
                  📁 {cluster.anchor_entity.file_path}
                </Text>
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              <VStack align="stretch" spacing={3}>
                <Text fontSize="sm" color="gray.700">
                  <strong>Language:</strong> {cluster.anchor_entity.language} | 
                  <strong> Type:</strong> {cluster.anchor_entity.entity_type}
                </Text>
                
                <Divider />
                
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>Business Patterns:</Text>
                  <Wrap>
                    {cluster.patterns.map((pattern, patternIndex) => (
                      <WrapItem key={patternIndex}>
                        <Tag
                          size="md"
                          colorScheme={getBusinessContextColor(pattern.business_purpose)}
                          borderRadius="full"
                        >
                          <TagLabel>
                            {pattern.business_purpose} ({pattern.entity_count})
                          </TagLabel>
                        </Tag>
                      </WrapItem>
                    ))}
                  </Wrap>
                </Box>

                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>Similarity Metrics:</Text>
                  {cluster.patterns.map((pattern, patternIndex) => (
                    <HStack key={patternIndex} justify="space-between">
                      <Text fontSize="xs">{pattern.business_purpose}</Text>
                      <HStack>
                        <Progress
                          value={pattern.avg_similarity * 100}
                          size="sm"
                          colorScheme="green"
                          width="100px"
                        />
                        <Text fontSize="xs" minW="40px">
                          {Math.round(pattern.avg_similarity * 100)}%
                        </Text>
                      </HStack>
                    </HStack>
                  ))}
                </Box>
              </VStack>
            </CardBody>
          </Card>
        ))}
      </VStack>
    );
  };

  const renderTechnicalPatterns = () => {
    if (!patterns?.technical_clusters.length) {
      return (
        <Center p={8}>
          <VStack>
            <Info size={32} color="gray" />
            <Text color="gray.600">No technical patterns discovered</Text>
          </VStack>
        </Center>
      );
    }

    return (
      <VStack spacing={4} align="stretch">
        {patterns.technical_clusters.map((cluster, index) => (
          <Card key={index} variant="outline" _hover={{ shadow: 'md' }}>
            <CardHeader>
              <HStack justify="space-between">
                <HStack>
                  <Text fontSize="lg">
                    {getEntityTypeIcon(cluster.anchor_entity.entity_type)}
                  </Text>
                  <Heading size="sm">{cluster.anchor_entity.name}</Heading>
                  <Badge colorScheme="purple">{cluster.cluster_size} entities</Badge>
                </HStack>
                <Text fontSize="sm" color="gray.600">
                  📁 {cluster.anchor_entity.file_path}
                </Text>
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              <VStack align="stretch" spacing={3}>
                <Grid templateColumns="repeat(3, 1fr)" gap={4}>
                  <GridItem>
                    <Stat size="sm">
                      <StatLabel>Primary Language</StatLabel>
                      <StatNumber fontSize="md">{cluster.anchor_entity.language}</StatNumber>
                    </Stat>
                  </GridItem>
                  <GridItem>
                    <Stat size="sm">
                      <StatLabel>Entity Type</StatLabel>
                      <StatNumber fontSize="md">{cluster.anchor_entity.entity_type}</StatNumber>
                    </Stat>
                  </GridItem>
                  <GridItem>
                    <Stat size="sm">
                      <StatLabel>Cluster Size</StatLabel>
                      <StatNumber fontSize="md">{cluster.cluster_size}</StatNumber>
                    </Stat>
                  </GridItem>
                </Grid>
                
                <Divider />
                
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>Technical Distribution:</Text>
                  {cluster.patterns.map((pattern, patternIndex) => (
                    <HStack key={patternIndex} justify="space-between" mb={1}>
                      <HStack>
                        <Badge size="sm" colorScheme="blue">{pattern.language}</Badge>
                        <Badge size="sm" colorScheme="green">{pattern.entity_type}</Badge>
                        <Text fontSize="xs">({pattern.entity_count} entities)</Text>
                      </HStack>
                      <HStack>
                        <Progress
                          value={pattern.avg_similarity * 100}
                          size="sm"
                          colorScheme="purple"
                          width="80px"
                        />
                        <Text fontSize="xs" minW="40px">
                          {Math.round(pattern.avg_similarity * 100)}%
                        </Text>
                      </HStack>
                    </HStack>
                  ))}
                </Box>
              </VStack>
            </CardBody>
          </Card>
        ))}
      </VStack>
    );
  };

  const renderCrossDomainPatterns = () => {
    return (
      <Center p={8}>
        <VStack>
          <Info size={32} color="gray" />
          <Text color="gray.600">Cross-domain pattern analysis coming soon</Text>
          <Text fontSize="sm" color="gray.500">
            This will show relationships between business and technical patterns
          </Text>
        </VStack>
      </Center>
    );
  };

  return (
    <Box p={6} maxW="1200px" mx="auto">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="lg" mb={2}>📊 Pattern Discovery</Heading>
          <Text color="gray.600">
            Discover hidden patterns in your codebase using AI-powered clustering and similarity analysis.
          </Text>
        </Box>

        {/* Discovery Interface */}
        <Card>
          <CardBody>
            <VStack spacing={4}>
              {/* Repository Selection */}
              <HStack width="100%">
                <FormControl>
                  <FormLabel>Repository ID</FormLabel>
                  <Select
                    value={repositoryId}
                    onChange={(e) => setRepositoryId(e.target.value)}
                  >
                    <option value="default_repo">Default Repository</option>
                    <option value="main_repo">Main Repository</option>
                    <option value="feature_repo">Feature Repository</option>
                  </Select>
                </FormControl>
                
                <Button
                  leftIcon={<Eye size={20} />}
                  colorScheme="purple"
                  onClick={discoverPatterns}
                  isLoading={loading}
                  loadingText="Discovering"
                >
                  Discover Patterns
                </Button>
              </HStack>

              {/* Advanced Options */}
              <Accordion allowToggle width="100%">
                <AccordionItem>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      Advanced Discovery Options
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel pb={4}>
                    <SimpleGrid columns={3} spacing={4}>
                      <FormControl>
                        <FormLabel fontSize="sm">Clustering Threshold: {Math.round(options.clustering_threshold * 100)}%</FormLabel>
                        <input
                          type="range"
                          min="0.5"
                          max="0.9"
                          step="0.05"
                          value={options.clustering_threshold}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            clustering_threshold: parseFloat(e.target.value)
                          }))}
                          style={{ width: '100%' }}
                        />
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel fontSize="sm">Min Cluster Size: {options.min_cluster_size}</FormLabel>
                        <input
                          type="range"
                          min="2"
                          max="10"
                          step="1"
                          value={options.min_cluster_size}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            min_cluster_size: parseInt(e.target.value)
                          }))}
                          style={{ width: '100%' }}
                        />
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel fontSize="sm">Business Domain</FormLabel>
                        <Select
                          value={options.business_domain || ''}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            business_domain: e.target.value || undefined
                          }))}
                        >
                          <option value="">All Domains</option>
                          <option value="authentication">Authentication</option>
                          <option value="payment">Payment</option>
                          <option value="user">User Management</option>
                          <option value="data">Data Management</option>
                        </Select>
                      </FormControl>
                    </SimpleGrid>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </VStack>
          </CardBody>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert status="error">
            <AlertIcon />
            <Text>{error}</Text>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Card>
            <CardBody>
              <VStack spacing={4}>
                <Spinner size="lg" color="purple.500" />
                <Text>Discovering patterns in your codebase...</Text>
                <Text fontSize="sm" color="gray.600">
                  Analyzing code similarity and clustering entities
                </Text>
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Pattern Results */}
        {patterns && (
          <VStack spacing={6} align="stretch">
            {/* Statistics Overview */}
            <Card>
              <CardHeader>
                <Heading size="md">Discovery Summary</Heading>
              </CardHeader>
              <CardBody>
                <StatGroup>
                  <Stat>
                    <StatLabel>Business Patterns</StatLabel>
                    <StatNumber>{patterns.business_clusters.length}</StatNumber>
                    <StatHelpText>
                      <TrendingUp size={14} />
                      Pattern clusters found
                    </StatHelpText>
                  </Stat>
                  
                  <Stat>
                    <StatLabel>Technical Patterns</StatLabel>
                    <StatNumber>{patterns.technical_clusters.length}</StatNumber>
                    <StatHelpText>
                      <TrendingUp size={14} />
                      Code structure patterns
                    </StatHelpText>
                  </Stat>
                  
                  <Stat>
                    <StatLabel>Total Entities</StatLabel>
                    <StatNumber>
                      {patterns.business_clusters.reduce((sum, cluster) => sum + cluster.cluster_size, 0)}
                    </StatNumber>
                    <StatHelpText>
                      Entities in clusters
                    </StatHelpText>
                  </Stat>
                  
                  <Stat>
                    <StatLabel>Outliers</StatLabel>
                    <StatNumber>{patterns.outliers.length}</StatNumber>
                    <StatHelpText>
                      <AlertTriangle size={14} />
                      Unique entities
                    </StatHelpText>
                  </Stat>
                </StatGroup>
              </CardBody>
            </Card>

            {/* Pattern View Selector */}
            <Card>
              <CardBody>
                <HStack spacing={4}>
                  <Text fontWeight="semibold">View:</Text>
                  <Button
                    size="sm"
                    variant={selectedView === 'business' ? 'solid' : 'outline'}
                    colorScheme="blue"
                    onClick={() => setSelectedView('business')}
                  >
                    💼 Business Patterns ({patterns.business_clusters.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedView === 'technical' ? 'solid' : 'outline'}
                    colorScheme="purple"
                    onClick={() => setSelectedView('technical')}
                  >
                    ⚙️ Technical Patterns ({patterns.technical_clusters.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedView === 'cross-domain' ? 'solid' : 'outline'}
                    colorScheme="green"
                    onClick={() => setSelectedView('cross-domain')}
                  >
                    🔗 Cross-Domain ({patterns.cross_domain_patterns.length})
                  </Button>
                </HStack>
              </CardBody>
            </Card>

            {/* Pattern Display */}
            <Box>
              {selectedView === 'business' && renderBusinessPatterns()}
              {selectedView === 'technical' && renderTechnicalPatterns()}
              {selectedView === 'cross-domain' && renderCrossDomainPatterns()}
            </Box>
          </VStack>
        )}

        {/* No Results */}
        {!loading && !patterns && !error && (
          <Card>
            <CardBody>
              <VStack spacing={4}>
                <Info size={48} color="gray" />
                <Text textAlign="center" color="gray.600">
                  Click "Discover Patterns" to analyze your codebase
                </Text>
                <Text fontSize="sm" textAlign="center" color="gray.500">
                  We'll use AI to find hidden patterns and relationships in your code
                </Text>
              </VStack>
            </CardBody>
          </Card>
        )}
      </VStack>
    </Box>
  );
}
