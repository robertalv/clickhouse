/**
 * ClickHouse Data Connector - Internal Schema
 *
 * This component maintains:
 * 1. An event buffer for reliable delivery to ClickHouse
 * 2. A table registry tracking which ClickHouse tables are configured
 * 3. A flush log for monitoring delivery health
 */
declare const _default: import("convex/server").SchemaDefinition<{
    /**
     * Buffered events waiting to be flushed to ClickHouse.
     * Events are written here by mutations, then an action flushes
     * them in batches. This ensures no data loss if ClickHouse is
     * temporarily unreachable.
     */
    buffer: import("convex/server").TableDefinition<import("convex/values").VObject<{
        createdAt: number;
        data: Record<string, any>;
        retries: number;
        status: "failed" | "flushing" | "pending";
        table: string;
    }, {
        table: import("convex/values").VString<string, "required">;
        data: import("convex/values").VRecord<Record<string, any>, import("convex/values").VString<string, "required">, import("convex/values").VAny<any, "required", string>, "required", string>;
        status: import("convex/values").VUnion<"failed" | "flushing" | "pending", [import("convex/values").VLiteral<"pending", "required">, import("convex/values").VLiteral<"flushing", "required">, import("convex/values").VLiteral<"failed", "required">], "required", never>;
        retries: import("convex/values").VFloat64<number, "required">;
        createdAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "createdAt" | "data" | "retries" | "status" | "table" | `data.${string}`>, {
        by_status: ["status", "_creationTime"];
        by_status_and_created: ["status", "createdAt", "_creationTime"];
        by_table_and_status: ["table", "status", "_creationTime"];
    }, {}, {}>;
    /**
     * Registry of ClickHouse tables managed by this component.
     * Tracks table name, DDL (for documentation), and health status.
     */
    tables: import("convex/server").TableDefinition<import("convex/values").VObject<{
        createdAt: number;
        ddl?: string | undefined;
        description?: string | undefined;
        name: string;
        updatedAt: number;
    }, {
        name: import("convex/values").VString<string, "required">;
        ddl: import("convex/values").VString<string | undefined, "optional">;
        description: import("convex/values").VString<string | undefined, "optional">;
        createdAt: import("convex/values").VFloat64<number, "required">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "createdAt" | "ddl" | "description" | "name" | "updatedAt">, {
        by_name: ["name", "_creationTime"];
    }, {}, {}>;
    /**
     * Flush log - tracks each batch flush attempt for monitoring.
     */
    flushLog: import("convex/server").TableDefinition<import("convex/values").VObject<{
        createdAt: number;
        durationMs: number;
        error?: string | undefined;
        rowCount: number;
        status: "failed" | "success";
        table: string;
    }, {
        table: import("convex/values").VString<string, "required">;
        rowCount: import("convex/values").VFloat64<number, "required">;
        status: import("convex/values").VUnion<"failed" | "success", [import("convex/values").VLiteral<"success", "required">, import("convex/values").VLiteral<"failed", "required">], "required", never>;
        durationMs: import("convex/values").VFloat64<number, "required">;
        error: import("convex/values").VString<string | undefined, "optional">;
        createdAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "createdAt" | "durationMs" | "error" | "rowCount" | "status" | "table">, {
        by_created: ["createdAt", "_creationTime"];
        by_table: ["table", "_creationTime"];
    }, {}, {}>;
}, true>;
export default _default;
//# sourceMappingURL=schema.d.ts.map