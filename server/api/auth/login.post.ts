import { z } from 'zod'

const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) })

export default defineEventHandler(async (event) => {
  if (!isNativePostgres()) throw createError({ statusCode: 404 })
  requireSameOrigin(event)
  const input = validateInput(event, schema, await readBody(event))
  const user = await createNativeSession(event, input.email, input.password)
  if (!user) unauthorized(event)
  return { user }
})
