import { getServerConfig, getProviderApiKey, getEnvVar } from './config';

export { getServerConfig, getProviderApiKey, getEnvVar };

/**
 * Server-only key resolver. Ignores/rejects client supplied keys per SEC-02 & SEC-03.
 */
export function resolveApiKey(_ignoredClientKey?: string | null, envVarName: string = 'GROQ_API_KEY'): string {
  const envVal = process.env[envVarName]?.trim();
  if (envVal) {
    return envVal;
  }
  return getEnvVar(envVarName);
}
