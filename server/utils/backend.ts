export function isNativePostgres() {
  return useRuntimeConfig().public.backendMode === 'native-postgres'
}
