import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { clickHouseRowValidator } from "./validators";

/**
 * ClickHouse Data Connector - Internal Schema
 *
 * This component maintains:
 * 1. An event buffer for reliable delivery to ClickHouse
 * 2. A table registry tracking which ClickHouse tables are configured
 * 3. A flush log for monitoring delivery health
 */
export default defineSchema({
  /**
   * Buffered events waiting to be flushed to ClickHouse.
   * Events are written here by mutations, then an action flushes
   * them in batches. This ensures no data loss if ClickHouse is
   * temporarily unreachable.
   */
  buffer: defineTable({
    table: v.string(), // ClickHouse target table name
    data: clickHouseRowValidator, // Row data (JSON-serializable object)
    status: v.union(
      v.literal("pending"),
      v.literal("flushing"),
      v.literal("failed"),
    ),
    retries: v.number(),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_status_and_created", ["status", "createdAt"])
    .index("by_table_and_status", ["table", "status"]),

  /**
   * Registry of ClickHouse tables managed by this component.
   * Tracks table name, DDL (for documentation), and health status.
   */
  tables: defineTable({
    name: v.string(), // ClickHouse table name
    ddl: v.optional(v.string()), // CREATE TABLE statement for reference
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  /**
   * Flush log - tracks each batch flush attempt for monitoring.
   */
  flushLog: defineTable({
    table: v.string(),
    rowCount: v.number(),
    status: v.union(v.literal("success"), v.literal("failed")),
    durationMs: v.number(),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_table", ["table"])
    .index("by_created", ["createdAt"]),
});
