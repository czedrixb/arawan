// Display metadata for loan_summary.display_status (spec §3/§4). The
// status VALUE always comes from the server (the view is the source of
// truth) -- this module only maps that value to a label + color tokens so
// every StatusPill renders identically, and status is never color-only.
// `DisplayStatus` itself is declared once in shared/types/models.ts,
// which auto-imports into this file without a statement.
export const STATUS_META: Record<DisplayStatus, { label: string; fg: string; bg: string }> = {
  needs_review: { label: 'Needs review', fg: 'var(--color-warning-fg)', bg: 'var(--color-warning-bg)' },
  upcoming: { label: 'Upcoming', fg: 'var(--color-text-secondary)', bg: 'var(--color-surface-subtle)' },
  active: { label: 'Active', fg: 'var(--color-success-fg)', bg: 'var(--color-accent-soft)' },
  overdue: { label: 'Overdue', fg: 'var(--color-danger-fg)', bg: 'var(--color-danger-bg)' },
  completed: { label: 'Completed', fg: 'var(--color-success-fg)', bg: 'var(--color-success-bg)' },
  archived: { label: 'Archived', fg: 'var(--color-text-secondary)', bg: 'var(--color-surface-subtle)' },
}
