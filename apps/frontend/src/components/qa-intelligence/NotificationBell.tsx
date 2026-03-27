/**
 * NotificationBell - Header bell icon with unread count and dropdown
 */

import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
  Button,
  useColorModeValue,
} from '@chakra-ui/react';
import { Bell, Check, AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-react';
import type { NotificationEntry } from '../../hooks/useNotifications';
import { AGENT_LABELS } from '../../hooks/useAgentStream';
import type { AgentName } from '../../services/qaService';

interface NotificationBellProps {
  notifications: NotificationEntry[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
}

const LEVEL_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  critical: { icon: AlertCircle, color: 'red' },
  warning: { icon: AlertTriangle, color: 'orange' },
  info: { icon: Info, color: 'blue' },
  success: { icon: CheckCircle, color: 'green' },
};

export default function NotificationBell({
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
}: NotificationBellProps) {
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  return (
    <Popover placement="bottom-end" isLazy>
      <PopoverTrigger>
        <Box position="relative" display="inline-block">
          <IconButton
            aria-label="Notifications"
            icon={<Bell size={16} />}
            size="sm"
            variant="ghost"
          />
          {unreadCount > 0 && (
            <Badge
              position="absolute"
              top="-2px"
              right="-2px"
              colorScheme="red"
              borderRadius="full"
              fontSize="2xs"
              minW="16px"
              textAlign="center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Box>
      </PopoverTrigger>

      <PopoverContent w="360px" bg={bg} borderColor={borderColor} boxShadow="xl">
        <PopoverHeader borderBottom="1px solid" borderColor={borderColor} px={3} py={2}>
          <HStack justify="space-between">
            <HStack>
              <Bell size={14} />
              <Text fontWeight="bold" fontSize="sm">Notifications</Text>
              {unreadCount > 0 && <Badge colorScheme="red" fontSize="2xs">{unreadCount}</Badge>}
            </HStack>
            {unreadCount > 0 && (
              <Button size="xs" variant="ghost" onClick={onMarkAllRead} fontSize="2xs">
                Mark all read
              </Button>
            )}
          </HStack>
        </PopoverHeader>

        <PopoverBody p={0} maxH="350px" overflowY="auto">
          {notifications.length === 0 ? (
            <Text textAlign="center" py={6} color="gray.500" fontSize="sm">
              No notifications yet
            </Text>
          ) : (
            <VStack spacing={0} align="stretch">
              {notifications.slice(0, 20).map(notif => {
                const config = LEVEL_CONFIG[notif.level] || LEVEL_CONFIG.info;
                const LevelIcon = config.icon;
                return (
                  <Box
                    key={notif.id}
                    px={3} py={2}
                    bg={notif.read ? 'transparent' : useColorModeValue(`${config.color}.50`, `${config.color}.900`)}
                    borderBottom="1px solid"
                    borderColor={borderColor}
                    cursor="pointer"
                    _hover={{ bg: hoverBg }}
                    onClick={() => onMarkRead(notif.id)}
                    transition="all 0.15s"
                  >
                    <HStack spacing={2} align="flex-start">
                      <Box mt={0.5} flexShrink={0}>
                        <LevelIcon size={14} color={`var(--chakra-colors-${config.color}-500)`} />
                      </Box>
                      <Box flex={1} minW={0}>
                        <Text fontSize="xs" fontWeight={notif.read ? 'normal' : 'bold'} noOfLines={1}>
                          {notif.title}
                        </Text>
                        <Text fontSize="2xs" color="gray.500" noOfLines={2}>
                          {notif.message}
                        </Text>
                        <Text fontSize="2xs" color="gray.400" mt={0.5}>
                          {new Date(notif.timestamp).toLocaleTimeString()}
                        </Text>
                      </Box>
                      {!notif.read && (
                        <Box w="6px" h="6px" bg={`${config.color}.400`} borderRadius="full" flexShrink={0} mt={1} />
                      )}
                    </HStack>
                  </Box>
                );
              })}
            </VStack>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
