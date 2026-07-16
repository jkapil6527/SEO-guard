-- Up Migration

CREATE EXTENSION IF NOT EXISTS citext;

-- ========== identity & access ==========
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          citext UNIQUE NOT NULL,
  password_hash  text NOT NULL,
  name           text NOT NULL,
  is_super_admin boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id      uuid NOT NULL,
  token_hash     text NOT NULL,
  expires_at     timestamptz NOT NULL,
  revoked_at     timestamptz,
  replaced_by_id uuid REFERENCES refresh_tokens(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);

CREATE TYPE project_role AS ENUM ('admin','seo_manager','developer','viewer');

CREATE TABLE projects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       citext UNIQUE NOT NULL,
  settings   jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       project_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_project_members_user ON project_members (user_id);

-- ========== websites, sources, schedules ==========
CREATE TABLE websites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  origin      text NOT NULL,
  path_scope  text NOT NULL DEFAULT '/',
  settings    jsonb NOT NULL DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, origin, path_scope)
);

CREATE TYPE url_source_type AS ENUM ('manual','csv','sitemap','discovery');

CREATE TABLE url_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  type        url_source_type NOT NULL,
  config      jsonb NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_url_sources_website ON url_sources (website_id);

CREATE TABLE schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  cron        text NOT NULL,
  timezone    text NOT NULL DEFAULT 'Asia/Kolkata',
  mode        text NOT NULL DEFAULT 'incremental' CHECK (mode IN ('full','incremental')),
  is_active   boolean NOT NULL DEFAULT true,
  next_run_at timestamptz,
  last_fired_at timestamptz,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_schedules_website ON schedules (website_id);
CREATE INDEX idx_schedules_active ON schedules (is_active) WHERE is_active;

-- ========== crawls & pages (populated from Phase 3; schema is part of the contract) ==========
CREATE TYPE crawl_status AS ENUM
  ('queued','resolving','running','paused','finalizing','completed','failed','cancelled');
CREATE TYPE crawl_trigger AS ENUM ('manual','scheduled','api');

CREATE TABLE crawls (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id        uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  status            crawl_status NOT NULL DEFAULT 'queued',
  trigger           crawl_trigger NOT NULL,
  mode              text NOT NULL CHECK (mode IN ('full','incremental')),
  rule_pack_version text NOT NULL DEFAULT '',
  stats             jsonb NOT NULL DEFAULT '{}',
  started_at        timestamptz,
  finished_at       timestamptz,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crawls_site_time ON crawls (website_id, created_at DESC);

CREATE TABLE pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  url           text NOT NULL,
  url_hash      bytea NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  is_deleted    boolean NOT NULL DEFAULT false,
  UNIQUE (website_id, url_hash)
);
CREATE INDEX idx_pages_site_url ON pages (website_id, url text_pattern_ops);

