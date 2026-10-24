-- Keep historical KES 100 requests intact; new test activation requests charge KES 1.
ALTER TABLE mpesa_payments DROP CONSTRAINT IF EXISTS mpesa_activation_fee_check;
ALTER TABLE mpesa_payments ADD CONSTRAINT mpesa_activation_fee_check
  CHECK (purpose <> 'activation' OR amount IN (1, 100));
