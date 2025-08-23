import { logger } from '../utils/logger';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

export class WebSocketService {
  private connected: boolean = false;
  private messageQueue: WebSocketMessage[] = [];
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    this.initializeService();
  }

  private initializeService(): void {
    // Initialize WebSocket service
    // In a real implementation, this would connect to the actual WebSocket server
    this.connected = true;
    logger.info('WebSocket service initialized');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async broadcast(type: string, data: any, userId?: string): Promise<void> {
    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date(),
      userId
    };

    if (this.connected) {
      // In a real implementation, this would send to the WebSocket server
      logger.debug(`Broadcasting message: ${type}`, { data, userId });
      
      // Notify local subscribers
      this.notifySubscribers(type, data);
    } else {
      // Queue message for later delivery
      this.messageQueue.push(message);
      logger.warn(`WebSocket not connected, queuing message: ${type}`);
    }
  }

  subscribe(eventType: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    
    this.subscribers.get(eventType)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(eventType)?.delete(callback);
    };
  }

  private notifySubscribers(eventType: string, data: any): void {
    const callbacks = this.subscribers.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Error in WebSocket subscriber callback:`, error);
        }
      });
    }
  }

  async sendToUser(userId: string, type: string, data: any): Promise<void> {
    await this.broadcast(type, data, userId);
  }

  async sendJobUpdate(jobId: string, update: any): Promise<void> {
    await this.broadcast('ingestion:job-update', {
      jobId,
      ...update
    });
  }

  async sendRepositoryUpdate(repositoryId: string, update: any): Promise<void> {
    await this.broadcast('repository:update', {
      repositoryId,
      ...update
    });
  }

  async sendSystemNotification(message: string, level: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    await this.broadcast('system:notification', {
      message,
      level,
      timestamp: new Date()
    });
  }

  async flushMessageQueue(): Promise<void> {
    if (this.connected && this.messageQueue.length > 0) {
      logger.info(`Flushing ${this.messageQueue.length} queued WebSocket messages`);
      
      for (const message of this.messageQueue) {
        await this.broadcast(message.type, message.data, message.userId);
      }
      
      this.messageQueue = [];
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    logger.info('WebSocket service disconnected');
  }

  async reconnect(): Promise<void> {
    this.connected = true;
    logger.info('WebSocket service reconnected');
    await this.flushMessageQueue();
  }

  getQueuedMessageCount(): number {
    return this.messageQueue.length;
  }

  getSubscriberCount(): number {
    let total = 0;
    this.subscribers.forEach(callbacks => {
      total += callbacks.size;
    });
    return total;
  }

  getStats(): {
    connected: boolean;
    queuedMessages: number;
    subscribers: number;
    subscribersByType: Record<string, number>;
  } {
    const subscribersByType: Record<string, number> = {};
    this.subscribers.forEach((callbacks, type) => {
      subscribersByType[type] = callbacks.size;
    });

    return {
      connected: this.connected,
      queuedMessages: this.messageQueue.length,
      subscribers: this.getSubscriberCount(),
      subscribersByType
    };
  }
}
