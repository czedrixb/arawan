export function useOnline() {
  const online = useState<boolean>('is-online', () => true)
  onMounted(() => {
    online.value = navigator.onLine
    const set = () => (online.value = navigator.onLine)
    window.addEventListener('online', set)
    window.addEventListener('offline', set)
    onUnmounted(() => {
      window.removeEventListener('online', set)
      window.removeEventListener('offline', set)
    })
  })
  return online
}
