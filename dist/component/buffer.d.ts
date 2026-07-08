import { type ClickHouseRow } from "./validators";
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
export declare const insert: import("convex/server").RegisteredMutation<"public", {
    rows: Record<string, any>[];
    table: string;
}, Promise<number>>;
/**
 * Get pending events ready to flush, up to a batch limit.
 * Marks them as "flushing" to prevent double-processing.
 */
export declare const claimBatch: import("convex/server").RegisteredMutation<"internal", {
    limit: number;
    table?: string | undefined;
}, Promise<{
    id: ({
        _creationTime: number;
        _id: import("convex/values").GenericId<"buffer">;
        createdAt: number;
        data: Record<string, any>;
        retries: number;
        status: "failed" | "flushing" | "pending";
        table: string;
    }[])[number]["_id"];
    table: string;
    data: ClickHouseRow;
}[]>>;
/**
 * Mark events as successfully flushed (delete them from buffer).
 */
export declare const markFlushed: import("convex/server").RegisteredMutation<"internal", {
    ids: import("convex/values").GenericId<"buffer">[];
}, Promise<null>>;
/**
 * Mark events as failed, incrementing retry count.
 * Events exceeding max retries stay in "failed" state for manual review.
 */
export declare const markFailed: import("convex/server").RegisteredMutation<"internal", {
    ids: import("convex/values").GenericId<"buffer">[];
    maxRetries: number;
}, Promise<null>>;
/**
 * Log a flush result for monitoring.
 */
export declare const logFlush: import("convex/server").RegisteredMutation<"internal", {
    durationMs: number;
    error?: string | undefined;
    rowCount: number;
    status: "failed" | "success";
    table: string;
}, Promise<null>>;
/**
 * Get buffer stats for monitoring.
 */
export declare const getBufferStats: import("convex/server").RegisteredQuery<"public", {}, Promise<{
    pending: number;
    flushing: number;
    failed: number;
}>>;
/**
 * Get recent flush logs for monitoring.
 */
export declare const getFlushLogs: import("convex/server").RegisteredQuery<"public", {
    limit?: number | undefined;
}, Promise<{
    table: string;
    rowCount: number;
    status: "failed" | "success";
    durationMs: number;
    error: string | undefined;
    createdAt: number;
}[]>>;
/**
 * Register a ClickHouse table in the registry.
 */
export declare const registerTable: import("convex/server").RegisteredMutation<"public", {
    ddl?: string | undefined;
    description?: string | undefined;
    name: string;
}, Promise<null>>;
/**
 * List all registered ClickHouse tables.
 */
export declare const listTables: import("convex/server").RegisteredQuery<"public", {}, Promise<{
    name: string;
    ddl: string | undefined;
    description: string | undefined;
    createdAt: number;
}[]>>;
/**
 * Purge old flush logs to prevent unbounded growth.
 * Called periodically via cron or manually.
 */
export declare const purgeLogs: import("convex/server").RegisteredMutation<"public", {
    olderThanMs: number;
}, Promise<number>>;
/**
 * Retry failed events by resetting them to pending.
 */
export declare const retryFailed: import("convex/server").RegisteredMutation<"public", {
    limit: number;
    table?: string | undefined;
}, Promise<number>>;
//# sourceMappingURL=buffer.d.ts.map