/**
 * Project Management Page
 * Displays the Jira-Kanban board for project management
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Container, VStack, Heading, Text } from '@chakra-ui/react';
import KanbanBoard from '../components/project-management/KanbanBoard';

export default function ProjectManagementPage() {
  const { projectKey } = useParams<{ projectKey?: string }>();
  
  // Default to SCRUM project (where we created the issues)
  const currentProjectKey = projectKey || 'SCRUM';

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="full" p={0}>
        <VStack spacing={0} align="stretch">
          {/* Page Header */}
          <Box bg="white" borderBottom="1px solid" borderColor="gray.200" p={6}>
            <VStack spacing={2} align="start">
              <Heading size="lg" color="gray.800">
                Project Management
              </Heading>
              <Text color="gray.600">
                Manage your development workflow with integrated Jira synchronization
              </Text>
            </VStack>
          </Box>

          {/* Kanban Board */}
          <Box flex={1}>
            <KanbanBoard projectKey={currentProjectKey} />
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}


