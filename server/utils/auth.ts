// Every Nitro handler runs this first (spec §11 request pipeline):
// authenticate -> origin check on cookie-auth mutations -> zod parse ->
// ownership-scoped query. The Supabase client here is per-request and
// user-scoped (serverSupabaseClient reads the caller's session cookie),
// so RLS applies -- the app never accepts or trusts a client-sent owner_id.
import type { H3Event } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/database.types'
import { createHash, randomBytes } from 'node:crypto'
import { NativeSupabaseClient, withNativeClient } from './native-db'

export const LOCAL_SESSION_COOKIE = 'arawan-local-session'

function sessionHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function getNativeUser(event: H3Event) {
  const token = getCookie(event, LOCAL_SESSION_COOKIE)
  if (!token) return null
  return withNativeClient(async (client) => {
    const { rows } = await client.query(
      `select u.id, u.email
         from auth.local_sessions s
         join auth.users u on u.id = s.user_id
        where s.token_hash = $1 and s.expires_at > now()`,
      [sessionHash(token)],
    )
    return rows[0] as { id: string; email: string } | undefined ?? null
  })
}

export async function createNativeSession(event: H3Event, email: string, password: string) {
  const user = await withNativeClient(async (client) => {
    const { rows } = await client.query(
      `select id, email from auth.users
        where lower(email) = lower($1)
          and encrypted_password = extensions.crypt($2, encrypted_password)
          and disabled_at is null`,
      [email, password],
    )
    return rows[0] as { id: string; email: string } | undefined
  })
  if (!user) return null
  const token = randomBytes(32).toString('base64url')
  await withNativeClient((client) => client.query(
    `insert into auth.local_sessions (user_id, token_hash, expires_at)
     values ($1, $2, now() + interval '30 days')`,
    [user.id, sessionHash(token)],
  ))
  setCookie(event, LOCAL_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return user
}

export async function destroyNativeSession(event: H3Event) {
  const token = getCookie(event, LOCAL_SESSION_COOKIE)
  if (token) await withNativeClient((client) => client.query('delete from auth.local_sessions where token_hash = $1', [sessionHash(token)]))
  deleteCookie(event, LOCAL_SESSION_COOKIE, { path: '/' })
}

export async function requireOwner(event: H3Event) {
  if (isNativePostgres()) {
    const user = await getNativeUser(event)
    if (!user) unauthorized(event)
    return { user, client: new NativeSupabaseClient(user.id) as any }
  }
  const rawUser = await serverSupabaseUser(event)
  if (!rawUser) unauthorized(event)
  const client = await serverSupabaseClient<Database>(event)
  // On this @nuxtjs/supabase version, serverSupabaseUser() returns the
  // decoded JWT claims (subject id in `sub`) rather than the full
  // Supabase `User` object (id in `id`) its own type declares -- confirmed
  // by logging the raw value against a real signed-in session. Normalize
  // once here so every route can keep reading `user.id`.
  const id = (rawUser as { id?: string; sub?: string }).id ?? (rawUser as { sub?: string }).sub
  if (!id) unauthorized(event)
  return { user: { ...rawUser, id }, client }
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
