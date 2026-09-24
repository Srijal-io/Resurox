/**
 * Standard Provider Adapter Interface (PRD §7, Phase 4b §2).
 */

export interface ProviderCallParams {
  prompt: string;
  model: string;
  jsonSchemaResponse?: boolean;
  maxOutputTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface AIProviderAdapter {
  id: string;
  call(params: ProviderCallParams): Promise<string>;
}
