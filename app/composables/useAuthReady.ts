// Distinct from useSupabaseUser(): that ref starts null both "not signed
// in" and "not resolved yet" -- this flag disambiguates the two so the
// launch state machine (spec §12) doesn't redirect to /login before it
// actually knows. Flipped true by app/plugins/auth-ready.client.ts.
export function useAuthReady() {
  return useState<boolean>('auth-ready', () => false)
}
