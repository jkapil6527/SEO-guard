-- Up Migration

-- Outbound link verification results, deduplicated per crawl (a footer link on
-- 1M pages is checked once). Feeds broken-link issues and redirect-chain checks.
CREATE TABLE link_checks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id      uuid NOT NULL,
  website_id    uuid NOT NULL,
  url           text NOT NULL,
  url_hash      bytea NOT NULL,
  status        int,
  ok            boolean NOT NULL,
  is_internal   boolean NOT NULL DEFAULT false,
  redirect_hops int NOT NULL DEFAULT 0,
  error         text,
  checked_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crawl_id, url_hash)
);
CREATE INDEX idx_link_checks_broken ON link_checks (crawl_id, ok) WHERE NOT ok;

-- Duplicate detection reads (crawl_id, artifact hash) groups; expression
-- indexes keep the finalizer's GROUP BYs off full partition scans.
CREATE INDEX idx_snap_title_hash ON page_snapshots (crawl_id, (artifacts ->> 'titleHash'));
CREATE INDEX idx_snap_desc_hash ON page_snapshots (crawl_id, (artifacts ->> 'descriptionHash'));
CREATE INDEX idx_snap_h1_hash ON page_snapshots (crawl_id, (artifacts ->> 'h1Hash'));

-- A crawl-level failure message for operator visibility (page failures live in snapshots).
ALTER TABLE crawls ADD COLUMN error text;

-- Down Migration

ALTER TABLE crawls DROP COLUMN IF EXISTS error;
DROP INDEX IF EXISTS idx_snap_h1_hash;
DROP INDEX IF EXISTS idx_snap_desc_hash;
DROP INDEX IF EXISTS idx_snap_title_hash;
DROP TABLE IF EXISTS link_checks;
