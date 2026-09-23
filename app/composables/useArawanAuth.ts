export interface ArawanUser { id: string; email?: string }

export function useArawanUser() {
  const mode = useRuntimeConfig().public.backendMode
  return mode === 'native-postgres'
    ? useState<ArawanUser | null>('arawan-user', () => null)
    : useSupabaseUser() as Ref<ArawanUser | null>
}

export async function signInArawan(email: string, password: string) {
  if (useRuntimeConfig().public.backendMode === 'native-postgres') {
    const response = await $fetch<{ user: ArawanUser }>('/api/auth/login', { method: 'POST', body: { email, password } })
    useState<ArawanUser | null>('arawan-user').value = response.user
    return
  }
  const { error } = await useSupabaseClient().auth.signInWithPassword({ email, password })
  if (error) throw error
  await waitForSupabaseUser()
}

export async function signOutArawan() {
  if (useRuntimeConfig().public.backendMode === 'native-postgres') {
    await $fetch('/api/auth/logout', { method: 'POST' })
    useState<ArawanUser | null>('arawan-user').value = null
  } else {
    await useSupabaseClient().auth.signOut()
  }
}
