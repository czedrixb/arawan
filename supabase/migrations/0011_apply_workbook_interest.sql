-- The workbook's % column is the monetary interest charged per loan. Keep
-- the raw value in legacy_percent_value for traceability and apply it to the
-- workbook-seeded loans so balances and summaries include the interest.
update public.loans
set
  interest_mode = 'added',
  interest_centavos = legacy_percent_value,
  total_payable_centavos = principal_centavos + legacy_percent_value
where source_sequence is not null
  and principal_centavos is not null
  and legacy_percent_value is not null
  and legacy_percent_value > 0;
