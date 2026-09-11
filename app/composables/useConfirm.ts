// Promise-based confirmation, backing every "are you sure" moment (spec
// §13: confirm before discarding changed values; reversal confirmation
// naming the amount/date). One host renders the dialog; see
// app/components/shared/ConfirmDialogHost.vue in layouts/default.vue.
export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmState extends ConfirmRequest {
  resolve: (value: boolean) => void
}

export function useConfirmState() {
  return useState<ConfirmState | null>('confirm-dialog', () => null)
}

export function useConfirm() {
  const state = useConfirmState()
  return function confirm(request: ConfirmRequest): Promise<boolean> {
    return new Promise((resolve) => {
      state.value = { ...request, resolve }
    })
  }
}
