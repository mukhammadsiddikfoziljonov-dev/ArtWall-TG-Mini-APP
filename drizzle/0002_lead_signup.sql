ALTER TABLE users ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'telegram';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

UPDATE users
SET source = CASE
  WHEN telegram_id LIKE 'preview-%' THEN 'preview'
  WHEN telegram_id LIKE 'web:%' THEN 'web'
  ELSE 'telegram'
END;

CREATE INDEX IF NOT EXISTS users_onboarding_completed_idx ON users(onboarding_completed_at);

