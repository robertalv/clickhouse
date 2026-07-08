import { v } from "convex/values";
import {
  clickHouseRowValidator,
  validateClickHouseTableName,
  validatePositiveInteger,
  type ClickHouseRow,
} from "./validators";
import { internalMutation, mutation, query } from "./_generated/server";

/**
 * Buffer management for the ClickHouse data connector.
 *
 * Events are buffered in the component's internal table
 * before being flushed to ClickHouse. This provides reliability
 * -- if ClickHouse is temporarily unreachable, events are retained
 * and retried automatically.
 */

/**
 * Insert one or more events into the buffer.
 * Called from the app's mutations via the ClickHouseClient.
 */
export const insert = mutation({
  args: {
    table: v.string(),
    rows: v.array(clickHouseRowValidator),
  },
  returns: v.number(),
  handler: async (ctx, { table, rows }) => {
    validateClickHouseTableName(table);
    const now = Date.now();
    for (const data of rows) {
      await ctx.db.insert("buffer", {
        table,
        data,
        status: "pending",
        retries: 0,
        createdAt: now,
      });
    }
    return rows.length;
  },
});

/**
 * Get pending events ready to flush, up to a batch limit.
 * Marks them as "flushing" to prevent double-processing.
 */
export const claimBatch = internalMutation({
  args: {
    table: v.optional(v.string()),
    limit: v.number(),
  },
  returns: v.array(
    v.object({
      id: v.id("buffer"),
      table: v.string(),
      data: clickHouseRowValidator,
    }),
  ),
  handler: async (ctx, { table, limit }) => {
    if (table !== undefined) {
      validateClickHouseTableName(table);
    }
    validatePositiveInteger("limit", limit, 1000);

    const docs =
      table === undefined
        ? await ctx.db
            .query("buffer")
            .withIndex("by_status_and_created", (q) =>
              q.eq("status", "pending"),
            )
            .order("asc")
            .take(limit)
        : await ctx.db
            .query("buffer")
            .withIndex("by_table_and_status", (q) =>
              q.eq("table", table).eq("status", "pending"),
            )
            .order("asc")
            .take(limit);

    const result: {
      id: (typeof docs)[number]["_id"];
      table: string;
      data: ClickHouseRow;
    }[] = [];
    for (const doc of docs) {
      await ctx.db.patch("buffer", doc._id, { status: "flushing" });
      result.push({
        id: doc._id,
        table: doc.table,
        data: doc.data,
      });
    }
    return result;
  },
});

/**
 * Mark events as successfully flushed (delete them from buffer).
 */
export const markFlushed = internalMutation({
  args: {
    ids: v.array(v.id("buffer")),
  },
  returns: v.null(),
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      await ctx.db.delete("buffer", id);
    }
    return null;
  },
});

/**
 * Mark events as failed, incrementing retry count.
 * Events exceeding max retries stay in "failed" state for manual review.
 */
export const markFailed = internalMutation({
  args: {
    ids: v.array(v.id("buffer")),
    maxRetries: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { ids, maxRetries }) => {
    validatePositiveInteger("maxRetries", maxRetries, 100);
    for (const id of ids) {
      const doc = await ctx.db.get("buffer", id);
      if (!doc) continue;
      const newRetries = doc.retries + 1;
      await ctx.db.patch("buffer", doc._id, {
        status: newRetries >= maxRetries ? "failed" : "pending",
        retries: newRetries,
      });
    }
    return null;
  },
});

/**
 * Log a flush result for monitoring.
 */
export const logFlush = internalMutation({
  args: {
    table: v.string(),
    rowCount: v.number(),
    status: v.union(v.literal("success"), v.literal("failed")),
    durationMs: v.number(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    validateClickHouseTableName(args.table);
    await ctx.db.insert("flushLog", {
      table: args.table,
      rowCount: args.rowCount,
      status: args.status,
      durationMs: args.durationMs,
      error: args.error,
      createdAt: Date.now(),
    });
    return null;
  },
});

/**
 * Get buffer stats for monitoring.
 */
export const getBufferStats = query({
  args: {},
  returns: v.object({
    pending: v.number(),
    flushing: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("buffer")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const flushing = await ctx.db
      .query("buffer")
      .withIndex("by_status", (q) => q.eq("status", "flushing"))
      .collect();
    const failed = await ctx.db
      .query("buffer")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    return {
      pending: pending.length,
      flushing: flushing.length,
      failed: failed.length,
    };
  },
});

/**
 * Get recent flush logs for monitoring.
 */
export const getFlushLogs = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      table: v.string(),
      rowCount: v.number(),
      status: v.union(v.literal("success"), v.literal("failed")),
      durationMs: v.number(),
      error: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { limit }) => {
    const boundedLimit = limit ?? 50;
    validatePositiveInteger("limit", boundedLimit, 1000);

    const logs = await ctx.db
      .query("flushLog")
      .withIndex("by_created")
      .order("desc")
      .take(boundedLimit);

    return logs.map((l) => ({
      table: l.table,
      rowCount: l.rowCount,
      status: l.status,
      durationMs: l.durationMs,
      error: l.error,
      createdAt: l.createdAt,
    }));
  },
});

/**
 * Register a ClickHouse table in the registry.
 */
export const registerTable = mutation({
  args: {
    name: v.string(),
    ddl: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { name, ddl, description }) => {
    validateClickHouseTableName(name);
    const existing = await ctx.db
      .query("tables")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();

    if (existing) {
      await ctx.db.patch("tables", existing._id, {
        ddl,
        description,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("tables", {
        name,
        ddl,
        description,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

/**
 * List all registered ClickHouse tables.
 */
export const listTables = query({
  args: {},
  returns: v.array(
    v.object({
      name: v.string(),
      ddl: v.optional(v.string()),
      description: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const tables = await ctx.db.query("tables").collect();
    return tables.map((t) => ({
      name: t.name,
      ddl: t.ddl,
      description: t.description,
      createdAt: t.createdAt,
    }));
  },
});

/**
 * Purge old flush logs to prevent unbounded growth.
 * Called periodically via cron or manually.
 */
export const purgeLogs = mutation({
  args: { olderThanMs: v.number() },
  returns: v.number(),
  handler: async (ctx, { olderThanMs }) => {
    validatePositiveInteger("olderThanMs", olderThanMs, Number.MAX_SAFE_INTEGER);
    const cutoff = Date.now() - olderThanMs;
    const oldLogs = await ctx.db
      .query("flushLog")
      .withIndex("by_created", (q) => q.lt("createdAt", cutoff))
      .take(1000);

    for (const log of oldLogs) {
      await ctx.db.delete("flushLog", log._id);
    }
    return oldLogs.length;
  },
});

/**
 * Retry failed events by resetting them to pending.
 */
export const retryFailed = mutation({
  args: { table: v.optional(v.string()), limit: v.number() },
  returns: v.number(),
  handler: async (ctx, { table, limit }) => {
    if (table !== undefined) {
      validateClickHouseTableName(table);
    }
    validatePositiveInteger("limit", limit, 1000);

    const docs =
      table === undefined
        ? await ctx.db
            .query("buffer")
            .withIndex("by_status_and_created", (q) =>
              q.eq("status", "failed"),
            )
            .order("asc")
            .take(limit)
        : await ctx.db
            .query("buffer")
            .withIndex("by_table_and_status", (q) =>
              q.eq("table", table).eq("status", "failed"),
            )
            .order("asc")
            .take(limit);

    for (const doc of docs) {
      await ctx.db.patch("buffer", doc._id, { status: "pending", retries: 0 });
    }
    return docs.length;
  },
});
