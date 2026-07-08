import { type ClickHouseRow } from "./validators";
/**
 * ClickHouse HTTP client actions.
 *
 * These actions handle communication with ClickHouse Cloud
 * via its HTTP API. They run in the Node.js runtime for
 * full fetch API support.
 *
 * IMPORTANT: Since components cannot access process.env,
 * connection credentials are passed as arguments from the app.
 */
/**
 * Flush buffered events to ClickHouse.
 *
 * Flow:
 * 1. Claims pending events from the internal buffer
 * 2. Groups events by target table
 * 3. Inserts each group into ClickHouse via HTTP API
 * 4. Marks success/failure and records a flush log
 */
export declare const flush: import("convex/server").RegisteredAction<"public", {
    batchSize: number;
    maxRetries: number;
    password: string;
    table?: string | undefined;
    url: string;
    user: string;
}, Promise<{
    flushed: number;
    failed: number;
    errors: string[];
}>>;
/**
 * Execute a read query against ClickHouse and return results.
 * Used by the app to power analytics dashboards.
 */
export declare const queryClickHouse: import("convex/server").RegisteredAction<"public", {
    password: string;
    query: string;
    url: string;
    user: string;
}, Promise<ClickHouseRow[]>>;
/**
 * Direct insert to ClickHouse (bypasses buffer).
 * For fire-and-forget writes where buffering isn't needed.
 */
export declare const directInsert: import("convex/server").RegisteredAction<"public", {
    password: string;
    rows: Record<string, any>[];
    table: string;
    url: string;
    user: string;
}, Promise<{
    success: boolean;
    error?: undefined;
} | {
    success: boolean;
    error: string;
}>>;
//# sourceMappingURL=actions.d.ts.map