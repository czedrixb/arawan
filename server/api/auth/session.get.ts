export default defineEventHandler(async (event) => {
  if (!isNativePostgres()) return { user: null, native: false }
  return { user: await getNativeUser(event), native: true }
})
