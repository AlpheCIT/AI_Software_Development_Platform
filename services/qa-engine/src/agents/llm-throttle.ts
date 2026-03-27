/**
 * LLM Throttle - Rate-limited wrapper for Claude API calls
 * Prevents hitting API rate limits by queuing calls with configurable delays.
 * Supports retry with exponential backoff on 429 errors.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { BaseMessage } from '@langchain/core/messages';
import { qaConfig } from '../config';

// Global semaphore for parallel call limiting
let activeCallCount = 0;
let callQueue: Array<() => void> = [];
let lastCallTime = 0;

function waitForSlot(): Promise<void> {
  return new Promise<void>(resolve => {
    if (activeCallCount < qaConfig.rateLimit.maxParallelCalls) {
      activeCallCount++;
      resolve();
    } else {
      callQueue.push(() => {
        activeCallCount++;
        resolve();
      });
    }
  });
}

function releaseSlot(): void {
  activeCallCount--;
  if (callQueue.length > 0) {
    const next = callQueue.shift();
    next?.();
  }
}

async function waitForDelay(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  const delay = qaConfig.rateLimit.delayBetweenCallsMs;

  if (elapsed < delay && lastCallTime > 0) {
    const waitTime = delay - elapsed;
    console.log(`[Throttle] Waiting ${(waitTime / 1000).toFixed(1)}s before next LLM call (rate limit protection)`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastCallTime = Date.now();
}

/**
 * Throttled LLM invoke - wraps ChatAnthropic.invoke with:
 * 1. Semaphore-based parallel call limiting
 * 2. Configurable delay between calls
 * 3. Retry with exponential backoff on 429 rate limit errors
 */
export async function throttledInvoke(
  model: ChatAnthropic,
  messages: BaseMessage[],
  agentName: string,
  eventPublisher?: any,
  runId?: string
): Promise<any> {
  await waitForSlot();

  try {
    await waitForDelay();

    let lastError: any;
    const maxRetries = qaConfig.rateLimit.retryOnRateLimit ? qaConfig.rateLimit.maxRetries : 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const backoffMs = qaConfig.rateLimit.retryBaseDelayMs * Math.pow(2, attempt - 1);
          console.log(`[Throttle] ${agentName}: Retry ${attempt}/${maxRetries} after ${(backoffMs / 1000).toFixed(0)}s backoff`);

          eventPublisher?.emit('qa:agent.progress', {
            runId,
            agent: agentName,
            progress: -1,
            message: `Rate limited — retrying in ${(backoffMs / 1000).toFixed(0)}s (attempt ${attempt + 1}/${maxRetries + 1})`,
          });

          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }

        const response = await model.invoke(messages);
        return response;

      } catch (error: any) {
        lastError = error;
        const isRateLimit =
          error?.status === 429 ||
          error?.message?.includes('rate_limit') ||
          error?.message?.includes('Rate limit') ||
          error?.message?.includes('429') ||
          error?.message?.includes('output tokens per minute');

        if (isRateLimit && attempt < maxRetries) {
          console.warn(`[Throttle] ${agentName}: Rate limited (429). Will retry.`);
          continue;
        }

        // Not a rate limit error or exhausted retries
        throw error;
      }
    }

    throw lastError;
  } finally {
    releaseSlot();
  }
}

/**
 * Create a pre-configured ChatAnthropic model instance
 * Centralizes model creation so all agents use the same config
 */
export function createModel(options?: {
  temperature?: number;
  maxTokens?: number;
}): ChatAnthropic {
  return new ChatAnthropic({
    modelName: qaConfig.anthropic.model,
    anthropicApiKey: qaConfig.anthropic.apiKey,
    temperature: options?.temperature ?? 0.3,
    maxTokens: options?.maxTokens ?? 4096,
  });
}
