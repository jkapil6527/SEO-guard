-- Up Migration

-- A named, independently-crawlable slice of a website — "Model Pages",
-- "Compare Pages", "Specs". This is the object the project dashboard is built
-- from: one card per group.
--
-- It is a first-class table rather than a flag on url_sources because a group
-- owns crawls, health history and a trend of its own, none of which a source row
-- can carry.
CREATE TABLE sitemap_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  name          text NOT NULL,
  slug          citext NOT NULL,
  sitemap_url   text,
  url_source_id uuid REFERENCES url_sources(id) ON DELETE SET NULL,
  is_active     boolean NOT NULL DEFAULT true,
  settings      jsonb NOT NULL DEFAULT '{}',
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id, slug)
);
CREATE INDEX idx_sitemap_groups_website ON sitemap_groups (website_id) WHERE is_active;

-- Crawls become group-scoped. NULL means "whole website", which is exactly the
-- behaviour every existing crawl already has — so this is additive, and nothing
-- currently working changes.
ALTER TABLE crawls ADD COLUMN sitemap_group_id uuid REFERENCES sitemap_groups(id) ON DELETE SET NULL;
ALTER TABLE crawls DROP CONSTRAINT IF EXISTS crawls_scope_check;
ALTER TABLE crawls ADD CONSTRAINT crawls_scope_check CHECK (scope IN ('site', 'page', 'group'));
ALTER TABLE crawls ADD CONSTRAINT crawls_group_scope_needs_group
  CHECK (scope <> 'group' OR sitemap_group_id IS NOT NULL);
CREATE INDEX idx_crawls_group ON crawls (sitemap_group_id, created_at DESC);

-- Page membership is many-to-many: the same URL can legitimately appear in two
-- sitemaps, and `pages` is UNIQUE(website_id, url_hash) — so a page row cannot
-- carry a single group id.
--
-- lastmod comes from the sitemap. The parser already extracts it and the
-- resolver has always thrown it away; persisting it here is what makes a
-- per-category incremental crawl cheap.
CREATE TABLE page_sitemap_groups (
  page_id          uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  sitemap_group_id uuid NOT NULL REFERENCES sitemap_groups(id) ON DELETE CASCADE,
  lastmod          timestamptz,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (page_id, sitemap_group_id)
);
CREATE INDEX idx_psg_group ON page_sitemap_groups (sitemap_group_id);

-- Per-category score history. trend_daily is keyed (website_id, day) — one row
-- per website per day — so it physically cannot hold a trend per category. A
-- parallel table rather than a destructive re-key, so website trends keep working.
CREATE TABLE trend_daily_group (
  sitemap_group_id uuid NOT NULL REFERENCES sitemap_groups(id) ON DELETE CASCADE,
  day              date NOT NULL,
  crawl_id         uuid NOT NULL,
  seo_score        numeric(5,2) NOT NULL,
  metrics          jsonb NOT NULL,
  PRIMARY KEY (sitemap_group_id, day)
);

-- Backfill: every existing sitemap source becomes a group, so nothing that was
-- already configured disappears from the new dashboard.
INSERT INTO sitemap_groups (website_id, name, slug, sitemap_url, url_source_id, created_by)
SELECT s.website_id,
       coalesce(nullif(regexp_replace(split_part(s.config ->> 'sitemapUrl', '?', 1),
                                      '^.*/([^/]+)$', '\1'), ''), 'Sitemap'),
       'sitemap-' || left(replace(s.id::text, '-', ''), 8),
       s.config ->> 'sitemapUrl',
       s.id,
       s.created_by
  FROM url_sources s
 WHERE s.type = 'sitemap';

-- Down Migration

DROP TABLE IF EXISTS trend_daily_group;
DROP TABLE IF EXISTS page_sitemap_groups;
ALTER TABLE crawls DROP CONSTRAINT IF EXISTS crawls_group_scope_needs_group;
DROP INDEX IF EXISTS idx_crawls_group;
ALTER TABLE crawls DROP COLUMN IF EXISTS sitemap_group_id;
ALTER TABLE crawls DROP CONSTRAINT IF EXISTS crawls_scope_check;
ALTER TABLE crawls ADD CONSTRAINT crawls_scope_check CHECK (scope IN ('site', 'page'));
DROP TABLE IF EXISTS sitemap_groups;
