import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  Badge,
  Avatar,
  Box,
  Alert,
  AlertIcon,
  Divider,
  Button,
  useToast,
  SimpleGrid
} from '@chakra-ui/react';
import { Mail, MessageSquare, Users, Clock } from 'lucide-react';
import { fetchNodeDetails, createGraphQueryOptions } from '../../../lib/api/graph';
import { Ownership } from '../../../types/graph';

interface OwnershipTabProps {
  nodeId: string;
}

export default function OwnershipTab({ nodeId }: OwnershipTabProps) {
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
        <Text>Loading ownership information...</Text>
      </VStack>
    );
  }

  if (error || !data) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="error">
          <AlertIcon />
          Unable to load ownership details. Please try again.
        </Alert>
      </VStack>
    );
  }

  const ownership = data.ownership;

  if (!ownership) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="warning">
          <AlertIcon />
          No ownership information available for this component.
        </Alert>
      </VStack>
    );
  }

  const handleContactOwner = () => {
    const subject = `Question about ${data.name || nodeId}`;
    const body = `Hi ${ownership.owner},\n\nI have a question about the ${data.name || nodeId} component.\n\nThanks!`;
    window.open(`mailto:${ownership.contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleSlackContact = () => {
    if (ownership.slackChannel) {
      toast({
        title: 'Slack Channel',
        description: `Join ${ownership.slackChannel} to contact the team`,
        status: 'info',
        duration: 3000,
        isClosable: true
      });
    }
  };

  return (
    <VStack spacing={6} align="stretch" p={4}>
      {/* Primary Owner */}
      <Card>
        <CardBody>
          <Text fontSize="lg" fontWeight="bold" mb={4}>Primary Owner</Text>
          
          <HStack spacing={4}>
            <Avatar name={ownership.owner} size="lg" />
            <Box flex="1">
              <Text fontSize="lg" fontWeight="semibold">{ownership.owner}</Text>
              <Text color="gray.600" mb={2}>{ownership.contact}</Text>
              <Badge colorScheme="blue" mr={2}>{ownership.team}</Badge>
              
              <HStack mt={3} spacing={2}>
                <Button
                  size="sm"
                  leftIcon={<Mail size={16} />}
                  colorScheme="blue"
                  onClick={handleContactOwner}
                >
                  Contact Owner
                </Button>
                
                {ownership.slackChannel && (
                  <Button
                    size="sm"
                    leftIcon={<MessageSquare size={16} />}
                    variant="outline"
                    onClick={handleSlackContact}
                  >
                    Slack
                  </Button>
                )}
              </HStack>
            </Box>
          </HStack>
        </CardBody>
      </Card>

      {/* Team Information */}
      <Card>
        <CardBody>
          <Text fontSize="lg" fontWeight="bold" mb={4}>Team Information</Text>
          
          <SimpleGrid columns={2} spacing={4}>
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="gray.600">Team</Text>
              <Text fontSize="lg">{ownership.team}</Text>
            </Box>
            
            {ownership.slackChannel && (
              <Box>
                <Text fontSize="sm" fontWeight="medium" color="gray.600">Slack Channel</Text>
                <Text fontSize="lg">{ownership.slackChannel}</Text>
              </Box>
            )}
            
            {ownership.oncallRotation && (
              <Box>
                <Text fontSize="sm" fontWeight="medium" color="gray.600">On-Call Rotation</Text>
                <Text fontSize="lg">{ownership.oncallRotation}</Text>
              </Box>
            )}
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* Maintainers */}
      {ownership.maintainers && ownership.maintainers.length > 0 && (
        <Card>
          <CardBody>
            <Text fontSize="lg" fontWeight="bold" mb={4}>
              Maintainers ({ownership.maintainers.length})
            </Text>
            
            <VStack spacing={3} align="stretch">
              {ownership.maintainers.map((maintainer, index) => (
                <HStack key={index} spacing={3}>
                  <Avatar name={maintainer} size="sm" />
                  <Box flex="1">
                    <Text fontWeight="medium">{maintainer}</Text>
                    <Text fontSize="sm" color="gray.600">Maintainer</Text>
                  </Box>
                  <Button
                    size="xs"
                    variant="outline"
                    leftIcon={<Mail size={12} />}
                    onClick={() => window.open(`mailto:${maintainer}`)}
                  >
                    Contact
                  </Button>
                </HStack>
              ))}
            </VStack>
          </CardBody>
        </Card>
      )}

      <Divider />

      {/* Responsibilities */}
      <Card>
        <CardBody>
          <Text fontSize="lg" fontWeight="bold" mb={4}>Responsibilities</Text>
          
          <VStack spacing={3} align="stretch">
            <HStack>
              <Users size={20} color="green" />
              <Box>
                <Text fontWeight="medium">Code Maintenance</Text>
                <Text fontSize="sm" color="gray.600">
                  Responsible for code quality, bug fixes, and feature development
                </Text>
              </Box>
            </HStack>
            
            <HStack>
              <Clock size={20} color="blue" />
              <Box>
                <Text fontWeight="medium">Incident Response</Text>
                <Text fontSize="sm" color="gray.600">
                  Primary contact for production issues and outages
                </Text>
              </Box>
            </HStack>
            
            <HStack>
              <MessageSquare size={20} color="purple" />
              <Box>
                <Text fontWeight="medium">Documentation</Text>
                <Text fontSize="sm" color="gray.600">
                  Maintaining technical documentation and architectural decisions
                </Text>
              </Box>
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Contact Guidelines */}
      <Card bg="gray.50">
        <CardBody>
          <Text fontSize="md" fontWeight="bold" mb={3}>Contact Guidelines</Text>
          
          <VStack spacing={2} align="stretch" fontSize="sm">
            <Text>• For urgent production issues, contact the on-call rotation</Text>
            <Text>• For feature requests, create a ticket and assign to the team</Text>
            <Text>• For questions, reach out via Slack or email</Text>
            <Text>• For code reviews, tag the maintainers in your PR</Text>
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
}
