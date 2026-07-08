import type { ComponentApi } from "../component/_generated/component.js";
import type {
  RunQueryCtx,
  RunMutationCtx,
  RunActionCtx,
  ClickHouseConfig,
  ClickHouseCredentials,
  FlushLogEntry,
  BufferStats,
  TableEntry,
} from "../types.js";

export type { ClickHouseConfig, ClickHouseCredentials, FlushLogEntry, BufferStats, TableEntry };
export type ClickHouseComponent = ComponentApi;

/**
 * ClickHouse data connector client for Convex.
 *
 * Provides a reliable pipeline for sending analytics events from Convex
 * mutations to ClickHouse Cloud, plus a query interface for reading
 * analytics data back.
 *
 * Usage:
 * ```ts
 * import { ClickHouse } from "@devwithbobby/clickhouse";
 * import { components } from "./_generated/api";
 *
 * export const clickhouse = new ClickHouse(components.clickhouse, {
 *   credentials: () => ({
 *     url: process.env.CLICKHOUSE_URL!,
 *     user: process.env.CLICKHOUSE_USER!,
 *     password: process.env.CLICKHOUSE_PASSWORD!,
 *   }),
 * });
 *
 * // In a mutation:
 * await clickhouse.insert(ctx, "events", [{ workspace_id: "abc", ... }]);
 *
 * // In an action:
 * await clickhouse.flush(ctx);
 * const rows = await clickhouse.query(ctx, "SELECT count() FROM events");
 * ```
 */
export class ClickHouse {
  private readonly component: ClickHouseComponent;
  private readonly config: ClickHouseConfig;

