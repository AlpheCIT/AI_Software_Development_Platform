import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  VStack, 
  Alert, 
  AlertIcon, 
  Badge, 
  HStack, 
  Text, 
  Box,
  Card,
  CardBody,
  Divider,
  Progress,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Button,
  useToast
} from '@chakra-ui/react';
import { fetchNodeDetails, createGraphQueryOptions } from '../../../lib/api/graph';
import { SecurityFinding } from '../../../types/graph';
import { formatDistanceToNow } from 'date-fns';

interface SecurityTabProps {
  nodeId: string;
}

export default function SecurityTab({ nodeId }: SecurityTabProps) {
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
        <Text>Loading security data...</Text>
      </VStack>
    );
  }

  if (error || !data) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="error">
          <AlertIcon />
          Unable to load security details. Please try again.
        </Alert>
      </VStack>
    );
  }

  const securityIssues = data.security || [];

  const handleFixSuggestion = (issue: SecurityFinding) => {
    toast({
      title: 'Fix Suggestion',
      description: issue.fixSuggestion || 'No specific fix suggestion available',
      status: 'info',
      duration: 5000,
      isClosable: true
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'red';
      case 'HIGH': return 'orange';
      case 'MEDIUM': return 'yellow';
      case 'LOW': return 'green';
      default: return 'gray';
    }
  };

  const getSeverityAlertStatus = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'error';
      case 'MEDIUM':
        return 'warning';
      case 'LOW':
        return 'info';
      default:
        return 'info';
    }
  };

  // Count issues by severity
  const issueCounts = securityIssues.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalIssues = securityIssues.length;
  const criticalCount = issueCounts.CRITICAL || 0;
  const highCount = issueCounts.HIGH || 0;

  if (securityIssues.length === 0) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="success" borderRadius="md">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">No Security Issues!</Text>
            <Text fontSize="sm">This component has no known security vulnerabilities.</Text>
          </Box>
        </Alert>
      </VStack>
    );
  }

  return (
    <VStack spacing={4} align="stretch" p={4}>
      {/* Security Overview */}
      <Card>
        <CardBody>
          <Text fontSize="lg" fontWeight="bold" mb={3}>
            Security Overview ({totalIssues} issues)
          </Text>
          
          <SimpleGrid columns={2} spacing={4} mb={4}>
            <Stat>
              <StatLabel>Total Issues</StatLabel>
              <StatNumber color={totalIssues > 0 ? 'red.500' : 'green.500'}>
                {totalIssues}
              </StatNumber>
              <StatHelpText>Security vulnerabilities</StatHelpText>
            </Stat>

            <Stat>
              <StatLabel>High Priority</StatLabel>
              <StatNumber color={criticalCount + highCount > 0 ? 'red.500' : 'green.500'}>
                {criticalCount + highCount}
              </StatNumber>
              <StatHelpText>Critical + High severity</StatHelpText>
            </Stat>
          </SimpleGrid>

          {/* Severity Breakdown */}
          <VStack spacing={3}>
            <Text fontWeight="medium" alignSelf="flex-start">Issues by Severity</Text>
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((severity) => {
              const count = issueCounts[severity] || 0;
              const percentage = totalIssues > 0 ? (count / totalIssues) * 100 : 0;
              
              return (
                <Box key={severity} w="full">
                  <HStack justify="space-between" mb={1}>
                    <HStack>
                      <Badge colorScheme={getSeverityColor(severity)} size="sm">
                        {severity}
                      </Badge>
                      <Text fontSize="sm">{count} issues</Text>
                    </HStack>
                    <Text fontSize="sm" color="gray.600">
                      {percentage.toFixed(0)}%
                    </Text>
                  </HStack>
                  <Progress
                    value={percentage}
                    size="sm"
                    colorScheme={getSeverityColor(severity)}
                  />
                </Box>
              );
            })}
          </VStack>
        </CardBody>
      </Card>

      <Divider />

      {/* Individual Issues */}
      <Box>
        <Text fontSize="lg" fontWeight="bold" mb={3}>Security Issues</Text>
        
        <Accordion allowMultiple>
          {securityIssues.map((issue) => (
            <AccordionItem key={issue.id}>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <HStack>
                    <Badge colorScheme={getSeverityColor(issue.severity)}>
                      {issue.severity}
                    </Badge>
                    <Text fontWeight="medium">{issue.type}</Text>
                  </HStack>
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel pb={4}>
                <VStack spacing={3} align="stretch">
                  <Text>{issue.description}</Text>
                  
                  <HStack spacing={4} fontSize="sm" color="gray.600">
                    <Text>File: {issue.file}</Text>
                    <Text>Line: {issue.line}</Text>
                    {issue.cweId && <Text>CWE: {issue.cweId}</Text>}
                  </HStack>

                  <Text fontSize="sm" color="gray.500">
                    Detected {formatDistanceToNow(new Date(issue.detectedAt))} ago
                  </Text>

                  {issue.fixSuggestion && (
                    <Button
                      size="sm"
                      colorScheme="blue"
                      variant="outline"
                      onClick={() => handleFixSuggestion(issue)}
                    >
                      View Fix Suggestion
                    </Button>
                  )}
                </VStack>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </Box>
    </VStack>
  );
}
