export default defineEventHandler(async (event) => {
  if (!isNativePostgres()) throw createError({ statusCode: 404 })
  requireSameOrigin(event)
  await destroyNativeSession(event)
  return { ok: true }
})
