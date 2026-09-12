# Workbook analysis — `ARAWAN copy.xlsx`

Verified 2026-09-12 by parsing the file's raw XML directly (no library), so
these facts do not depend on any importer's interpretation. This document
is the source of truth for phase 4 (Excel import) and corrects three points
in `ARAWAN-implementation-plan.md`.

## Shape

- Single sheet, `Sheet1`, dimension `A2:H52`. No formulas anywhere.
- 1900 date system (`date1904` not set).
- Title `ARAWAN -MAAGUSAN, DAVAO DE ORO` in **D2**.
- Header row **3**: `B3=NAME:`, `C3=DATE BORROWED`, `D3=PAYMENT START`,
  `E3=DATE COMPLETED`, `F3=AMOUNT`, `G3=DAILY`, `H3=%`.
  `A3` is empty; data rows **4–45** contain sequence numbers 1–42 in A.
- Manual total row **50**.

## Corrections to the implementation plan

1. **B43 is not corrupted.** The plan states B43 holds a replacement
   character (`�`) and that the owner must be asked for the intended
   spelling during import review. It does not — **B43 is
   `HELEN T. SERDEÑA`** and **B21 is `ROVELIA B. BASAÑEZ`**, both a
   legitimate `Ñ` (U+00D1). There is no U+FFFD anywhere in the file. Action:
   drop the "ask for intended spelling" review flow for this cell entirely.
   Require UTF-8 correctness end to end, and accent-fold
   `borrowers.normalized_name` (in the app/service layer, not the
   migration) so a search for `serdena` finds `SERDEÑA`. `B15` also has a
   stray double space (`NILDA  R. ROSETE`) — the same normalizer (lowercase
   + collapse whitespace + strip accents) handles it without a special case.

2. **The total row is column-misaligned.** `C50=321500`, `G50=6430`,
   `H50=64300`; **`F50` is empty**. The AMOUNT total sits under
   *DATE BORROWED*, not under AMOUNT. Use the 42 detail rows as the source
   values and do not import or force the manually-entered total row.

3. **H4 is ₱1,000 and remains ₱1,000.** The row-level interest sum is
   ₱59,300, which differs from the manual total by ₱5,000. Do not infer or
   apply a correction from that discrepancy.

## Confirmed as originally stated

- `D34 = 2006-09-07`, before its own borrowed date `C34 = 2026-09-06`.
- `E45 = 2036-11-06` (a distant/implausible completion date).
- DAILY (`G`) is exactly 2% of AMOUNT (`F`) on every one of the 42 rows —
  an observed pattern, not sufficient evidence of a contractual rule.
- Reconciliation: ΣAMOUNT = 321,500 = C50 ✓. ΣDAILY = 6,430 = G50 ✓.
  Σ% = 59,300 vs H50 = 64,300.

## Not previously noted

- **`IGIE F. SIBANTA` (rows 17 and 34) and `MILDRED G. MARIMON` (rows 23
  and 33) each hold two separate loans** — 42 loan rows across **40
  distinct borrowers**. This is the concrete case the loan-detail screen's
  "other loans by this borrower, balances never combined" rule must handle
  correctly from day one, not a hypothetical.
- Inclusive term-length histogram (`E − D + 1`, excluding the two date
  anomalies at rows 34 and 45): **60 days ×20, 62 days ×17, 63 days ×3**.
  Confirms the plan's claim that there is no universal 60-day term.

## Resolved interpretation

The workbook's `%` column is the monetary interest charged for each loan.
The app stores it as `interest_centavos` and displays it as PHP currency.
It is included in each loan's payable total and the Overview interest
total. DATE COMPLETED is used as the scheduled due/completion target, not
proof of repayment. The two anomalous dates (D34 and E45) are preserved and
flagged for review.
