# Loan Renewal Implementation Plan

## Objective

Add a safe, traceable loan-renewal workflow. A renewal closes the previous loan as **Renewed**, preserves its complete history, and creates a separate linked loan with independent financial terms.

The previous loan must never be deleted, rewritten as the new loan, or counted as a second active collectible after renewal.

## Core Rules

1. A renewal creates a new loan record and never reuses the old loan record.
2. The old loan becomes read-only with an accounting status of `renewed` and a closure timestamp.
3. The old loan remains available in history, reports, exports, and audit logs.
4. The old and new loans are linked in both directions: **renewed from** and **renewed to**.
5. Interest terms are independent for each loan cycle. The old loan's interest mode must not silently determine the renewal's interest mode.
6. Any unpaid old interest must be explicitly marked as **paid**, **capitalized**, or **waived**.
7. Capitalized interest becomes part of the new financed principal only after clear confirmation. It must never be compounded silently.
8. Any additional cash released to the borrower must be shown separately from the amount used to refinance the old balance.
9. The entire renewal must commit atomically: either the old loan is closed and the new loan is created together, or neither change is saved.

## Interest Combinations

| Previous loan | Renewal loan | Required treatment |
|---|---|---|
| With interest | With interest | Settle old principal and old accrued/unpaid interest first. Apply the renewal interest only to the new financed principal. |
| With interest | No interest | Settle old principal and old accrued/unpaid interest first. The renewal generates no new interest. |
| No interest | With interest | Settle the old principal. Start interest only from the renewal's effective date. |
| No interest | No interest | Refinance the agreed old principal and any new cash with no interest. |

The current application auto-fills new loans with 20% interest over a 60-day collection term, although the data model supports `none`, `added`, and `included` interest modes. Before implementation, confirm whether renewals may override the standard 20% terms. If no-interest renewals are allowed, the renewal form must expose that choice deliberately; it must not depend on the old loan's mode.

## Renewal Calculation

Take an immutable settlement snapshot using the effective renewal date:

- Remaining principal
- Unpaid or accrued interest supported by the current loan model
- Fees and penalties, when those features exist
- Total payments collected
- Total amount required to settle the old loan
- Amount paid by the borrower during renewal
- Interest amount capitalized into the new loan
- Interest amount waived
- Principal carried into the new loan
- Additional cash released
- New financed principal

Use this relationship as the confirmation check:

```text
old settlement amount
- amount paid during renewal
- amount waived
= amount refinanced from old loan

amount refinanced from old loan
+ additional cash released
= new financed principal
```

For the current fixed-interest model, "accrued interest" needs a defined business rule. If the full fixed interest is always due, use its unpaid portion. If interest should be prorated as of the renewal date, define and implement that calculation before enabling renewal.

## Data Model

Add renewal-specific fields rather than relying only on `archived_at`:

### Loans

- `lifecycle_status`: include at least `active`, `completed`, and `renewed`; retain existing derived display statuses such as overdue where appropriate.
- `closed_at`
- `renewed_from_loan_id` on the new loan, nullable and owner-scoped
- `renewed_to_loan_id` on the old loan, nullable and owner-scoped
- Optional `renewal_sequence` or derive the sequence by following links

Enforce that a loan can be renewed only once and that both linked loans belong to the same owner and borrower. Prevent self-links and renewal cycles.

### Renewal transaction

Create a dedicated `loan_renewals` table containing:

- Old and new loan IDs
- Owner and borrower IDs
- Effective renewal date
- Old balance snapshot fields
- Old-interest disposition: `paid`, `capitalized`, or `waived`
- Amount paid at renewal
- Amount capitalized
- Amount waived
- Principal carried forward
- Additional cash released
- New financed principal
- Actor, timestamps, and optional notes

Store money as integer centavos. Keep the snapshot even if later reporting formulas change.

### Audit history

Record one renewal event with the before/after values and resulting loan IDs. Waived interest must be recorded as waived, never as payment or income.

## Server and Transaction Design

Add a single server endpoint, for example `POST /api/loans/:id/renew`, backed by a database function or transaction that:

1. Authenticates the owner and locks the old loan against concurrent changes.
2. Rejects loans that are archived, already renewed, incomplete, or otherwise ineligible.
3. Recalculates the authoritative old balance on the server; never trust a client-submitted balance.
4. Validates the submitted interest disposition and amount equation.
5. Records any payment made during renewal through the normal payment ledger.
6. Records any approved waiver distinctly from payments.
7. Creates the new loan with its own dates, daily due, interest mode, interest amount, and total payable.
8. Creates the renewal snapshot and bidirectional links.
9. Marks the old loan `renewed`, sets `closed_at`, and makes it read-only.
10. Writes the audit event and commits all changes atomically.

