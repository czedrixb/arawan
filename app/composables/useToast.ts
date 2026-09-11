// Success confirmations only (spec §13: "a toast is not the sole place a
// failed save is shown" -- errors also render inline where they occur).
export interface ToastItem {
  id: string
  message: string
  tone: 'success' | 'info'
}

export function useToastState() {
  return useState<ToastItem[]>('toasts', () => [])
}

export function useToast() {
  const toasts = useToastState()
  function show(message: string, tone: ToastItem['tone'] = 'success') {
    const id = crypto.randomUUID()
    toasts.value.push({ id, message, tone })
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, 3200)
  }
  return { show }
}
