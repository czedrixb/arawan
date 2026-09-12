// Money is always integer centavos end to end (spec §3) -- these helpers
// are the only place a centavos<->display conversion should happen.

/** `en-PH` PHP formatter with tabular numerals for right-aligned tables. */
const PHP_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
})

/** Formats integer centavos as a PHP currency string, e.g. `321500n` -> "₱3,215.00". */
export function formatCentavos(centavos: number | bigint | null | undefined): string {
  if (centavos === null || centavos === undefined) return '—'
  const pesos = Number(centavos) / 100
  return PHP_FORMATTER.format(pesos)
}

/**
 * Parses a user-typed decimal amount string (e.g. "1,500.50") into integer
 * centavos without float rounding error. Returns null if the input is not
 * a plausible non-negative money amount.
 */
export function parseCentavos(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const [wholePart, fractionPart = ''] = cleaned.split('.')
  const centavos = Number(wholePart) * 100 + Number(fractionPart.padEnd(2, '0'))
  return Number.isSafeInteger(centavos) ? centavos : null
}

/** Product-wide magnitude guard (spec §3: "enforce supported magnitude limits"): PHP 100,000,000.00. */
export const MAX_CENTAVOS = 10000000000

export function isPlausibleAmount(centavos: number): boolean {
  return Number.isSafeInteger(centavos) && centavos > 0 && centavos <= MAX_CENTAVOS
}