-- ========== snapshot tables (monthly partitions) ==========
CREATE TABLE page_snapshots (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  crawl_id       uuid NOT NULL,
  page_id        uuid NOT NULL,
  website_id     uuid NOT NULL,
  fetch_status   text NOT NULL CHECK (fetch_status IN ('ok','unchanged','redirected','error','carried_forward')),
  http_status    int,
  redirect_chain jsonb,
  content_hash   bytea,
  artifacts      jsonb,
  score          numeric(5,2),
  issue_counts   jsonb NOT NULL DEFAULT '{}',
  timing_ms      jsonb,
  rendered       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_snap_crawl ON page_snapshots (crawl_id, page_id);
CREATE INDEX idx_snap_page_time ON page_snapshots (page_id, created_at DESC);

CREATE TYPE issue_severity AS ENUM ('critical','high','medium','low','info');

CREATE TABLE page_issues (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  crawl_id      uuid NOT NULL,
  snapshot_id   uuid NOT NULL,
  page_id       uuid NOT NULL,
  website_id    uuid NOT NULL,
  check_id      text NOT NULL,
  severity      issue_severity NOT NULL,
  fingerprint   bytea NOT NULL,
  evidence      jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_issues_crawl_sev ON page_issues (crawl_id, severity, check_id);
CREATE INDEX idx_issues_fp ON page_issues (fingerprint, created_at DESC);

CREATE TABLE schema_entities (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  crawl_id       uuid NOT NULL,
  snapshot_id    uuid NOT NULL,
  page_id        uuid NOT NULL,
  website_id     uuid NOT NULL,
  format         text NOT NULL CHECK (format IN ('json-ld','microdata','rdfa')),
  schema_type    text NOT NULL,
  status         text NOT NULL CHECK (status IN ('valid','warnings','errors','invalid_json')),
  properties     jsonb NOT NULL,
  validation     jsonb NOT NULL,
  rich_results   jsonb,
  entity_hash    bytea NOT NULL,
  confidence     numeric(4,3),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_schema_crawl_type ON schema_entities (crawl_id, schema_type, status);

CREATE TABLE crawl_changes (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  crawl_id      uuid NOT NULL,
  website_id    uuid NOT NULL,
  page_id       uuid,
  change_type   text NOT NULL,
  severity      issue_severity NOT NULL,
  before        jsonb,
  after         jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_changes_crawl ON crawl_changes (crawl_id, change_type, severity);

-- ========== check catalog & overrides ==========
CREATE TABLE checks (
  id               text PRIMARY KEY,
  category         text NOT NULL,
  default_severity issue_severity NOT NULL,
  default_weight   numeric(5,2) NOT NULL,
  title            text NOT NULL,
  description      text NOT NULL,
  seo_impact       text NOT NULL,
  business_impact  text NOT NULL,
  suggested_fix    text NOT NULL,
  doc_url          text,
  is_active        boolean NOT NULL DEFAULT true
);

CREATE TABLE project_check_overrides (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  check_id   text NOT NULL REFERENCES checks(id),
  severity   issue_severity,
  weight     numeric(5,2),
  is_enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (project_id, check_id)
);

-- ========== issue workflow ==========
CREATE TYPE issue_workflow_status AS ENUM ('open','acknowledged','in_progress','fixed','ignored','regressed');

CREATE TABLE issue_states (
  fingerprint         bytea PRIMARY KEY,
  website_id          uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  check_id            text NOT NULL,
  status              issue_workflow_status NOT NULL DEFAULT 'open',
  assignee_id         uuid REFERENCES users(id),
  tags                text[] NOT NULL DEFAULT '{}',
  first_seen_crawl_id uuid NOT NULL,
  last_seen_crawl_id  uuid NOT NULL,
  resolved_crawl_id   uuid,
  updated_by          uuid REFERENCES users(id),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_states_site_status ON issue_states (website_id, status, check_id);

-- ========== aggregates & trends ==========
CREATE TABLE crawl_aggregates (
  crawl_id   uuid PRIMARY KEY,
  website_id uuid NOT NULL,
  seo_score  numeric(5,2) NOT NULL,
  metrics    jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trend_daily (
  website_id uuid NOT NULL,
  day        date NOT NULL,
  crawl_id   uuid NOT NULL,
  seo_score  numeric(5,2) NOT NULL,
  metrics    jsonb NOT NULL,
  PRIMARY KEY (website_id, day)
);

CREATE TABLE duplicate_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id   uuid NOT NULL,
  website_id uuid NOT NULL,
  field      text NOT NULL,
  value_hash bytea NOT NULL,
  sample     text,
  page_ids   uuid[] NOT NULL,
  page_count int NOT NULL
);
CREATE INDEX idx_dups_crawl ON duplicate_groups (crawl_id, field);

-- ========== reports, notifications, AI, audit, settings ==========
CREATE TABLE reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  website_id   uuid,
  type         text NOT NULL,
  format       text NOT NULL,
  params       jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  object_key   text,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE notification_channels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('email','slack','teams','webhook')),
  config     jsonb NOT NULL,
  is_active  boolean NOT NULL DEFAULT true
);

CREATE TABLE notification_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event            text NOT NULL,
  condition        jsonb NOT NULL DEFAULT '{}',
  channel_ids      uuid[] NOT NULL,
  throttle_minutes int NOT NULL DEFAULT 60,
  is_active        boolean NOT NULL DEFAULT true
);

CREATE TABLE notifications_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id    uuid REFERENCES notification_rules(id) ON DELETE SET NULL,
  crawl_id   uuid,
  payload    jsonb NOT NULL,
  status     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_explanations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id      text NOT NULL,
  evidence_hash bytea NOT NULL,
  content       jsonb NOT NULL,
  model         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (check_id, evidence_hash)
);

CREATE TABLE audit_logs (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid,
  project_id uuid,
  action     text NOT NULL,
  entity     text,
  entity_id  text,
  before     jsonb,
  after      jsonb,
  ip         inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_proj_time ON audit_logs (project_id, created_at DESC);

CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== partition maintenance ==========
CREATE OR REPLACE FUNCTION ensure_monthly_partitions(parent regclass, months_ahead int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  start_month date := date_trunc('month', now())::date;
  created     int  := 0;
  m           int;
  from_date   date;
  to_date     date;
  part_name   text;
BEGIN
  FOR m IN 0..months_ahead LOOP
    from_date := (start_month + make_interval(months => m))::date;
    to_date   := (start_month + make_interval(months => m + 1))::date;
    part_name := replace(parent::text, '.', '_') || '_' || to_char(from_date, 'YYYY_MM');
    IF to_regclass(part_name) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF %s FOR VALUES FROM (%L) TO (%L)',
        part_name, parent, from_date, to_date
      );
      created := created + 1;
    END IF;
  END LOOP;
  RETURN created;
END;
$$;

SELECT ensure_monthly_partitions('page_snapshots', 2);
SELECT ensure_monthly_partitions('page_issues', 2);
SELECT ensure_monthly_partitions('schema_entities', 2);
SELECT ensure_monthly_partitions('crawl_changes', 2);

-- Down Migration

DROP FUNCTION IF EXISTS ensure_monthly_partitions(regclass, int);
DROP TABLE IF EXISTS settings, audit_logs, ai_explanations, notifications_log, notification_rules,
  notification_channels, reports, duplicate_groups, trend_daily, crawl_aggregates, issue_states,
  project_check_overrides, checks, crawl_changes, schema_entities, page_issues, page_snapshots,
  pages, crawls, schedules, url_sources, websites, project_members, projects, refresh_tokens,
  users CASCADE;
DROP TYPE IF EXISTS issue_workflow_status, issue_severity, crawl_trigger, crawl_status,
  url_source_type, project_role;
