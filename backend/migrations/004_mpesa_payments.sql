CREATE TABLE IF NOT EXISTS mpesa_payments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  idempotency_key UUID NOT NULL,
  environment VARCHAR(10) NOT NULL CHECK (environment IN ('sandbox', 'production')),
  reference VARCHAR(12) NOT NULL UNIQUE,
  phone VARCHAR(12) NOT NULL CHECK (phone ~ '^254[17][0-9]{8}$'),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 1 AND amount <= 250000 AND amount = TRUNC(amount)),
  currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK (currency = 'KES'),
  status VARCHAR(16) NOT NULL DEFAULT 'initiating'
    CHECK (status IN ('initiating', 'pending', 'unknown', 'succeeded', 'failed')),
  callback_token_hash CHAR(64) NOT NULL,
  merchant_request_id VARCHAR(128),
  checkout_request_id VARCHAR(128),
  result_code INTEGER,
  result_description VARCHAR(1024),
  receipt VARCHAR(32),
  transaction_date VARCHAR(14),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key),
  UNIQUE (environment, checkout_request_id),
  UNIQUE (environment, receipt),
  CHECK (status <> 'succeeded' OR (receipt IS NOT NULL AND result_code = 0 AND transaction_date IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS mpesa_payments_user_created_idx ON mpesa_payments (user_id, created_at DESC);
