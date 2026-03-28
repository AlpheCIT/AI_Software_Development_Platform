// ─── LLM Client Abstraction ─────────────────────────────────────────────────
// Provides a unified interface for calling LLMs (Anthropic Claude, Ollama local)
// with retry logic, rate limiting, usage tracking, and JSON parsing helpers.
//
// Requires @anthropic-ai/sdk >= 0.20.0 for the messages API.
// Install: npm install @anthropic-ai/sdk@latest

// eslint-disable-next-line @typescript-eslint/no-require-imports
let Anthropic: any;
try {
  // Dynamic import to avoid hard failure if SDK not installed
  Anthropic = require('@anthropic-ai/sdk').default ?? require('@anthropic-ai/sdk');
} catch {
  Anthropic = null;
}

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface LLMClientOptions {
  jsonSchema?: object;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface LLMResponse {
  content: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
  cached?: boolean;
}

export interface LLMClient {
  complete(systemPrompt: string, userPrompt: string, options?: LLMClientOptions): Promise<LLMResponse>;
  getUsageStats(): { totalCalls: number; totalTokens: number; estimatedCost: number };
}

// ─── Token Bucket Rate Limiter ──────────────────────────────────────────────

class TokenBucketRateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private lastRefill: number;
  private readonly refillRate: number; // tokens per millisecond

  constructor(requestsPerMinute: number) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.lastRefill = Date.now();
    this.refillRate = requestsPerMinute / 60_000;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Wait until a token is available
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// ─── Retry Helper ───────────────────────────────────────────────────────────

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err?.status ?? err?.statusCode ?? 0;
      const isRetryable = status === 429 || status >= 500;
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(`LLM request failed (status ${status}), retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// ─── Anthropic LLM Client ───────────────────────────────────────────────────

// Cost per million tokens for Claude Sonnet
const SONNET_INPUT_COST_PER_M = 3;
const SONNET_OUTPUT_COST_PER_M = 15;

export class AnthropicLLMClient implements LLMClient {
  private client: any;
  private defaultModel: string;
  private rateLimiter: TokenBucketRateLimiter;
  private stats = { totalCalls: 0, totalTokens: 0, estimatedCost: 0 };

  constructor() {
    if (!Anthropic) {
      throw new Error('@anthropic-ai/sdk is not installed. Run: npm install @anthropic-ai/sdk@latest');
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    this.client = new Anthropic({ apiKey });
    this.defaultModel = process.env.LLM_MODEL ?? 'claude-sonnet-4-20250514';
    const rpm = parseInt(process.env.LLM_RPM ?? '30', 10);
    this.rateLimiter = new TokenBucketRateLimiter(rpm);
  }

  async complete(systemPrompt: string, userPrompt: string, options?: LLMClientOptions): Promise<LLMResponse> {
    const model = options?.model ?? this.defaultModel;
    const maxTokens = options?.maxTokens ?? 4096;
    const temperature = options?.temperature ?? 0.2;

    let finalSystemPrompt = systemPrompt;
    if (options?.jsonSchema) {
      finalSystemPrompt += `\n\nReturn your response as valid JSON matching this schema: ${JSON.stringify(options.jsonSchema)}`;
    }

    await this.rateLimiter.acquire();

    const response: any = await retryWithBackoff(async () => {
      return this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: finalSystemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      });
    });

    const content = (response.content as any[])
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    const usage = {
      promptTokens: response.usage.input_tokens as number,
      completionTokens: response.usage.output_tokens as number,
      totalTokens: (response.usage.input_tokens + response.usage.output_tokens) as number,
    };

    const inputCost = (usage.promptTokens / 1_000_000) * SONNET_INPUT_COST_PER_M;
    const outputCost = (usage.completionTokens / 1_000_000) * SONNET_OUTPUT_COST_PER_M;
    const cost = inputCost + outputCost;

    this.stats.totalCalls += 1;
    this.stats.totalTokens += usage.totalTokens;
    this.stats.estimatedCost += cost;

    const cached = (response.usage?.cache_read_input_tokens ?? 0) > 0;

    console.log(`🤖 LLM call: ${model} | ${usage.totalTokens} tokens | $${cost.toFixed(4)}`);

    return { content, usage, model, cached };
  }

  getUsageStats(): { totalCalls: number; totalTokens: number; estimatedCost: number } {
    return { ...this.stats };
  }
}

// ─── Ollama LLM Client ─────────────────────────────────────────────────────

export class OllamaLLMClient implements LLMClient {
  private baseUrl: string;
  private defaultModel: string;
  private stats = { totalCalls: 0, totalTokens: 0, estimatedCost: 0 };

  constructor() {
    this.baseUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL ?? 'llama3.1';
  }

  async complete(systemPrompt: string, userPrompt: string, options?: LLMClientOptions): Promise<LLMResponse> {
    const model = options?.model ?? this.defaultModel;

    let finalSystemPrompt = systemPrompt;
    if (options?.jsonSchema) {
      finalSystemPrompt += `\n\nReturn your response as valid JSON matching this schema: ${JSON.stringify(options.jsonSchema)}`;
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: {
          temperature: options?.temperature ?? 0.2,
          num_predict: options?.maxTokens ?? 4096,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama request failed (${response.status}): ${body}`);
    }

    const data = await response.json() as any;

    const content: string = data.message?.content ?? '';
    const promptTokens: number = data.prompt_eval_count ?? 0;
    const completionTokens: number = data.eval_count ?? 0;

    const usage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };

    this.stats.totalCalls += 1;
    this.stats.totalTokens += usage.totalTokens;
    // No cost for local inference

    console.log(`🤖 LLM call: ${model} (Ollama) | ${usage.totalTokens} tokens | $0.0000`);

    return { content, usage, model, cached: false };
  }

  getUsageStats(): { totalCalls: number; totalTokens: number; estimatedCost: number } {
    return { ...this.stats };
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createLLMClient(): LLMClient | null {
  const provider = (process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase();

  if (provider === 'ollama') {
    return new OllamaLLMClient();
  }

  // Default: anthropic
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY is not set. LLM client will not be available. Set LLM_PROVIDER=ollama for local inference.');
    return null;
  }

  return new AnthropicLLMClient();
}

// ─── JSON Parsing Helper ────────────────────────────────────────────────────

export function parseLLMJson<T = any>(raw: string): T {
  // 1. Try direct parse
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // continue
  }

  // 2. Try extracting from markdown code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // continue
    }
  }

  // 3. Try to find JSON object or array in the text
  const jsonObjectMatch = trimmed.match(/(\{[\s\S]*\})/);
  if (jsonObjectMatch) {
    try {
      return JSON.parse(jsonObjectMatch[1]) as T;
    } catch {
      // continue
    }
  }

  const jsonArrayMatch = trimmed.match(/(\[[\s\S]*\])/);
  if (jsonArrayMatch) {
    try {
      return JSON.parse(jsonArrayMatch[1]) as T;
    } catch {
      // continue
    }
  }

  throw new Error(`Failed to parse LLM response as JSON. Raw response starts with: "${trimmed.slice(0, 200)}..."`);
}
