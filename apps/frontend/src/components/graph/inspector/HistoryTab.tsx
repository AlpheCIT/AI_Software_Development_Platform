import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  VStack, 
  Text, 
  HStack, 
  Badge,
  Alert,
  AlertIcon,
  Card,
  CardBody,
  Box,
  List,
  ListItem,
  ListIcon,
  Divider
} from '@chakra-ui/react';
import { GitCommit, GitBranch, Clock, User, FileText } from 'lucide-react';
import { fetchNodeDetails, createGraphQueryOptions } from '../../../lib/api/graph';
import { Activity } from '../../../types/common';

interface HistoryTabProps {
  nodeId: string;
}

export default function HistoryTab({ nodeId }: HistoryTabProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['node', nodeId],
    queryFn: () => fetchNodeDetails(nodeId),
    enabled: !!nodeId,
    ...createGraphQueryOptions(),
  });

  if (isLoading) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Text>Loading history information...</Text>
      </VStack>
    );
  }

  if (error || !data) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="error">
          <AlertIcon />
          Unable to load history details. Please try again.
        </Alert>
      </VStack>
    );
  }

  // Mock recent activity if not available - this would come from the API
  const recentActivity: Activity[] = data.recentActivity || [
    {
      type: 'commit',
      author: 'john.doe',
      message: 'Fix user validation bug',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 minutes ago
    },
    {
      type: 'deployment',
      author: 'system',
      message: 'Deployed to production',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      environment: 'production',
      status: 'success'
    },
    {
      type: 'security_scan',
      author: 'security-bot',
      message: 'Security scan completed',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
      status: 'success'
    }
  ];

  const lastUpdated = data.metadata?.lastUpdated;

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'commit': return GitCommit;
      case 'deployment': return GitBranch;
      case 'security_scan': return FileText;
      case 'performance_test': return Clock;
      case 'code_review': return User;
      default: return Clock;
    }
  };

  const getActivityColor = (type: Activity['type'], status?: string) => {
    switch (type) {
      case 'commit': return 'blue.500';
      case 'deployment':
        return status === 'success' ? 'green.500' : status === 'failure' ? 'red.500' : 'yellow.500';
      case 'security_scan': return 'orange.500';
      case 'performance_test': return 'purple.500';
      case 'code_review': return 'teal.500';
      default: return 'gray.500';
    }
  };

  const getActivityBgColor = (type: Activity['type'], status?: string) => {
    switch (type) {
      case 'commit': return 'blue.50';
      case 'deployment':
        return status === 'success' ? 'green.50' : status === 'failure' ? 'red.50' : 'yellow.50';
      case 'security_scan': return 'orange.50';
      case 'performance_test': return 'purple.50';
      case 'code_review': return 'teal.50';
      default: return 'gray.50';
    }
  };

  return (
    <VStack align="stretch" spacing={4} p={4}>
      {/* Summary */}
      <Card size="sm">
        <CardBody>
          <Text fontWeight="medium" mb={3}>Change Summary</Text>
          
          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between">
              <Text fontSize="sm">Last Updated</Text>
              <Text fontSize="sm" color="gray.600">
                {lastUpdated 
                  ? new Date(lastUpdated).toLocaleString()
                  : 'Unknown'
                }
              </Text>
            </HStack>
            
            <HStack justify="space-between">
              <Text fontSize="sm">Recent Activities</Text>
              <Badge>{recentActivity.length}</Badge>
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      <Divider />

      {/* Recent Activity Timeline */}
      <Box>
        <Text fontWeight="medium" mb={3}>Recent Activity</Text>
        
        {recentActivity.length === 0 ? (
          <Alert status="info">
            <AlertIcon />
            No recent activity recorded for this component.
          </Alert>
        ) : (
          <List spacing={3} maxH="400px" overflowY="auto">
            {recentActivity.map((activity, index) => {
              const IconComponent = getActivityIcon(activity.type);
              const color = getActivityColor(activity.type, activity.status);
              const bgColor = getActivityBgColor(activity.type, activity.status);

              return (
                <ListItem key={index}>
                  <Card size="sm" bg={bgColor}>
                    <CardBody py={3}>
                      <HStack spacing={3} align="start">
                        <ListIcon as={IconComponent} color={color} boxSize={5} mt={1} />
                        
                        <Box flex="1">
                          <HStack justify="space-between" mb={1}>
                            <Text fontSize="sm" fontWeight="medium" textTransform="capitalize">
                              {activity.type.replace('_', ' ')}
                            </Text>
                            <Text fontSize="xs" color="gray.600">
                              {new Date(activity.timestamp).toLocaleString()}
                            </Text>
                          </HStack>
                          
                          {activity.message && (
                            <Text fontSize="sm" color="gray.700" mb={2}>
                              {activity.message}
                            </Text>
                          )}
                          
                          <HStack spacing={3} fontSize="xs" color="gray.600">
                            <HStack spacing={1}>
                              <User size={12} />
                              <Text>{activity.author}</Text>
                            </HStack>
                            
                            {activity.environment && (
                              <Text>Environment: {activity.environment}</Text>
                            )}
                          </HStack>

                          {activity.status && (
                            <Badge 
                              size="sm" 
                              colorScheme={activity.status === 'success' ? 'green' : activity.status === 'failure' ? 'red' : 'yellow'}
                              mt={2}
                            >
                              {activity.status}
                            </Badge>
                          )}
                        </Box>
                      </HStack>
                    </CardBody>
                  </Card>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      {/* Change Statistics */}
      {recentActivity.length > 0 && (
        <>
          <Divider />
          <Card size="sm">
            <CardBody>
              <Text fontWeight="medium" mb={3}>Change Statistics (Last 30 Days)</Text>
              
              <VStack align="stretch" spacing={2}>
                <HStack justify="space-between">
                  <Text fontSize="sm">Total Changes</Text>
                  <Badge>{recentActivity.length}</Badge>
                </HStack>
                
                <HStack justify="space-between">
                  <Text fontSize="sm">Commits</Text>
                  <Badge variant="outline">
                    {recentActivity.filter(a => a.type === 'commit').length}
                  </Badge>
                </HStack>
                
                <HStack justify="space-between">
                  <Text fontSize="sm">Deployments</Text>
                  <Badge variant="outline">
                    {recentActivity.filter(a => a.type === 'deployment').length}
                  </Badge>
                </HStack>
                
                <HStack justify="space-between">
                  <Text fontSize="sm">Security Scans</Text>
                  <Badge variant="outline">
                    {recentActivity.filter(a => a.type === 'security_scan').length}
                  </Badge>
                </HStack>
              </VStack>
            </CardBody>
          </Card>
        </>
      )}

      {/* Contributors */}
      {recentActivity.length > 0 && (
        <>
          <Divider />
          <Box>
            <Text fontWeight="medium" mb={3}>Recent Contributors</Text>
            
            {(() => {
              const contributors = [...new Set(
                recentActivity
                  .filter(a => a.author)
                  .map(a => a.author)
              )];
              
              return contributors.length === 0 ? (
                <Text fontSize="sm" color="gray.600">
                  No contributor information available.
                </Text>
              ) : (
                <VStack spacing={2} align="stretch">
                  {contributors.slice(0, 5).map((contributor, index) => {
                    const contributorActivities = recentActivity.filter(a => a.author === contributor);
                    
                    return (
                      <Card key={index} size="sm">
                        <CardBody py={2}>
                          <HStack justify="space-between">
                            <HStack>
                              <User size={16} />
                              <Text fontSize="sm" fontWeight="medium">{contributor}</Text>
                            </HStack>
                            <Badge size="sm" variant="outline">
                              {contributorActivities.length} changes
                            </Badge>
                          </HStack>
                        </CardBody>
                      </Card>
                    );
                  })}
                  
                  {contributors.length > 5 && (
                    <Text fontSize="xs" color="gray.500" textAlign="center">
                      +{contributors.length - 5} more contributors
                    </Text>
                  )}
                </VStack>
              );
            })()}
          </Box>
        </>
      )}
    </VStack>
  );
}
