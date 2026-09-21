CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id text NOT NULL UNIQUE,
  name text NOT NULL,
  username text,
  avatar_url text,
  roles text[] NOT NULL DEFAULT ARRAY['buyer']::text[],
  bio text,
  location text,
  social text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS artworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  medium text NOT NULL,
  year integer NOT NULL CHECK (year BETWEEN 1000 AND 3000),
  width numeric(8,2) NOT NULL CHECK (width > 0),
  height numeric(8,2) NOT NULL CHECK (height > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  available boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS artworks_artist_idx ON artworks(artist_id);
CREATE INDEX IF NOT EXISTS artworks_status_idx ON artworks(status);

CREATE TABLE IF NOT EXISTS artwork_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  object_key text,
  source_url text,
  content_type text,
  byte_size integer,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((object_key IS NOT NULL)::integer + (source_url IS NOT NULL)::integer = 1)
);
CREATE INDEX IF NOT EXISTS artwork_media_artwork_idx ON artwork_media(artwork_id);

CREATE TABLE IF NOT EXISTS likes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artwork_id)
);

CREATE TABLE IF NOT EXISTS basket_items (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artwork_id)
);

CREATE TABLE IF NOT EXISTS saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  object_key text,
  source_url text,
  composition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((object_key IS NOT NULL)::integer + (source_url IS NOT NULL)::integer = 1)
);
CREATE INDEX IF NOT EXISTS saved_views_user_idx ON saved_views(user_id);

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artwork_id uuid REFERENCES artworks(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON analytics_events(name);
CREATE INDEX IF NOT EXISTS analytics_events_artwork_idx ON analytics_events(artwork_id);

CREATE TABLE IF NOT EXISTS platform_limits (
  key text PRIMARY KEY,
  value integer NOT NULL CHECK (value > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_limits (key, value) VALUES
  ('max_artists', 100),
  ('max_buyers', 500),
  ('max_artworks_per_artist', 5),
  ('max_image_bytes', 5242880)
ON CONFLICT (key) DO NOTHING;

