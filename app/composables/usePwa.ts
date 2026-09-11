// Wraps @vite-pwa/nuxt's registration hook (registerType: 'prompt' in
// nuxt.config.ts, so nothing auto-activates). Settings.vue renders the
// "Update available" banner; it must refuse to call updateNow() while a
// form is dirty or a write is pending (spec §12).
import { useRegisterSW } from 'virtual:pwa-register/vue'

export function usePwa() {
  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
    immediate: true,
  })

  const pendingWrite = useState<boolean>('pwa-pending-write', () => false)
  const dirtyForm = useState<boolean>('pwa-dirty-form', () => false)

  async function updateNow() {
    if (pendingWrite.value || dirtyForm.value) return false
    await updateServiceWorker(true)
    return true
  }

  return { needRefresh, offlineReady, updateNow, pendingWrite, dirtyForm }
}
