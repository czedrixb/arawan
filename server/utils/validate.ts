// Wraps zod .parse() so every route returns the same 422 shape (spec §11)
// instead of leaking a raw ZodError.
import type { H3Event } from 'h3'
import type { ZodType } from 'zod'
import { ZodError } from 'zod'

// `ZodType<T, any, any>`, not the `ZodSchema<T>` shorthand -- that alias
// pins the schema's pre-parse Input type to T as well, which breaks any
// schema with a `.default()` (its real input has optional fields; only
// the parsed output is fully resolved).
export function validateInput<T>(event: H3Event, schema: ZodType<T, any, any>, data: unknown): T {
  try {
    return schema.parse(data)
  } catch (err) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Validation failed',
        data: { requestId: requestId(event), issues: err.issues },
      })
    }
    throw err
  }
}
