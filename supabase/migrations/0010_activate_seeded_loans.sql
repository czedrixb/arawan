-- Promote workbook-seeded development rows to complete, unarchived loans.
-- loan_summary derives these rows as active because they are ready,
-- have a positive balance, have started, and are not yet due.
update public.loans
set
  interest_mode = 'none',
  interest_centavos = 0,
  total_payable_centavos = principal_centavos,
  payment_start_on = borrowed_on,
  due_on = date '2099-12-31',
  readiness = 'ready',
  archived_at = null
where source_sequence is not null
  and principal_centavos is not null
  and daily_due_centavos is not null
  and borrowed_on is not null;
