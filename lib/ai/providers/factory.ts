import { ProviderRegistryEntry, DEFAULT_PROVIDER_REGISTRY } from '../../../config/ai-providers';
import { AIProviderAdapter } from './types';
import { OpenAICompatibleAdapter } from './openai-compatible';
import { GeminiProviderAdapter } from './gemini';

/**
 * Adapter factory mapping registry entries to executable provider instances (Phase 4b §2).
 */
const adapterCache: Map<string, AIProviderAdapter> = new Map();

export function getProviderAdapter(entry: ProviderRegistryEntry): AIProviderAdapter {
  const cached = adapterCache.get(entry.id);
  if (cached) return cached;

  let adapter: AIProviderAdapter;
  if (entry.type === 'gemini') {
    adapter = new GeminiProviderAdapter(entry);
  } else {
    // 'openai-compatible' or default REST
    adapter = new OpenAICompatibleAdapter(entry);
  }

  adapterCache.set(entry.id, adapter);
  return adapter;
}

/**
 * Resets adapter cache for testing.
 */
export function resetProviderAdaptersForTesting(): void {
  adapterCache.clear();
}
