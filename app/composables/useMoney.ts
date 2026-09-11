// Binds a plain-text money input to an integer-centavos model without
// ever routing the value through a float (spec §3). The displayed text
// is the user's own typing while focused; it reformats on blur.
export function useMoneyInput(centavos: Ref<number | null>) {
  const text = ref(centavos.value != null ? String(centavos.value / 100) : '')
  const error = ref<string | null>(null)

  watch(centavos, (value) => {
    if (value != null && Number(text.value) * 100 !== value) {
      text.value = (value / 100).toFixed(2)
    }
  })

  function onInput(value: string) {
    text.value = value
    const parsed = parseCentavos(value)
    if (parsed === null) {
      error.value = value.trim() === '' ? null : 'Enter a valid amount'
      return
    }
    error.value = null
    centavos.value = parsed
  }

  function onBlur() {
    if (centavos.value != null) text.value = (centavos.value / 100).toFixed(2)
  }

  return { text, error, onInput, onBlur }
}
