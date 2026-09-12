// Business dates are plain YYYY-MM-DD strings (Postgres `date`), evaluated
// against Asia/Manila -- including on the server (spec §3). Never use
// `new Date()`'s local timezone for "today" in business logic.

const BUSINESS_TZ = 'Asia/Manila'

/** Splits a validated YYYY-MM-DD string into [year, month, day] -- callers own validating the format first. */
function parseIsoParts(iso: string): [number, number, number] {
  const parts = iso.split('-').map(Number)
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}

/** Today's date in Asia/Manila as YYYY-MM-DD, matching Postgres `(now() at time zone 'Asia/Manila')::date`. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(new Date())
}

/** Formats a YYYY-MM-DD string for display without any UTC day-shift. */
export function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = parseIsoParts(iso)
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(y, m - 1, d),
  )
}

/** Inclusive day count between two YYYY-MM-DD dates (matches the workbook's own D..E term convention). */
export function inclusiveDaysBetween(startIso: string, endIso: string): number {
  const [sy, sm, sd] = parseIsoParts(startIso)
  const [ey, em, ed] = parseIsoParts(endIso)
  const start = Date.UTC(sy, sm - 1, sd)
  const end = Date.UTC(ey, em - 1, ed)
  return Math.round((end - start) / 86_400_000) + 1
}

/** ISO weekday (1=Mon..7=Sun) for a YYYY-MM-DD date, independent of local TZ. */
export function isoWeekday(iso: string): number {
  const [y, m, d] = parseIsoParts(iso)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun..6=Sat
  return day === 0 ? 7 : day
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = parseIsoParts(iso)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/**
 * Walks forward from `startIso` counting only the given collection
 * weekdays until `installmentCount` scheduled collection days have
 * occurred (the start date itself counts as day one -- spec §3 example).
 * Returns the date of the final installment.
 */
export function projectScheduleEnd(startIso: string, installmentCount: number, weekdays: number[]): string {
  if (installmentCount <= 0) return startIso
  const allowed = new Set(weekdays)
  let cursor = startIso
  let counted = 0
  // The start date counts as day one only if it falls on an allowed weekday;
  // callers pass a start date already aligned to the collection calendar.
  while (true) {
    if (allowed.has(isoWeekday(cursor))) {
      counted += 1
      if (counted === installmentCount) return cursor
    }
    cursor = addDaysIso(cursor, 1)
  }
}
