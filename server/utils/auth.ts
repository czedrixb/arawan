// Every Nitro handler runs this first (spec §11 request pipeline):
// authenticate -> origin check on cookie-auth mutations -> zod parse ->
// ownership-scoped query. The Supabase client here is per-request and
// user-scoped (serverSupabaseClient reads the caller's session cookie),
// so RLS applies -- the app never accepts or trusts a client-sent owner_id.
import type { H3Event } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/database.types'

export async function requireOwner(event: H3Event) {
  const user = await serverSupabaseUser(event)
  if (!user) unauthorized(event)
  const client = await serverSupabaseClient<Database>(event)
  return { user, client }
}

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

/**
 * Minimal same-origin check for cookie-authenticated mutations. Supabase
 * cookies are SameSite=Lax, which already blocks cross-site form posts,
 * but a same-site GET-triggered navigation could still carry them -- this
 * closes that gap for state-changing requests specifically.
 */
export function requireSameOrigin(event: H3Event) {
  if (!MUTATING_METHODS.has(event.method)) return
  const origin = getRequestHeader(event, 'origin')
  if (!origin) return // same-site requests from a browser always send Origin on mutations
  const host = getRequestHeader(event, 'host')
  const originHost = (() => {
    try {
      return new URL(origin).host
    } catch {
      return null
    }
  })()
  if (originHost !== host) {
    throw createError({ statusCode: 403, statusMessage: 'Cross-origin request rejected' })
  }
}
