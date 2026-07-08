-- ClickHouse Cloud DDL for Convex Analytics
-- Run this in your ClickHouse Cloud console to create the required tables.
--
-- Engine: ReplacingMergeTree (idempotent re-inserts, deduplication by activity_id)
-- Partition: Monthly by created_at for efficient time-range pruning
-- Order: (workspace_id, entity_type, action, created_at) for the most common query patterns

CREATE TABLE IF NOT EXISTS activity_events
(
    -- Identity
    activity_id       String,           -- Convex document ID (e.g., "k57abc...")
    workspace_id      String,           -- Convex workspace document ID

    -- Event classification
    entity_type       LowCardinality(String),  -- 'task', 'note', 'meeting', etc.
    entity_id         String,           -- Convex document ID of the entity
    action            LowCardinality(String),  -- 'created', 'status_changed', 'assigned', etc.

    -- Actor
    actor_id          String,           -- authUserId of the person who performed the action

    -- Relationships
    parent_id         Nullable(String), -- Parent activity (for threaded comments)
    mentions          Array(String),    -- Array of mentioned authUserIds

    -- Structured metadata (flattened for efficient querying)
    metadata_field     Nullable(String), -- Field that changed (e.g., 'status', 'priority')
    metadata_old_value Nullable(String), -- Previous value
    metadata_new_value Nullable(String), -- New value
    metadata_comment   Nullable(String), -- Comment text (if action is 'commented')

    -- Timestamp
    created_at        Int64             -- Unix timestamp in milliseconds
)
ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(fromUnixTimestamp64Milli(created_at))
ORDER BY (workspace_id, entity_type, action, created_at, activity_id)
SETTINGS index_granularity = 8192;

-- Recommended materialized views / projections for common query patterns:

-- 1. Activity timeline (events per day per workspace)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_activity_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (workspace_id, entity_type, action, day)
AS
SELECT
    workspace_id,
    entity_type,
    action,
    toDate(fromUnixTimestamp64Milli(created_at)) AS day,
    count() AS event_count
FROM activity_events
GROUP BY workspace_id, entity_type, action, day;

-- 2. Productivity by actor (events per actor per day)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_productivity_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (workspace_id, actor_id, action, day)
AS
SELECT
    workspace_id,
    actor_id,
    action,
    toDate(fromUnixTimestamp64Milli(created_at)) AS day,
    count() AS event_count
FROM activity_events
GROUP BY workspace_id, actor_id, action, day;

-- 3. Status transitions (from -> to counts per workspace)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_status_transitions
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (workspace_id, from_status, to_status, day)
AS
SELECT
    workspace_id,
    coalesce(metadata_old_value, '') AS from_status,
    coalesce(metadata_new_value, '') AS to_status,
    toDate(fromUnixTimestamp64Milli(created_at)) AS day,
    count() AS transition_count
FROM activity_events
WHERE entity_type = 'task'
  AND action = 'status_changed'
  AND metadata_old_value IS NOT NULL
  AND metadata_new_value IS NOT NULL
GROUP BY workspace_id, from_status, to_status, day;

-- =========================================================================
-- Record & Workspace Aggregation Views
-- =========================================================================

-- 4. Records per action per day per workspace
--    Enables: "Records created over time", "Record activity breakdown"
--    Filtered to entity_type = 'record' for efficient reads
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_records_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (workspace_id, action, day)
AS
SELECT
    workspace_id,
    action,
    toDate(fromUnixTimestamp64Milli(created_at)) AS day,
    count() AS event_count
FROM activity_events
WHERE entity_type = 'record'
GROUP BY workspace_id, action, day;

-- 5. Entity summary per workspace per day (all entity types)
--    Enables: cross-entity comparison (tasks vs records vs meetings over time)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_entity_summary_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (workspace_id, entity_type, day)
AS
SELECT
    workspace_id,
    entity_type,
    toDate(fromUnixTimestamp64Milli(created_at)) AS day,
    count() AS event_count
FROM activity_events
GROUP BY workspace_id, entity_type, day;

-- 6. Workspace activity ranking (total events per workspace per day)
--    Enables: admin "most active workspaces" leaderboard
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_workspace_activity_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (workspace_id, day)
AS
SELECT
    workspace_id,
    toDate(fromUnixTimestamp64Milli(created_at)) AS day,
    count() AS event_count
FROM activity_events
GROUP BY workspace_id, day;

-- =========================================================================
-- Platform Daily Snapshots (populated by cron, queried by admin dashboard)
-- =========================================================================
-- This table stores a daily snapshot of key platform metrics.
-- A cron job inserts one row per day. ReplacingMergeTree deduplicates by day
-- if the cron runs more than once.

CREATE TABLE IF NOT EXISTS platform_daily_snapshots
(
    day                Date,
    total_users        UInt64,
    total_workspaces   UInt64,
    total_records      UInt64,
    total_tasks        UInt64,
    total_messages     UInt64,
    total_sessions     UInt64,
    active_pro_count   UInt32,
    trialing_count     UInt32,
    canceled_count     UInt32,
    free_count         UInt32,
    mrr_cents          UInt64,
    total_input_tokens UInt64,
    total_output_tokens UInt64,
    snapshot_at        Int64             -- Unix ms when snapshot was taken
)
ENGINE = ReplacingMergeTree(snapshot_at)
ORDER BY day
SETTINGS index_granularity = 8192;

-- =========================================================================
-- Entity Snapshots (contributing data for reports)
-- =========================================================================
-- Stores the current state of every entity (task, record, meeting) so that
-- reports can drill down from aggregated metrics into the raw rows that
-- produced them.
--
-- Engine: ReplacingMergeTree(_version) — each update writes a new row with
--   a higher _version; ClickHouse deduplicates by ORDER BY key, keeping
--   the row with the highest _version.
--
-- Soft-deletes: set is_deleted = 1 with a new _version so the row is
--   logically removed but deduplication still works.
--
-- field_values: Map(String, String) stores arbitrary key-value pairs so we
--   can handle tasks (fixed schema) and records (dynamic objectType fields)
--   uniformly.

CREATE TABLE IF NOT EXISTS entity_snapshots
(
    -- Identity
    workspace_id      String,
    entity_type       LowCardinality(String),  -- 'task', 'record', 'meeting'
    entity_id         String,                   -- Convex document ID

    -- Common indexed columns (denormalized for fast WHERE/ORDER BY)
    title             String        DEFAULT '',
    status            LowCardinality(String) DEFAULT '',
    priority          LowCardinality(String) DEFAULT '',

    -- Relationships
    object_type_id    Nullable(String),         -- only for entity_type = 'record'
    assigned_to       Array(String)  DEFAULT [], -- assignees / attendees

    -- Dynamic field values (key → stringified value)
    field_values      Map(String, String),

    -- Lifecycle
    is_deleted        UInt8         DEFAULT 0,
    created_at        Int64,                    -- Unix ms — entity creation time
    updated_at        Int64,                    -- Unix ms — snapshot write time

    -- Deduplication version (epoch ms of the mutation that wrote this snapshot)
    _version          Int64
)
ENGINE = ReplacingMergeTree(_version)
PARTITION BY toYYYYMM(fromUnixTimestamp64Milli(created_at))
ORDER BY (workspace_id, entity_type, entity_id)
SETTINGS index_granularity = 8192;
