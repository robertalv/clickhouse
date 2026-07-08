/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.clickhouse`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.buffer.getBufferStats, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    actions: {
      directInsert: FunctionReference<
        "action",
        "internal",
        {
          url: string;
          user: string;
          password: string;
          table: string;
          rows: Array<Record<string, any>>;
        },
        { success: boolean; error?: string },
        Name
      >;
      flush: FunctionReference<
        "action",
        "internal",
        {
          url: string;
          user: string;
          password: string;
          table?: string;
          batchSize: number;
          maxRetries: number;
        },
        {
          flushed: number;
          failed: number;
          errors: Array<string>;
        },
        Name
      >;
      queryClickHouse: FunctionReference<
        "action",
        "internal",
        { url: string; user: string; password: string; query: string },
        Array<Record<string, any>>,
        Name
      >;
    };
    buffer: {
      getBufferStats: FunctionReference<
        "query",
        "internal",
        {},
        { pending: number; flushing: number; failed: number },
        Name
      >;
      getFlushLogs: FunctionReference<
        "query",
        "internal",
        { limit?: number },
        Array<{
          table: string;
          rowCount: number;
          status: "success" | "failed";
          durationMs: number;
          error?: string;
          createdAt: number;
        }>,
        Name
      >;
      insert: FunctionReference<
        "mutation",
        "internal",
        { table: string; rows: Array<Record<string, any>> },
        number,
        Name
      >;
      listTables: FunctionReference<
        "query",
        "internal",
        {},
        Array<{
          name: string;
          ddl?: string;
          description?: string;
          createdAt: number;
        }>,
        Name
      >;
      purgeLogs: FunctionReference<
        "mutation",
        "internal",
        { olderThanMs: number },
        number,
        Name
      >;
      registerTable: FunctionReference<
        "mutation",
        "internal",
        { name: string; ddl?: string; description?: string },
        null,
        Name
      >;
      retryFailed: FunctionReference<
        "mutation",
        "internal",
        { table?: string; limit: number },
        number,
        Name
      >;
    };
  };
