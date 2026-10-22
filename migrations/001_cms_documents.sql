CREATE TABLE IF NOT EXISTS cms_documents (
  environment text NOT NULL CHECK (environment IN ('preview', 'production')),
  collection text NOT NULL CHECK (collection IN ('projects', 'media', 'experience', 'engineering', 'settings')),
  id text NOT NULL CHECK (id ~ '^[A-Za-z0-9_-]+$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  slug text,
  status text CHECK (status IS NULL OR status IN ('draft', 'published', 'archived')),
  sort_order bigint NOT NULL DEFAULT 0,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (environment, collection, id),
  CHECK (id = 'site' OR payload ->> 'id' = id)
);

CREATE UNIQUE INDEX IF NOT EXISTS cms_documents_environment_collection_slug_key
  ON cms_documents (environment, collection, slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS cms_documents_public_listing_idx
  ON cms_documents (environment, collection, status, sort_order, id);
