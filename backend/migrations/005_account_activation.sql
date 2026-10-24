ALTER TABLE mpesa_payments ADD COLUMN IF NOT EXISTS purpose VARCHAR(16) NOT NULL DEFAULT 'deposit'
  CHECK (purpose IN ('deposit', 'activation'));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mpesa_activation_fee_check' AND conrelid = 'mpesa_payments'::regclass) THEN
    ALTER TABLE mpesa_payments ADD CONSTRAINT mpesa_activation_fee_check CHECK (purpose <> 'activation' OR amount = 100);
  END IF;
END $$;

-- Only one unresolved or successful activation payment per member/environment.
-- Failed/cancelled requests may be retried with a new idempotency key.
CREATE UNIQUE INDEX IF NOT EXISTS mpesa_activation_once_idx ON mpesa_payments (user_id, environment)
  WHERE purpose = 'activation' AND status IN ('initiating', 'pending', 'unknown', 'succeeded');

ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_payment_id UUID UNIQUE REFERENCES mpesa_payments(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_paid_at TIMESTAMPTZ;
