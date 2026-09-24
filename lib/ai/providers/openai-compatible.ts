import { ProviderRegistryEntry, resolveProviderBaseUrl } from '../../../config/ai-providers';
import { AIProviderAdapter, ProviderCallParams } from './types';
import { extractJsonString } from '../client';
import { PipelineError } from '../../pipeline/errors';

/**
 * Generic OpenAI-Compatible REST Adapter (Phase 4b §2 & Addendum C, D, E).
 */
export class OpenAICompatibleAdapter implements AIProviderAdapter {
  public readonly id: string;
  private readonly baseUrl: string;
  private readonly apiKeyEnv: string | null;
  private readonly supportsJsonMode: boolean;
  private readonly reasoning: boolean;

  constructor(entry: ProviderRegistryEntry) {
    this.id = entry.id;
    this.baseUrl = resolveProviderBaseUrl(entry).replace(/\/+$/, '');
    this.apiKeyEnv = entry.apiKeyEnv;
    this.supportsJsonMode = entry.supportsJsonMode;
    this.reasoning = entry.reasoning ?? false;
  }

  public async call(params: ProviderCallParams): Promise<string> {
    let apiKey: string | null = null;

    // Addendum C: Anonymous providers send no Auth header
    if (this.apiKeyEnv !== null) {
      apiKey = process.env[this.apiKeyEnv]?.trim() || null;
      if (!apiKey) {
        throw new PipelineError(
          'AI_AUTH_FAILED',
          `API key environment variable "${this.apiKeyEnv}" is not configured on the server.`
        );
      }
    }

    const endpoint = `${this.baseUrl}/chat/completions`;
    const timeoutMs = params.timeoutMs || 25000;
    const controller = new AbortController();

    if (params.signal) {
      if (params.signal.aborted) {
        throw new PipelineError('PIPELINE_TIMEOUT', 'Request was cancelled before AI provider invocation.');
      }
      params.signal.addEventListener('abort', () => controller.abort(params.signal?.reason));
    }

    const timeoutTimer = setTimeout(() => {
      controller.abort(new Error('AI provider call timeout exceeded'));
    }, timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      if (this.baseUrl.includes('openrouter.ai')) {
        headers['HTTP-Referer'] = 'https://resurox.app';
        headers['X-Title'] = 'Resurox Privacy Resume Analyzer';
      }

      const bodyPayload: Record<string, unknown> = {
        model: params.model,
        messages: [
          {
            role: 'system',
            content: 'You are a precise data extraction and evaluation assistant. Output ONLY valid, parseable JSON conforming strictly to the requested schema. Do not include markdown preamble, commentary, or conversational wrapper.',
          },
          {
            role: 'user',
            content: params.prompt,
          },
        ],
        temperature: 0.0,
        max_tokens: params.maxOutputTokens || (this.reasoning ? 16000 : 4000), // Addendum E: Higher max output tokens for reasoning models
      };

      // Addendum E: Low reasoning effort request for reasoning models where supported
      if (this.reasoning) {
        bodyPayload.reasoning_effort = 'low';
      }

      if (this.supportsJsonMode && params.jsonSchemaResponse) {
        bodyPayload.response_format = { type: 'json_object' };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        const status = response.status;
        const errBody = await response.text().catch(() => '');

        if (status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const retrySec = retryAfter ? parseInt(retryAfter, 10) || 30 : 30;
          throw new PipelineError('AI_RATE_LIMITED', `Provider rate limited request.`, {
            retryAfterSec: retrySec,
            internalDetails: errBody,
          });
        }

        if (status === 401 || status === 403) {
          throw new PipelineError('AI_AUTH_FAILED', `Provider authentication rejected credentials.`, {
            internalDetails: errBody,
          });
        }

        if (status >= 500) {
          throw new PipelineError('AI_PROVIDER_ERROR', `Provider returned server error (${status}).`, {
            internalDetails: errBody,
          });
        }

        throw new PipelineError('AI_PROVIDER_ERROR', `Provider returned HTTP status ${status}.`, {
          internalDetails: errBody,
        });
      }

      const jsonResponse: any = await response.json();
      const choice = jsonResponse?.choices?.[0];
      const finishReason = choice?.finish_reason;
      
      // Addendum E: Read ONLY final message content, never reasoning content field
      const content = choice?.message?.content;

      // Addendum E: Empty content or finish_reason=length is AI_INVALID_RESPONSE
      if (!content || typeof content !== 'string' || content.trim().length === 0 || finishReason === 'length') {
        throw new PipelineError('AI_INVALID_RESPONSE', 'Provider returned empty content or response truncated by token limit.', {
          internalDetails: jsonResponse,
        });
      }

      return extractJsonString(content);
    } catch (err: unknown) {
      if (err instanceof PipelineError) throw err;
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('aborted')) {
        throw new PipelineError('AI_TIMEOUT', 'Provider invocation timed out or was aborted.');
      }
      throw new PipelineError('AI_PROVIDER_ERROR', `Network error communicating with AI provider: ${error.message}`);
    } finally {
      clearTimeout(timeoutTimer);
    }
  }
}
