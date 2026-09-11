import { readFileSync } from 'node:fs'

/** True once global-setup.ts captured a real signed-in session (dev Supabase project + owner creds configured). */
export function hasSession(): boolean {
  try {
    const state = JSON.parse(readFileSync('./tests/e2e/.auth/storage-state.json', 'utf8'))
    return (state.cookies?.length ?? 0) > 0
  } catch {
    return false
  }
}