Use optimistic version checks as well as the database transaction to prevent a payment and renewal from racing against one another.

## User Experience

### Entry point

Add a **Renew loan** action on eligible active-loan records. Hide or disable it for completed, renewed, archived, and needs-review loans, with a short explanation.

### Renewal flow

Use a reviewable form with these sections:

1. **Old-loan settlement** — read-only principal, interest, payments, and remaining balance as of the renewal date.
2. **Old-interest treatment** — require paid, capitalized, or waived when unpaid interest exists. Waiver should require authorization or a note.
3. **Renewal terms** — effective date, carried balance, additional cash, new principal, independent interest setting, payment dates, and daily due.
4. **Confirmation** — clearly distinguish old debt refinanced, interest handled, cash released, new interest, and new total payable.

Require a final confirmation such as **Close old loan and create renewal**. Do not label the full new principal as cash released.

### Loan details and lists

- Show a **Renewed** status on the old record and make financial editing/payment actions unavailable.
- Show links between renewal generations on both records.
- Display the settlement snapshot and the paid/capitalized/waived breakdown.
- Exclude renewed loans from active collectible totals and default active lists.
- Keep renewed loans accessible through history and an explicit status filter.
- Ensure archived UI treatment does not imply the loan was paid. `renewed` is the accounting state; archive is only a visibility/lifecycle mechanism.

## Reporting and Export Rules

- Active balance reports count only the new loan after renewal.
- Historical principal and interest reports retain the old loan and its actual results.
- Capitalized interest is disclosed as refinanced interest, not new cash released.
- Waived interest is excluded from collections and interest income.
- Exports include lifecycle status, renewal links, effective date, settlement amounts, and interest disposition.
- A renewal chain can be followed from the first loan to the current active loan.

## Validation and Edge Cases

- Reject a second renewal attempt for the same old loan.
- Reject renewal when the effective date precedes the old loan's borrowed date or an existing payment that must occur before settlement.
- Decide whether fully paid loans can be renewed; the recommended behavior is to create a normal new loan instead.
- Define treatment for overpayments and credits before allowing renewal in that state.
- Define authorization for waived interest.
- Prevent payments or financial edits on the old loan after renewal.
- Make repeated requests idempotent so a retry cannot create duplicate renewal loans.
- Preserve borrower identity and owner isolation across all linked records.
- Recalculate all totals server-side and enforce centavo-level equality.

## Implementation Phases

### Phase 1 — Confirm accounting policy

- Decide whether renewal interest may be `none`, `added`, or `included`, or must follow the current 20% standard.
- Define whether fixed old interest is fully due or prorated on renewal.
- Define waiver permissions and whether fees/penalties are in scope.
- Confirm whether partial cash settlement plus partial capitalization is allowed. The recommended model allows it.

### Phase 2 — Database and domain model

- Add lifecycle status, closure fields, renewal links, and the renewal transaction table.
- Add constraints, indexes, owner-scoped access policies, and an atomic renewal database function.
- Update generated database types and loan summary views.

### Phase 3 — API and business logic

- Add renewal input validation and server-side settlement calculation.
- Implement the transactional renewal service and endpoint.
- Update active balances, overview metrics, exports, and financial-lock rules.

### Phase 4 — Interface

- Add the renewal action, settlement form, interest-disposition controls, and confirmation summary.
- Add Renewed status, linked-loan navigation, and read-only historical details.
- Add renewed filtering without mixing renewed loans into active collections.

### Phase 5 — Focused Playwright verification

Write and run focused Playwright tests for:

- Each of the four old/new interest combinations
- Paid, capitalized, and waived old interest
- Separate display of refinanced debt and additional cash released
- Old loan becoming read-only and excluded from active totals
- Bidirectional navigation between old and new loans
- Duplicate renewal and concurrent-change rejection
- Transaction rollback when new-loan creation fails

Capture before/after screenshots of the same loan-detail view and the renewal confirmation/result. Save the required verification report and screenshots in the Obsidian vault under:

```text
D:\Submit\Obsidian Vault\Reports\<YYYY-MM-DD>-loan-renewal.md
D:\Submit\Obsidian Vault\Reports\attachments\<YYYY-MM-DD>-loan-renewal\
```

## Acceptance Criteria

- Renewing a loan produces exactly one new loan and closes exactly one old loan.
- The old loan's ledger, terms, and settlement snapshot remain intact and read-only.
- The new loan uses its own explicitly confirmed interest terms.
- Unpaid old interest is always recorded as paid, capitalized, or waived.
- Active balances never count both the old and new loan.
- Capitalized interest and new cash are distinguishable in the UI, database, reports, and exports.
- Failed or repeated requests cannot leave a half-renewed state or duplicate loan.
- Focused Playwright tests pass and the before/after verification report renders correctly in Obsidian.
