# Overview Date Filter Implementation Plan

## Objective

Add a date filter to the Overview page so the two existing daily metrics show values for the selected date:

- **Expected today**
- **Actual today**

The filter defaults to the current date in the application's Manila timezone. All other existing Overview data remains unchanged.

## Scope

### Filtered by the selected date

- Rename **Expected today** to **Expected on selected date** when the selected date is not today, and calculate the amount expected on that date.
- Rename **Actual today** to **Actual on selected date** when the selected date is not today, and calculate net payments whose `paid_on` date matches that date.

When today is selected, retain the existing **Expected today** and **Actual today** labels.

### Not filtered

The date filter must not change:

- Principal recorded
- Interest recorded
- Total payable
- Collected this month
- Outstanding today
- Active loans
- Overdue
- Collections, last 6 months
- Recent activity

## User Experience

1. Add one clearly labelled date control near the Overview heading or daily metric cards.
2. Default it to `todayIso()` so the initial screen behaves exactly as it does now.
3. Changing the date refreshes the two daily metrics without navigating away from Overview.
4. Keep the selected date visible while the request is loading.
5. Show the existing error/retry state if the filtered request fails.
6. Make the control usable on both mobile and desktop and give it an accessible label such as **Overview date**.

## API and Calculation Changes

1. Allow `GET /api/overview` to accept an optional `date=YYYY-MM-DD` query parameter.
2. Validate the parameter strictly as a real ISO calendar date. Reject malformed or impossible dates with a client error rather than silently substituting today.
3. When the parameter is absent, use the current Manila date to preserve compatibility.
4. Pass the resolved reporting date into the Overview service instead of calculating `todayIso()` internally.
5. Return `reportingDate`, `expectedOnDateCentavos`, and `collectedOnDateCentavos` for the selected date. Retain the legacy `expectedTodayCentavos` and `collectedTodayCentavos` fields with their original current-Manila-date meaning.
6. Calculate **Actual on selected date** from non-reversed payment entries whose `paid_on` equals the reporting date.
7. Calculate **Expected on selected date** using the existing readiness, remaining-balance, payment-start, collection-weekday, and daily-due rules, evaluated against the reporting date.
8. Keep all non-daily Overview calculations on their existing time basis. In particular, **Collected this month**, **Outstanding today**, the six-month chart, and recent activity must not shift with the selected date.

## Important Data Considerations

- A past date will use the current loan summary for eligibility and remaining balance unless the system has historical loan snapshots. The implementation must verify this limitation before claiming that past expected amounts are historically exact.
- Reversals must continue to remove their related payments from the actual amount.
- Date comparisons must use calendar dates in `Asia/Manila` and must not drift because of browser or server timezone conversion.
- A future date can have an expected amount but should normally have zero actual collections.

## Implementation Steps

### 1. API contract

- Add the optional date query parameter to the Overview endpoint.
- Add strict validation and focused unit coverage for valid, missing, malformed, and impossible dates if endpoint-level unit tests exist.
- Update the Overview service signature to receive the selected reporting date.

### 2. Overview calculations

- Replace the daily calculations' use of the implicit current date with the validated reporting date.
- Preserve the current date for metrics that are explicitly outside the filter scope.
- Confirm reversal handling and weekday matching for selected dates.

### 3. Overview interface

- Add the date input and bind it to the Overview request query.
- Update only the two daily labels and values when the date changes.
- Prevent stale responses from overwriting the latest selection if dates are changed quickly.
- Preserve responsive spacing and loading behavior.

### 4. Focused Playwright verification

Create or update one focused Playwright spec for this feature only. It must verify:

- The date filter defaults to today.
- Today's view retains **Expected today** and **Actual today**.
- Selecting a seeded date changes both daily metrics to the correct values and changes their labels to **Expected on selected date** and **Actual on selected date**.
- Reversed payments are excluded from the selected date's actual amount.
- Existing non-daily Overview values do not change when the selected date changes.
- The control works in the directly affected mobile and desktop layouts.

Run only this focused spec and keep fixing the implementation until it passes.

Capture a before/after comparison of the same Overview view using Playwright:

- Before: Overview before the date-filter implementation, preferably from the `main` baseline.
- After: Overview with a non-today date selected and the two updated daily cards visible.

Save the verification report and screenshots at:

```text
D:\Submit\Obsidian Vault\Reports\2026-10-05-overview-date-filter.md
D:\Submit\Obsidian Vault\Reports\attachments\2026-10-05-overview-date-filter\
```

The report must include the implementation summary, exact focused Playwright command and result, the relative-link before/after screenshot table, and any historical-data caveat discovered during implementation.

## Acceptance Criteria

- The Overview contains a date filter that defaults to today's Manila date.
- Only **Expected today** and **Actual today** respond to the selected date.
- Today retains the current labels; another date uses selected-date labels.
- The API validates the date and calculates both metrics consistently in the Manila timezone.
- Actual collections exclude reversed payments.
- Every non-daily Overview metric remains unchanged when the filter changes.
- The focused Playwright test passes on the production build.
- Before/after screenshots and the required Obsidian report are complete and render correctly.

## Pull Request and Production Rollout

1. Implement the work on the dedicated feature branch and keep the PR limited to this date filter, its tests, and related documentation.
2. Run the focused Playwright test against the production build and attach its result plus the verification-report path to the PR description.
3. Push the branch and open a pull request against the repository's production branch (`main`, unless the remote configuration shows a different default).
4. Require the PR checks to pass and review the Overview before merging.
5. Merge the PR through the normal repository workflow so the configured production deployment is triggered. Do not apply an unreviewed direct production change.
6. Confirm the production deployment succeeds.
7. Perform a production smoke check on Overview:
   - Today shows the existing daily values and labels.
   - Selecting the verified seeded or known date updates only the two daily cards.
   - Returning to today restores the current daily values and labels.
8. Record the PR URL, merge commit, production deployment result, and smoke-check outcome in the Obsidian verification report.

The task is complete only after the PR is merged, the production deployment succeeds, and the production smoke check passes.
