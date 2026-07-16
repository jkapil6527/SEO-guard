-- Up Migration

-- Crawl scope: 'site' walks the website's configured sources (or spiders the
-- origin), 'page' visits exactly one URL and never discovers links. Existing
-- rows predate the distinction and were all site-wide.
ALTER TABLE crawls ADD COLUMN scope text NOT NULL DEFAULT 'site'
  CHECK (scope IN ('site', 'page'));

-- The single URL a 'page' crawl targets; null for site crawls, whose URL set is
-- resolved at orchestration time from url_sources.
ALTER TABLE crawls ADD COLUMN target_url text;

ALTER TABLE crawls ADD CONSTRAINT crawls_page_scope_needs_target
  CHECK (scope <> 'page' OR target_url IS NOT NULL);

-- Down Migration

ALTER TABLE crawls DROP CONSTRAINT IF EXISTS crawls_page_scope_needs_target;
ALTER TABLE crawls DROP COLUMN IF EXISTS target_url;
ALTER TABLE crawls DROP COLUMN IF EXISTS scope;
