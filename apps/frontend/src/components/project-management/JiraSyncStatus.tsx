/**
 * Jira Sync Status Component
 * Shows the current synchronization status with Jira
 */

import React from 'react';
import { 
  HStack, 
  Icon, 
  Text, 
  Tooltip, 
  Badge,
  Spinner,
  Box,
  VStack
} from '@chakra-ui/react';
import { CheckIcon, WarningIcon, CloseIcon } from '@chakra-ui/icons';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'conflict' | 'offline';

interface JiraSyncStatusProps {
  isConnected: boolean;
  syncStatus: SyncStatus;
  lastSyncTime?: Date;
  pendingChanges?: number;
}

export function JiraSyncStatus({ 
  isConnected, 
  syncStatus, 
  lastSyncTime,
  pendingChanges = 0 
}: JiraSyncStatusProps) {
  
  const getStatusDisplay = () => {
    if (!isConnected) {
      return {
        icon: CloseIcon,
        color: 'red.500',
        text: 'Disconnected',
        bgColor: 'red.50',
        borderColor: 'red.200',
        description: 'Unable to connect to Jira. Working in offline mode.'
      };
    }

    switch (syncStatus) {
      case 'syncing':
        return {
          icon: Spinner,
          color: 'blue.500',
          text: 'Syncing...',
          bgColor: 'blue.50',
          borderColor: 'blue.200',
          description: 'Synchronizing changes with Jira'
        };
      case 'error':
        return {
          icon: WarningIcon,
          color: 'orange.500',
          text: 'Sync Error',
          bgColor: 'orange.50',
          borderColor: 'orange.200',
          description: 'Failed to sync with Jira. Please try again.'
        };
      case 'conflict':
        return {
          icon: WarningIcon,
          color: 'purple.500',
          text: 'Conflict',
          bgColor: 'purple.50',
          borderColor: 'purple.200',
          description: 'Conflicting changes detected. Manual resolution required.'
        };
      case 'offline':
        return {
          icon: CloseIcon,
          color: 'gray.500',
          text: 'Offline',
          bgColor: 'gray.50',
          borderColor: 'gray.200',
          description: 'Working offline. Changes will sync when connection is restored.'
        };
      default:
        return {
          icon: CheckIcon,
          color: 'green.500',
          text: 'Synced',
          bgColor: 'green.50',
          borderColor: 'green.200',
          description: 'All changes synchronized with Jira'
        };
    }
  };

  const formatLastSync = (date?: Date): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return date.toLocaleDateString();
  };

  const status = getStatusDisplay();

  const tooltipContent = (
    <VStack spacing={1} align="start" maxW="200px">
      <Text fontSize="sm" fontWeight="medium">
        {status.text}
      </Text>
      <Text fontSize="xs" color="gray.300">
        {status.description}
      </Text>
      {lastSyncTime && (
        <Text fontSize="xs" color="gray.400">
          Last sync: {formatLastSync(lastSyncTime)}
        </Text>
      )}
      {pendingChanges > 0 && (
        <Text fontSize="xs" color="yellow.300">
          {pendingChanges} pending change{pendingChanges !== 1 ? 's' : ''}
        </Text>
      )}
    </VStack>
  );

  return (
    <Tooltip label={tooltipContent} placement="bottom-start">
      <Box cursor="pointer">
        <Badge
          bg={status.bgColor}
          color={status.color}
          border="1px solid"
          borderColor={status.borderColor}
          px={3}
          py={1}
          borderRadius="full"
          fontSize="xs"
          fontWeight="medium"
          transition="all 0.2s"
          _hover={{
            transform: 'scale(1.05)',
            shadow: 'sm'
          }}
        >
          <HStack spacing={2}>
            {syncStatus === 'syncing' ? (
              <Spinner size="xs" />
            ) : (
              <Icon as={status.icon} boxSize={3} />
            )}
            <Text>{status.text}</Text>
            {pendingChanges > 0 && (
              <Badge
                bg="yellow.100"
                color="yellow.800"
                borderRadius="full"
                px={1}
                fontSize="10px"
                minW="16px"
                textAlign="center"
              >
                {pendingChanges}
              </Badge>
            )}
          </HStack>
        </Badge>
      </Box>
    </Tooltip>
  );
}

export default JiraSyncStatus;
