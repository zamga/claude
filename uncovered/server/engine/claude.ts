import Anthropic from '@anthropic-ai/sdk';

/*
 * The one place the engine talks to Claude. Every request is streamed and
 * resolved to its final message (long requests need streaming), retried by
 * the SDK on rate limits and overload, and counted: tokens, cache use, web
 * searches and what they cost. Tests substitute a scripted client with the
 * same interface.
 */

export const MODEL = 'claude-opus-5-5';

export type MessageParams = Anthropic.MessageStreamParams;

export interface ModelClient {
  /** One streamed request, resolved to its final message. With an output format, the parsed output too. */
  send(params: MessageParams, signal?: AbortSignal): Promise<{ message: Anthropic.Message; parsed: unknown }>;
}

/** List prices for the engine's model, US dollars per million tokens; web search per thousand searches. */
export const PRICES = {
  input: 4,
  output: 20,
  cacheRead: 0.2,
  // Writing a five-minute cache entry costs 1.25 times the input price.
  cacheWrite: 5,
  searchPerThousand: 10,
};

export class Usage {
  calls = 0;
  input = 0;
  output = 0;
  cacheRead = 0;
  cacheWrite = 0;
  searches = 0;

  add(u: Anthropic.Usage) {
    this.calls += 1;
    this.input += u.input_tokens;
    this.output += u.output_tokens;
    this.cacheRead += u.cache_read_input_tokens ?? 0;
    this.cacheWrite += u.cache_creation_input_tokens ?? 0;
    this.searches += u.server_tool_use?.web_search_requests ?? 0;
  }

  /** What the run has cost so far, in US dollars, at list prices. */
  get dollars(): number {
    return (
      (this.input * PRICES.input +
        this.output * PRICES.output +
        this.cacheRead * PRICES.cacheRead +
        this.cacheWrite * PRICES.cacheWrite) /
        1e6 +
      (this.searches * PRICES.searchPerThousand) / 1000
    );
  }

  toJSON() {
    return {
      calls: this.calls,
      inputTokens: this.input,
      outputTokens: this.output,
      cacheReadTokens: this.cacheRead,
      cacheWriteTokens: this.cacheWrite,
      webSearches: this.searches,
      dollars: Math.round(this.dollars * 100) / 100,
    };
  }
}

/** A model refusal or an unusable answer, which the run reports rather than retries forever. */
export class ModelError extends Error {
  constructor(
    message: string,
    readonly code: 'refusal' | 'truncated' | 'unparseable' | 'context' | 'no-key',
  ) {
    super(message);
    this.name = 'ModelError';
  }
}

export function anthropicClient(apiKey = process.env.ANTHROPIC_API_KEY): ModelClient {
  if (!apiKey) throw new ModelError('ANTHROPIC_API_KEY is not set.', 'no-key');
  const client = new Anthropic({ apiKey, maxRetries: 4 });
  return {
    async send(params, signal) {
      const stream = client.messages.stream(params, { signal });
      const message = await stream.finalMessage();
      return { message, parsed: (message as { parsed_output?: unknown }).parsed_output ?? null };
    },
  };
}
