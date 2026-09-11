// Thin wrapper around supabase-js .rpc() that maps the custom SQLSTATEs
// from supabase/migrations/0006_rpc_financial.sql to typed HTTP errors
// (server/utils/errors.ts), so every financial endpoint gets consistent
// 401/404/409/422 behavior without repeating the mapping.
import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function callRpc<T>(
  event: H3Event,
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(fn, args)
  if (error) mapPostgresError(event, error)
  return data as T
}
