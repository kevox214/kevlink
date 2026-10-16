CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(100) NOT NULL,
  username VARCHAR(30),
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(16) NOT NULL,
  date_of_birth DATE,
  password_hash VARCHAR(100) NOT NULL,
  referral_code VARCHAR(32),
  personal_referral_code VARCHAR(32),
  role VARCHAR(32) NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin')),
  account_status VARCHAR(32) NOT NULL DEFAULT 'pending_verification'
    CHECK (account_status IN ('pending_verification', 'active', 'suspended', 'restricted')),
  terms_version VARCHAR(32) NOT NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS users ALTER COLUMN date_of_birth DROP NOT NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'user';
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS username VARCHAR(30);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS personal_referral_code VARCHAR(32);
UPDATE users
SET personal_referral_code = UPPER(REPLACE(id::text, '-', ''))
WHERE personal_referral_code IS NULL;
ALTER TABLE IF EXISTS users ALTER COLUMN personal_referral_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON users (LOWER(username)) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_personal_referral_code_unique ON users (personal_referral_code);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions (expires_at);
