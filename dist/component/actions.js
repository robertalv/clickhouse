import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { clickHouseRowValidator, quoteClickHouseTableName, validatePositiveInteger, validateReadOnlyClickHouseQuery, } from "./validators";
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
export const flush = action({
    args: {
        url: v.string(),
        user: v.string(),
        password: v.string(),
        table: v.optional(v.string()),
        batchSize: v.number(),
        maxRetries: v.number(),
    },
    returns: v.object({
        flushed: v.number(),
        failed: v.number(),
        errors: v.array(v.string()),
    }),
    handler: async (ctx, { url, user, password, table, batchSize, maxRetries }) => {
        validatePositiveInteger("batchSize", batchSize, 1000);
        validatePositiveInteger("maxRetries", maxRetries, 100);
        const rows = await ctx.runMutation(internal.buffer.claimBatch, {
            table,
            limit: batchSize,
        });
        if (rows.length === 0) {
            return { flushed: 0, failed: 0, errors: [] };
        }
        const startMs = Date.now();
        // Group rows by target table
        const byTable = new Map();
        for (const row of rows) {
            const group = byTable.get(row.table) ?? { ids: [], data: [] };
            group.ids.push(row.id);
            group.data.push(row.data);
            byTable.set(row.table, group);
        }
        const succeeded = [];
        const failed = [];
        const errors = [];
        for (const [table, group] of byTable) {
            try {
                const query = `INSERT INTO ${quoteClickHouseTableName(table)} FORMAT JSONEachRow`;
                const body = group.data.map((r) => JSON.stringify(r)).join("\n");
                const res = await fetch(`${url}/?query=${encodeURIComponent(query)}`, {
                    method: "POST",
                    headers: {
                        "X-ClickHouse-User": user,
                        "X-ClickHouse-Key": password,
                    },
                    body,
                });
                if (res.ok) {
                    succeeded.push(...group.ids);
                }
                else {
                    const text = await res.text();
                    failed.push(...group.ids);
                    errors.push(`Table ${table}: ${res.status} - ${text.slice(0, 500)}`);
                }
            }
            catch (e) {
                failed.push(...group.ids);
                errors.push(`Table ${table}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        if (succeeded.length > 0) {
            await ctx.runMutation(internal.buffer.markFlushed, {
                ids: succeeded,
            });
        }
        if (failed.length > 0) {
            await ctx.runMutation(internal.buffer.markFailed, {
                ids: failed,
                maxRetries,
            });
        }
        const durationMs = Date.now() - startMs;
        for (const [table, group] of byTable) {
            const tableSucceeded = group.ids.filter((id) => succeeded.includes(id)).length;
            const tableFailed = group.ids.length - tableSucceeded;
            await ctx.runMutation(internal.buffer.logFlush, {
                table,
                rowCount: group.ids.length,
                status: tableFailed > 0 ? "failed" : "success",
                durationMs,
                error: tableFailed > 0
                    ? errors.find((e) => e.startsWith(`Table ${table}:`))
                    : undefined,
            });
        }
        return { flushed: succeeded.length, failed: failed.length, errors };
    },
});
/**
 * Execute a read query against ClickHouse and return results.
 * Used by the app to power analytics dashboards.
 */
export const queryClickHouse = action({
    args: {
        url: v.string(),
        user: v.string(),
        password: v.string(),
        query: v.string(),
    },
    returns: v.array(clickHouseRowValidator),
    handler: async (_ctx, { url, user, password, query: sql }) => {
        validateReadOnlyClickHouseQuery(sql);
        const fullQuery = /\bFORMAT\b/i.test(sql) ? sql : `${sql} FORMAT JSON`;
        const res = await fetch(`${url}/?query=${encodeURIComponent(fullQuery)}`, {
            method: "GET",
            headers: {
                "X-ClickHouse-User": user,
                "X-ClickHouse-Key": password,
            },
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`ClickHouse query failed: ${res.status} - ${text.slice(0, 500)}`);
        }
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : json;
        if (!Array.isArray(data)) {
            throw new ConvexError({
                code: "INVALID_CLICKHOUSE_RESPONSE",
                message: "ClickHouse query did not return an array of rows.",
            });
        }
        return data.map((row) => {
            if (row === null || typeof row !== "object" || Array.isArray(row)) {
                throw new ConvexError({
                    code: "INVALID_CLICKHOUSE_RESPONSE",
                    message: "ClickHouse query returned a non-object row.",
                });
            }
            return row;
        });
    },
});
/**
 * Direct insert to ClickHouse (bypasses buffer).
 * For fire-and-forget writes where buffering isn't needed.
 */
export const directInsert = action({
    args: {
        url: v.string(),
        user: v.string(),
        password: v.string(),
        table: v.string(),
        rows: v.array(clickHouseRowValidator),
    },
    returns: v.object({
        success: v.boolean(),
        error: v.optional(v.string()),
    }),
    handler: async (_ctx, { url, user, password, table, rows }) => {
        try {
            const query = `INSERT INTO ${quoteClickHouseTableName(table)} FORMAT JSONEachRow`;
            const body = rows.map((r) => JSON.stringify(r)).join("\n");
            const res = await fetch(`${url}/?query=${encodeURIComponent(query)}`, {
                method: "POST",
                headers: {
                    "X-ClickHouse-User": user,
                    "X-ClickHouse-Key": password,
                },
                body,
            });
            if (res.ok) {
                return { success: true };
            }
            const text = await res.text();
            return { success: false, error: `${res.status}: ${text.slice(0, 500)}` };
        }
        catch (e) {
            return {
                success: false,
                error: e instanceof Error ? e.message : String(e),
            };
        }
    },
});
//# sourceMappingURL=actions.js.map