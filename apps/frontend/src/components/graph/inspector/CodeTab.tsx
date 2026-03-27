import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  Alert,
  AlertIcon,
  Box,
  Badge,
  Select,
  Code,
  Button,
  useToast
} from '@chakra-ui/react';
import { FileText, Download, Copy } from 'lucide-react';
import { fetchNodeDetails, createGraphQueryOptions } from '../../../lib/api/graph';
import { CodeFile } from '../../../types/common';

interface CodeTabProps {
  nodeId: string;
}

export default function CodeTab({ nodeId }: CodeTabProps) {
  const [selectedFile, setSelectedFile] = useState<string>('');
  const toast = useToast();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['node', nodeId],
    queryFn: () => fetchNodeDetails(nodeId),
    enabled: !!nodeId,
    ...createGraphQueryOptions(),
  });

  if (isLoading) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Text>Loading code information...</Text>
      </VStack>
    );
  }

  if (error || !data) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="error">
          <AlertIcon />
          Unable to load code details. Please try again.
        </Alert>
      </VStack>
    );
  }

  // Code files come from the graph node's metadata — no mock data
  const codeFiles: CodeFile[] = data.metadata?.codeFiles || [];
  const currentFile = codeFiles.find(f => f.path === selectedFile) || codeFiles[0] || null;

  const handleCopyCode = () => {
    if (currentFile?.content) {
      navigator.clipboard.writeText(currentFile.content);
      toast({
        title: 'Code copied',
        description: 'Code has been copied to clipboard',
        status: 'success',
        duration: 2000,
        isClosable: true
      });
    }
  };

  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      'typescript': 'blue',
      'javascript': 'yellow',
      'python': 'green',
      'java': 'orange',
      'json': 'purple',
      'yaml': 'teal',
      'dockerfile': 'gray'
    };
    return colors[language.toLowerCase()] || 'gray';
  };

  if (codeFiles.length === 0) {
    return (
      <VStack spacing={6} align="stretch" p={4}>
        <Alert status="info">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">No Code Files Available</Text>
            <Text fontSize="sm">
              Connect your code analysis service or ingest a repository to see
              source code associated with this graph node.
            </Text>
          </Box>
        </Alert>

        {/* Show language metadata if available */}
        {data.metadata?.language && (
          <Card>
            <CardBody>
              <Text fontSize="lg" fontWeight="bold" mb={4}>Node Metadata</Text>
              <HStack>
                <Text fontSize="sm" color="gray.600">Primary Language</Text>
                <Badge colorScheme={getLanguageColor(data.metadata.language)}>
                  {data.metadata.language}
                </Badge>
              </HStack>
            </CardBody>
          </Card>
        )}
      </VStack>
    );
  }

  return (
    <VStack spacing={6} align="stretch" p={4}>
      {/* Code Overview */}
      <Card>
        <CardBody>
          <Text fontSize="lg" fontWeight="bold" mb={4}>Code Overview</Text>

          <HStack justify="space-between" mb={4}>
            <VStack spacing={1} align="start">
              <Text fontSize="sm" color="gray.600">Total Files</Text>
              <Text fontSize="lg" fontWeight="bold">{codeFiles.length}</Text>
            </VStack>

            <VStack spacing={1} align="start">
              <Text fontSize="sm" color="gray.600">Total Lines</Text>
              <Text fontSize="lg" fontWeight="bold">
                {codeFiles.reduce((sum, file) => sum + file.lines, 0)}
              </Text>
            </VStack>

            <VStack spacing={1} align="start">
              <Text fontSize="sm" color="gray.600">Primary Language</Text>
              <Badge colorScheme={getLanguageColor(data.metadata?.language || 'typescript')}>
                {data.metadata?.language || 'TypeScript'}
              </Badge>
            </VStack>
          </HStack>
        </CardBody>
      </Card>

      {/* File Selector */}
      <Card>
        <CardBody>
          <HStack justify="space-between" mb={4}>
            <Text fontSize="lg" fontWeight="bold">Code Files</Text>
            <HStack>
              <Button
                size="sm"
                leftIcon={<Copy size={16} />}
                onClick={handleCopyCode}
                isDisabled={!currentFile}
              >
                Copy
              </Button>
              <Button
                size="sm"
                leftIcon={<Download size={16} />}
                variant="outline"
                isDisabled={!currentFile}
                onClick={() => {
                  if (currentFile) {
                    const blob = new Blob([currentFile.content || ''], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = currentFile.path.split('/').pop() || 'file';
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
              >
                Download
              </Button>
            </HStack>
          </HStack>
          
          <Select
            value={selectedFile || codeFiles[0]?.path}
            onChange={(e) => setSelectedFile(e.target.value)}
            mb={4}
          >
            {codeFiles.map((file) => (
              <option key={file.path} value={file.path}>
                {file.path} ({file.lines} lines)
              </option>
            ))}
          </Select>

          {currentFile && (
            <VStack spacing={3} align="stretch">
              {/* File Info */}
              <HStack justify="space-between" p={3} bg="gray.50" borderRadius="md">
                <HStack>
                  <FileText size={16} />
                  <Text fontSize="sm" fontWeight="medium">{currentFile.path}</Text>
                  <Badge colorScheme={getLanguageColor(currentFile.language)}>
                    {currentFile.language}
                  </Badge>
                </HStack>
                
                <VStack spacing={0} align="end">
                  <Text fontSize="xs" color="gray.600">
                    {currentFile.lines} lines
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    Modified by {currentFile.author}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {new Date(currentFile.lastModified).toLocaleString()}
                  </Text>
                </VStack>
              </HStack>

              {/* Code Content */}
              <Box
                border="1px"
                borderColor="gray.200"
                borderRadius="md"
                maxH="400px"
                overflowY="auto"
              >
                <Code
                  display="block"
                  whiteSpace="pre-wrap"
                  p={4}
                  fontSize="sm"
                  fontFamily="mono"
                  bg="gray.50"
                  w="full"
                >
                  {currentFile.content}
                </Code>
              </Box>
            </VStack>
          )}
        </CardBody>
      </Card>

      {/* File Statistics */}
      <Card>
        <CardBody>
          <Text fontSize="lg" fontWeight="bold" mb={4}>File Statistics</Text>
          
          <VStack spacing={3} align="stretch">
            {codeFiles.map((file, index) => (
              <HStack key={index} justify="space-between" p={2} bg="gray.50" borderRadius="md">
                <HStack>
                  <FileText size={16} />
                  <Text fontSize="sm" fontWeight="medium">{file.path}</Text>
                  <Badge colorScheme={getLanguageColor(file.language)} size="sm">
                    {file.language}
                  </Badge>
                </HStack>
                
                <VStack spacing={0} align="end">
                  <Text fontSize="sm" color="gray.600">{file.lines} lines</Text>
                  <Text fontSize="xs" color="gray.500">
                    {new Date(file.lastModified).toLocaleDateString()}
                  </Text>
                </VStack>
              </HStack>
            ))}
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
}