  constructor(component: ClickHouseComponent, config: ClickHouseConfig) {
    if (!component) {
      throw new Error(
        "ClickHouse component reference is required. " +
          "Make sure the component is mounted in your convex.config.ts and use: " +
          "new ClickHouse(components.clickhouse, { ... })",
      );
    }

    if (!component.buffer) {
      throw new Error(
        "Invalid component reference. " +
          "The component may not be properly mounted. " +
          "Ensure the component is correctly mounted in convex.config.ts: " +
          'app.use(clickhouse, { name: "clickhouse" })',
      );
    }

    this.component = component;
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // Write path (mutations — buffer events for later flush)
  // ---------------------------------------------------------------------------

  /**
   * Buffer one or more rows for insertion into a ClickHouse table.
   * Call this from mutations; events are stored in the component's
   * internal buffer and flushed to ClickHouse asynchronously.
   *
   * @param ctx Mutation context (needs runMutation)
   * @param table ClickHouse target table name
   * @param rows Array of row objects (JSON-serializable)
   * @returns Number of rows buffered
   */
  async insert(
    ctx: RunMutationCtx,
    table: string,
    rows: Record<string, unknown>[],
  ): Promise<number> {
    return ctx.runMutation(this.component.buffer.insert, { table, rows });
  }

  // ---------------------------------------------------------------------------
  // Flush path (actions — send buffered events to ClickHouse)
  // ---------------------------------------------------------------------------

  /**
   * Flush buffered events to ClickHouse.
   * Call this from an action (typically via a cron or scheduler).
   *
   * Flow:
   * 1. Claims a batch of pending events from the buffer
   * 2. Sends them to ClickHouse via HTTP API
   * 3. Marks successful events as flushed (deletes from buffer)
   * 4. Marks failed events for retry
   * 5. Logs the flush result for monitoring
   *
   * @param ctx Action context (needs runMutation + runAction)
   * @param table Optional: only flush events for this specific table
   * @returns Summary of the flush operation
   */
  async flush(
    ctx: RunActionCtx,
    table?: string,
  ): Promise<{
    flushed: number;
    failed: number;
    errors: string[];
  }> {
    const batchSize = this.config.batchSize ?? 500;
    const maxRetries = this.config.maxRetries ?? 5;
    const creds = this.config.credentials();

    return ctx.runAction(this.component.actions.flush, {
      url: creds.url,
      user: creds.user,
      password: creds.password,
      table,
      batchSize,
      maxRetries,
    });
  }

  /**
   * Direct insert to ClickHouse (bypasses buffer).
   * Use this from actions when you want immediate delivery
   * and don't need the reliability of the buffer.
   *
   * @param ctx Action context (needs runAction)
   * @param table ClickHouse target table name
   * @param rows Array of row objects
   */
  async directInsert(
    ctx: RunActionCtx,
    table: string,
    rows: Record<string, unknown>[],
  ): Promise<{ success: boolean; error?: string }> {
    const creds = this.config.credentials();
    return ctx.runAction(this.component.actions.directInsert, {
      url: creds.url,
      user: creds.user,
      password: creds.password,
      table,
      rows,
    });
  }

  // ---------------------------------------------------------------------------
  // Read path (actions — query ClickHouse)
  // ---------------------------------------------------------------------------

  /**
   * Execute a read query against ClickHouse.
   * Must be called from an action (uses HTTP fetch).
   *
   * @param ctx Action context (needs runAction)
   * @param sql SQL query string. FORMAT JSON is appended if not present.
   * @returns Parsed query results (the `data` array from ClickHouse JSON response)
   */
  async query<T = Record<string, unknown>>(
    ctx: RunActionCtx,
    sql: string,
  ): Promise<T[]> {
    const creds = this.config.credentials();
    const rows = await ctx.runAction(this.component.actions.queryClickHouse, {
      url: creds.url,
      user: creds.user,
      password: creds.password,
      query: sql,
    });
    return rows as T[];
  }

  // ---------------------------------------------------------------------------
  // Monitoring (queries — reactive buffer stats)
  // ---------------------------------------------------------------------------

  /**
   * Get current buffer statistics (pending, flushing, failed counts).
   * Can be called from queries for reactive dashboard updates.
   */
  async getBufferStats(ctx: RunQueryCtx): Promise<BufferStats> {
    return ctx.runQuery(this.component.buffer.getBufferStats, {});
  }

  /**
   * Get recent flush logs for monitoring.
   * Can be called from queries for reactive dashboard updates.
   */
  async getFlushLogs(
    ctx: RunQueryCtx,
    limit?: number,
  ): Promise<FlushLogEntry[]> {
    return ctx.runQuery(this.component.buffer.getFlushLogs, { limit });
  }

  // ---------------------------------------------------------------------------
  // Table registry
  // ---------------------------------------------------------------------------

  /**
   * Register a ClickHouse table in the component's internal registry.
   * Useful for tracking which tables exist and their DDL.
   */
  async registerTable(
    ctx: RunMutationCtx,
    name: string,
    options?: { ddl?: string; description?: string },
  ): Promise<void> {
    await ctx.runMutation(this.component.buffer.registerTable, {
      name,
      ddl: options?.ddl,
      description: options?.description,
    });
  }

  /**
   * List all registered ClickHouse tables.
   */
  async listTables(ctx: RunQueryCtx): Promise<TableEntry[]> {
    return ctx.runQuery(this.component.buffer.listTables, {});
  }

  // ---------------------------------------------------------------------------
  // Maintenance
  // ---------------------------------------------------------------------------

  /**
   * Retry failed events by resetting them to pending.
   *
   * @param ctx Mutation context
   * @param table Optional: only retry events for this table
   * @param limit Max number of events to retry
   * @returns Number of events reset to pending
   */
  async retryFailed(
    ctx: RunMutationCtx,
    limit: number = 100,
    table?: string,
  ): Promise<number> {
    return ctx.runMutation(this.component.buffer.retryFailed, {
      table,
      limit,
    });
  }

  /**
   * Purge old flush logs to prevent unbounded growth.
   *
   * @param ctx Mutation context
   * @param olderThanMs Delete logs older than this many milliseconds
   * @returns Number of logs deleted
   */
  async purgeLogs(ctx: RunMutationCtx, olderThanMs: number): Promise<number> {
    return ctx.runMutation(this.component.buffer.purgeLogs, { olderThanMs });
  }
}
