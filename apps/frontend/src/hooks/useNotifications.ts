/**
 * useNotifications - Hook for real-time alerts from agent findings
 * Triggers toast notifications and desktop notifications for critical findings
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@chakra-ui/react';
import type { AgentName } from '../services/qaService';
import { AGENT_LABELS, type TimelineEntry } from './useAgentStream';

export interface NotificationEntry {
  id: string;
  agent: string;
  level: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface NotificationSettings {
  toasts: boolean;
  desktop: boolean;
  sounds: boolean;
}

export interface UseNotificationsReturn {
  notifications: NotificationEntry[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  settings: NotificationSettings;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
}

export function useNotifications(timeline: TimelineEntry[]): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    toasts: true,
    desktop: true,
    sounds: false,
  });
  const toast = useToast();
  const processedRef = useRef(new Set<string>());
  const idCounter = useRef(0);

  // Request desktop notification permission
  useEffect(() => {
    if (settings.desktop && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [settings.desktop]);

  const addNotification = useCallback((
    agent: string,
    level: NotificationEntry['level'],
    title: string,
    message: string,
  ) => {
    idCounter.current += 1;
    const notification: NotificationEntry = {
      id: `notif-${idCounter.current}`,
      agent,
      level,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    };

    setNotifications(prev => [notification, ...prev].slice(0, 50));

    // Toast notification
    if (settings.toasts) {
      const statusMap: Record<string, 'error' | 'warning' | 'info' | 'success'> = {
        critical: 'error',
        warning: 'warning',
        info: 'info',
        success: 'success',
      };
      toast({
        title,
        description: message.substring(0, 100),
        status: statusMap[level] || 'info',
        duration: level === 'critical' ? 8000 : 5000,
        isClosable: true,
        position: 'top-right',
      });
    }

    // Desktop notification
    if (settings.desktop && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message.substring(0, 100),
          icon: '/favicon.ico',
          tag: notification.id,
        });
      } catch { /* ignore */ }
    }
  }, [settings, toast]);

  // Process timeline entries for notifications
  useEffect(() => {
    for (const entry of timeline) {
      const key = `${entry.event}-${entry.agent}-${entry.timestamp}`;
      if (processedRef.current.has(key)) continue;
      processedRef.current.add(key);

      if (entry.event === 'agent.completed') {
        const result = (entry.data as any)?.result;
        if (!result) continue;

        const agentLabel = AGENT_LABELS[entry.agent as AgentName] || entry.agent;

        // Critical security gaps
        if (result.criticalSecurityGaps > 0) {
          addNotification(entry.agent, 'critical', `${agentLabel}: Critical Security Gaps`, `${result.criticalSecurityGaps} critical security vulnerabilities found in API endpoints`);
        }

        // Broken frontend calls
        if (result.brokenCalls > 0) {
          addNotification(entry.agent, 'critical', `${agentLabel}: Broken Frontend Calls`, `${result.brokenCalls} frontend API calls reference non-existent endpoints`);
        }

        // Low health scores
        if (result.healthScore !== undefined && result.healthScore < 40) {
          addNotification(entry.agent, 'warning', `${agentLabel}: Low Health Score`, `Health score is ${result.healthScore}/100 — critical issues detected`);
        }

        // Accessibility issues
        if (result.accessibilityIssues > 10) {
          addNotification(entry.agent, 'warning', `${agentLabel}: Accessibility Issues`, `${result.accessibilityIssues} accessibility violations found`);
        }

        // Run completed (success notification)
        if (entry.agent === 'product-intelligence' || (entry.data as any)?.agent === 'product-intelligence') {
          addNotification(entry.agent, 'success', 'Analysis Complete', `All agents finished. ${result.totalFeatures || 0} features identified.`);
        }
      }

      // Loop notifications
      if (entry.event === 'agent.loop') {
        const data = entry.data as any;
        addNotification(entry.agent, 'info', 'Agent Loop', `${data?.from} → ${data?.to}: ${data?.reason || 'Retrying'}`);
      }
    }
  }, [timeline.length, addNotification]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const updateSettings = useCallback((partial: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAllRead,
    markRead,
    settings,
    updateSettings,
  };
}

export default useNotifications;
