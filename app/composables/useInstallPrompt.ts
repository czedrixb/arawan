// Captures the browser's install prompt where available (Chromium);
// Settings falls back to manual "Add to Home Screen" instructions on
// iOS/Safari, which never fires beforeinstallprompt (spec §12).
export function useInstallPrompt() {
  const deferredEvent = useState<any>('install-prompt-event', () => null)
  const installed = useState<boolean>('install-prompt-installed', () => false)

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredEvent.value = e
    })
    window.addEventListener('appinstalled', () => {
      installed.value = true
      deferredEvent.value = null
    })
  })

  async function promptInstall() {
    if (!deferredEvent.value) return false
    await deferredEvent.value.prompt()
    const { outcome } = await deferredEvent.value.userChoice
    deferredEvent.value = null
    return outcome === 'accepted'
  }

  const canPrompt = computed(() => !!deferredEvent.value)
  const isIos = computed(() => import.meta.client && /iphone|ipad|ipod/i.test(navigator.userAgent))

  return { canPrompt, isIos, promptInstall, installed }
}
