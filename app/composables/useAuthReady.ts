// Distinct from useSupabaseUser(): that ref starts null both "not signed
// in" and "not resolved yet" -- this flag disambiguates the two so the
// launch state machine (spec §12) doesn't redirect to /login before it
// actually knows. Flipped true by app/plugins/auth-ready.client.ts.
export function useAuthReady() {
  return useState<boolean>('auth-ready', () => false)
}

/**
 * `signInWithPassword`'s promise resolves before @nuxtjs/supabase's
 * onAuthStateChange listener updates useSupabaseUser() -- navigating
 * immediately after sign-in can race auth.global.ts's route guard, which
 * still sees a null user and bounces back to /login. Call this right
 * after a successful sign-in (or password update) and before navigating.
 */
export async function waitForSupabaseUser(timeoutMs = 3000): Promise<boolean> {
  const user = useSupabaseUser()
  const start = Date.now()
  while (!user.value) {
    if (Date.now() - start > timeoutMs) return false
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
  return true
}
