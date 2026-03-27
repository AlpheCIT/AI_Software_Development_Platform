import { QA_TOPICS } from './topics';

export interface EventPublisherConfig {
  websocketUrl: string;
  eventBusUrl: string;
}

/**
 * QA Event Publisher — sends real-time events to WebSocket service for frontend updates.
 * In Phase 1, logs events locally. Phase 2 adds full WebSocket forwarding.
 */
export class QAEventPublisher {
  private websocketUrl: string;
  private listeners: Map<string, Array<(data: any) => void>> = new Map();

  constructor(config: EventPublisherConfig) {
    this.websocketUrl = config.websocketUrl;
  }

  emit(event: string, data: any): void {
    const timestamp = new Date().toISOString();
    const envelope = { event, data, timestamp };

    // Log for debugging
    console.log(`[QA Event] ${event}`);

    // Notify local listeners
    const handlers = this.listeners.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(envelope);
      } catch (err) {
        console.error(`[QA Event] Handler error for ${event}:`, err);
      }
    }

    // Forward to WebSocket service (fire-and-forget)
    this.forwardToWebSocket(envelope).catch(() => {
      // Silent fail — WebSocket service may not be running
    });
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  private async forwardToWebSocket(envelope: any): Promise<void> {
    try {
      await fetch(`${this.websocketUrl}/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: `qa:${envelope.data?.runId || 'global'}`,
          event: envelope.event,
          data: envelope.data,
        }),
      });
    } catch {
      // WebSocket service may not be running — that's OK
    }
  }
}
