import { QueryClient } from '@tanstack/react-query';

/**
 * A factory rather than a shared singleton, so every mount of <App /> — including
 * every test — starts from an empty cache instead of inheriting another session.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient();
}
