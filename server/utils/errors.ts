// Central error mapping (spec §11): 401 unauthenticated, 404 not-found
// (not-found and not-owned are BOTH 404, never distinguished), 409 stale
// version/idempotency conflict, 422 field validation, 500 + request id.
// Detailed failures never enter server logs with borrower names or
// financial payloads -- see logSanitized() below.
import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'

/** Custom Postgres SQLSTATEs raised by the RPCs in supabase/migrations/0006_rpc_financial.sql. */
const PG_ERRCODE_TO_STATUS: Record<string, number> = {
  ARW01: 401,
  ARW04: 404,
  ARW09: 409,
  ARW22: 422,
}

export function requestId(event: H3Event): string {
  const existing = event.context.requestId as string | undefined
  if (existing) return existing
  const id = randomUUID()
  event.context.requestId = id
  return id
}

/** Converts a Postgres/PostgREST error (from an RPC call) into the right typed HTTP error. */
export function mapPostgresError(event: H3Event, error: { code?: string; message?: string }): never {
  const status = (error.code && PG_ERRCODE_TO_STATUS[error.code]) || 500
  const id = requestId(event)
  if (status === 500) {
    // Never put the raw message (may contain amounts/names) into logs.
    // eslint-disable-next-line no-console
    console.error(`[${id}] unexpected rpc error`, error.code ?? 'unknown')
    throw createError({ statusCode: 500, statusMessage: 'Something went wrong', data: { requestId: id } })
  }
  throw createError({ statusCode: status, statusMessage: error.message ?? 'Request failed', data: { requestId: id } })
}

export function notFound(event: H3Event, statusMessage = 'Not found'): never {
  throw createError({ statusCode: 404, statusMessage, data: { requestId: requestId(event) } })
}

export function unauthorized(event: H3Event): never {
  throw createError({ statusCode: 401, statusMessage: 'Not authenticated', data: { requestId: requestId(event) } })
}

export function staleVersion(event: H3Event): never {
  throw createError({
    statusCode: 409,
    statusMessage: 'This record changed since you loaded it',
    data: { requestId: requestId(event) },
  })
}
