// Search-only normalization -- never a uniqueness key (spec §10). Handles
// both real cases in the workbook: accented letters (SERDENA, BASANEZ)
// and stray double spaces (NILDA  R. ROSETE). See docs/workbook-analysis.md.
const COMBINING_DIACRITICS = /[̀-ͯ]/g

export function normalizeName(displayName: string): string {
  return displayName
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '') // strip combining diacritics (e.g. N-with-tilde -> N)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
