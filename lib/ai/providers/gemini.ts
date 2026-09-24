import { GoogleGenAI } from '@google/genai';
import { ProviderRegistryEntry } from '../../../config/ai-providers';
import { AIProviderAdapter, ProviderCallParams } from './types';
import { extractJsonString } from '../client';
import { PipelineError } from '../../pipeline/errors';

/**
 * Native Google Gemini Provider Adapter (Phase 4b §2).
 * Leverages the official @google/genai SDK.
 */
export class GeminiProviderAdapter implements AIProviderAdapter {
  public readonly id: string;
  private readonly apiKeyEnv: string | null;

  constructor(entry: ProviderRegistryEntry) {
    this.id = entry.id;
    this.apiKeyEnv = entry.apiKeyEnv;
  }

  public async call(params: ProviderCallParams): Promise<string> {
    const apiKey = this.apiKeyEnv ? process.env[this.apiKeyEnv]?.trim() : undefined;
    if (!apiKey && this.apiKeyEnv !== null) {
      throw new PipelineError(
        'AI_AUTH_FAILED',
        `API key environment variable "${this.apiKeyEnv}" is not configured on the server.`
      );
    }

    if (params.signal?.aborted) {
      throw new PipelineError('PIPELINE_TIMEOUT', 'Request was cancelled before Gemini invocation.');
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: params.model,
        contents: params.prompt,
        ...(params.jsonSchemaResponse ? { config: { responseMimeType: 'application/json' } } : {}),
      });

      const text = response.text?.trim() || '{}';
      return extractJsonString(text);
    } catch (err: unknown) {
      if (err instanceof PipelineError) throw err;
      const error = err instanceof Error ? err : new Error(String(err));
      const msg = error.message || '';

      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        throw new PipelineError('AI_RATE_LIMITED', 'Gemini API rate limit exceeded.', {
          retryAfterSec: 30,
          internalDetails: error,
        });
      }
      if (msg.includes('401') || msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
        throw new PipelineError('AI_AUTH_FAILED', 'Gemini authentication failed.', {
          internalDetails: error,
        });
      }
      if (msg.includes('500') || msg.includes('503') || msg.includes('UNAVAILABLE')) {
        throw new PipelineError('AI_PROVIDER_ERROR', 'Gemini returned transient server error.', {
          internalDetails: error,
        });
      }
      throw new PipelineError('AI_PROVIDER_ERROR', `Gemini API execution error: ${msg}`, {
        internalDetails: error,
      });
    }
  }
}
