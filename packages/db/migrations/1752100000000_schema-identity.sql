-- Up Migration

-- Identity hint (@id / url / name) used to match schema entities across crawls
-- so property-level change detection can distinguish "modified" from add+remove.
ALTER TABLE schema_entities ADD COLUMN identity text;

-- Rich-result rollups query rich_results as JSONB arrays; a GIN index keeps the
-- containment filters used by coverage/eligibility summaries off full scans.
CREATE INDEX idx_schema_rich_results ON schema_entities USING gin (rich_results jsonb_path_ops);

-- Down Migration

DROP INDEX IF EXISTS idx_schema_rich_results;
ALTER TABLE schema_entities DROP COLUMN IF EXISTS identity;
