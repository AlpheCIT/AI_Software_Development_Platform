import React, { useState, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Input,
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
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  FormControl,
  FormLabel,
  Code,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Tooltip,
  IconButton,
  useToast,
  Flex,
} from '@chakra-ui/react';
import { Search, Copy, ExternalLink, Star, Clock, Info } from 'lucide-react';

interface SemanticSearchResult {
  entity: {
    _key: string;
    name: string;
    entity_type: string;
    file_path: string;
    language: string;
    source_code?: string;
  };
  embedding_data: {
    content: string;
    description: string;
    business_context: string;
    model: string;
  };
  similarity_score: number;
  relationships: any[];
  search_metadata: {
    matched_field: string;
    search_type: string;
  };
}

interface SearchOptions {
  search_type: 'code' | 'description' | 'business' | 'all';
  max_results: number;
  similarity_threshold: number;
  include_relationships: boolean;
}

export default function SemanticSearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({
    search_type: 'all',
    max_results: 20,
    similarity_threshold: 0.6,
    include_relationships: true
  });
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  const toast = useToast();

  const exampleQueries = [
    "Find authentication and login functions",
    "Show me database connection code",
    "Find API endpoints for user management",
    "Look for payment processing logic",
    "Find error handling patterns",
    "Show me data validation functions"
  ];

  const performSearch = useCallback(async () => {
    if (!query.trim()) {
      toast({
        title: "Query Required",
        description: "Please enter a search query",
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
      const response = await fetch(`${apiUrl}/search/semantic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          options
        })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setResults(data.results);
        setSearchHistory(prev => [query, ...prev.slice(0, 9)]);
        
        toast({
          title: "Search Complete",
          description: `Found ${data.results.length} results`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(data.message || 'Search failed');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      toast({
        title: "Search Failed",
        description: errorMessage,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [query, options, toast]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Code copied to clipboard",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  }, [toast]);

  const getEntityTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      'function': 'blue',
      'class': 'green',
      'variable': 'purple',
      'module': 'orange',
      'interface': 'cyan',
      'component': 'pink'
    };
    return colors[type] || 'gray';
  };

  const getLanguageColor = (language: string): string => {
    const colors: Record<string, string> = {
      'javascript': 'yellow',
      'typescript': 'blue',
      'python': 'green',
      'java': 'orange',
      'go': 'cyan',
      'rust': 'red'
    };
    return colors[language] || 'gray';
  };

  return (
    <Box p={6} maxW="1200px" mx="auto">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="lg" mb={2}>🔍 Semantic Code Search</Heading>
          <Text color="gray.600">
            Search your codebase using natural language. Ask questions like "Find authentication functions" or "Show me API endpoints".
          </Text>
        </Box>

        {/* Search Interface */}
        <Card>
          <CardBody>
            <VStack spacing={4}>
              {/* Main Search Input */}
              <HStack width="100%">
                <Input
                  placeholder="Describe what you're looking for... (e.g., 'Find user authentication logic')"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                  size="lg"
                />
                <Button
                  leftIcon={<Search size={20} />}
                  colorScheme="blue"
                  onClick={performSearch}
                  isLoading={loading}
                  loadingText="Searching"
                  size="lg"
                >
                  Search
                </Button>
              </HStack>

              {/* Example Queries */}
              <Box width="100%">
                <Text fontSize="sm" color="gray.600" mb={2}>Try these examples:</Text>
                <Flex wrap="wrap" gap={2}>
                  {exampleQueries.map((example, index) => (
                    <Button
                      key={index}
                      size="xs"
                      variant="outline"
                      onClick={() => setQuery(example)}
                    >
                      {example}
                    </Button>
                  ))}
                </Flex>
              </Box>

              {/* Advanced Options */}
              <Accordion allowToggle width="100%">
                <AccordionItem>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      Advanced Search Options
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel pb={4}>
                    <VStack spacing={4}>
                      <HStack width="100%" spacing={6}>
                        <FormControl>
                          <FormLabel fontSize="sm">Search Type</FormLabel>
                          <Select
                            value={options.search_type}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              search_type: e.target.value as any
                            }))}
                          >
                            <option value="all">All (Code + Descriptions + Business)</option>
                            <option value="code">Code Only</option>
                            <option value="description">Descriptions Only</option>
                            <option value="business">Business Context Only</option>
                          </Select>
                        </FormControl>
                        
                        <FormControl>
                          <FormLabel fontSize="sm">Max Results: {options.max_results}</FormLabel>
                          <Slider
                            value={options.max_results}
                            onChange={(value) => setOptions(prev => ({
                              ...prev,
                              max_results: value
                            }))}
                            min={5}
                            max={100}
                            step={5}
                          >
                            <SliderTrack>
                              <SliderFilledTrack />
                            </SliderTrack>
                            <SliderThumb />
                          </Slider>
                        </FormControl>
                        
                        <FormControl>
                          <FormLabel fontSize="sm">Similarity: {Math.round(options.similarity_threshold * 100)}%</FormLabel>
                          <Slider
                            value={options.similarity_threshold}
                            onChange={(value) => setOptions(prev => ({
                              ...prev,
                              similarity_threshold: value
                            }))}
                            min={0.1}
                            max={1.0}
                            step={0.1}
                          >
                            <SliderTrack>
                              <SliderFilledTrack />
                            </SliderTrack>
                            <SliderThumb />
                          </Slider>
                        </FormControl>
                      </HStack>
                    </VStack>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </VStack>
          </CardBody>
        </Card>

        {/* Search History */}
        {searchHistory.length > 0 && (
          <Card>
            <CardHeader>
              <Heading size="sm">Recent Searches</Heading>
            </CardHeader>
            <CardBody pt={0}>
              <Flex wrap="wrap" gap={2}>
                {searchHistory.map((search, index) => (
                  <Button
                    key={index}
                    size="xs"
                    variant="ghost"
                    leftIcon={<Clock size={14} />}
                    onClick={() => setQuery(search)}
                  >
                    {search}
                  </Button>
                ))}
              </Flex>
            </CardBody>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Alert status="error">
            <AlertIcon />
            <Box>
              <Text fontWeight="bold">Search Error</Text>
              <Text>{error}</Text>
            </Box>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Card>
            <CardBody>
              <VStack spacing={4}>
                <Spinner size="lg" color="blue.500" />
                <Text>Searching through your codebase...</Text>
                <Text fontSize="sm" color="gray.600">
                  Using AI to find the most relevant code matches
                </Text>
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Results */}
        {results.length > 0 && (
          <VStack spacing={4} align="stretch">
            <Box>
              <Heading size="md" mb={2}>
                Search Results ({results.length})
              </Heading>
              <Text color="gray.600">
                Found {results.length} code entities matching your query
              </Text>
            </Box>

            {results.map((result) => (
              <Card key={result.entity._key} variant="outline">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    {/* Entity Header */}
                    <HStack justify="space-between">
                      <HStack spacing={3}>
                        <Heading size="sm">{result.entity.name}</Heading>
                        <Badge colorScheme={getEntityTypeColor(result.entity.entity_type)}>
                          {result.entity.entity_type}
                        </Badge>
                        <Badge colorScheme={getLanguageColor(result.entity.language)}>
                          {result.entity.language}
                        </Badge>
                        <Badge variant="outline">
                          {Math.round(result.similarity_score * 100)}% match
                        </Badge>
                      </HStack>
                      
                      <HStack>
                        <Tooltip label="Copy code">
                          <IconButton
                            aria-label="Copy code"
                            icon={<Copy size={16} />}
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(result.entity.source_code || result.embedding_data.content)}
                          />
                        </Tooltip>
                        <Tooltip label="View details">
                          <IconButton
                            aria-label="View details"
                            icon={<ExternalLink size={16} />}
                            size="sm"
                            variant="ghost"
                          />
                        </Tooltip>
                      </HStack>
                    </HStack>

                    {/* File Path */}
                    <Text fontSize="sm" color="gray.600">
                      📁 {result.entity.file_path}
                    </Text>

                    {/* Description */}
                    {result.embedding_data.description && (
                      <Box>
                        <Text fontSize="sm" fontWeight="semibold" mb={1}>Description:</Text>
                        <Text fontSize="sm" color="gray.700">
                          {result.embedding_data.description}
                        </Text>
                      </Box>
                    )}

                    {/* Business Context */}
                    {result.embedding_data.business_context && (
                      <Box>
                        <Text fontSize="sm" fontWeight="semibold" mb={1}>Business Context:</Text>
                        <Text fontSize="sm" color="blue.700">
                          💼 {result.embedding_data.business_context}
                        </Text>
                      </Box>
                    )}

                    {/* Code Preview */}
                    {result.embedding_data.content && (
                      <Box>
                        <Text fontSize="sm" fontWeight="semibold" mb={2}>Code Preview:</Text>
                        <Code
                          p={3}
                          borderRadius="md"
                          fontSize="xs"
                          overflowX="auto"
                          maxH="200px"
                          overflowY="auto"
                          bg="gray.50"
                          border="1px"
                          borderColor="gray.200"
                          whiteSpace="pre-wrap"
                        >
                          {result.embedding_data.content.slice(0, 500)}
                          {result.embedding_data.content.length > 500 && '...'}
                        </Code>
                      </Box>
                    )}

                    {/* Match Information */}
                    <HStack spacing={4} fontSize="xs" color="gray.600">
                      <Text>
                        📍 Matched in: <strong>{result.search_metadata.matched_field}</strong>
                      </Text>
                      <Text>
                        🎯 Search type: <strong>{result.search_metadata.search_type}</strong>
                      </Text>
                      {result.embedding_data.model && (
                        <Text>
                          🤖 Model: <strong>{result.embedding_data.model}</strong>
                        </Text>
                      )}
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>
            ))}
          </VStack>
        )}

        {/* No Results */}
        {!loading && results.length === 0 && query && (
          <Card>
            <CardBody>
              <VStack spacing={4}>
                <Info size={48} color="gray" />
                <Text textAlign="center" color="gray.600">
                  No results found for "{query}"
                </Text>
                <Text fontSize="sm" textAlign="center" color="gray.500">
                  Try adjusting your search terms or lowering the similarity threshold
                </Text>
              </VStack>
            </CardBody>
          </Card>
        )}
      </VStack>
    </Box>
  );
}
