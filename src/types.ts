import type {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
  FunctionReference,
} from "convex/server";

// Convenient types for `ctx` args, that only include the bare minimum.
export type RunQueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;

export type RunMutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;

export type RunActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;

/**
 * ClickHouse connection credentials.
 * Since Convex components cannot access process.env,
 * these must be passed from the app layer.
 */
export interface ClickHouseCredentials {
  /** ClickHouse HTTP API URL (e.g. https://abc123.clickhouse.cloud:8443) */
  url: string;
  /** ClickHouse user (e.g. "default") */
  user: string;
  /** ClickHouse password */
  password: string;
}

/**
 * Configuration for the ClickHouse client.
 */
export interface ClickHouseConfig {
  /**
   * A function that returns ClickHouse credentials at call time.
   * This is a function (not a static value) so credentials can
   * be read from process.env at invocation time in the app layer.
   */
  credentials: () => ClickHouseCredentials;

  /**
   * Maximum number of events to flush in a single batch.
   * @default 500
   */
  batchSize?: number;

  /**
   * Maximum number of retries before marking an event as permanently failed.
   * @default 5
   */
  maxRetries?: number;
}

/**
 * Flush log entry returned by getFlushLogs().
 */
export interface FlushLogEntry {
  table: string;
  rowCount: number;
  status: "success" | "failed";
  durationMs: number;
  error?: string;
  createdAt: number;
}

/**
 * Buffer statistics returned by getBufferStats().
 */
export interface BufferStats {
  pending: number;
  flushing: number;
  failed: number;
}

/**
 * Table registry entry returned by listTables().
 */
export interface TableEntry {
  name: string;
  ddl?: string;
  description?: string;
  createdAt: number;
}
