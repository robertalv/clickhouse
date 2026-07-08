import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
/**
 * Register the ClickHouse component with a convex-test instance.
 *
 * @param t - The test instance returned from convexTest().
 * @param name - Component name used by the app's convex.config.ts.
 */
export declare function register(t: TestConvex<SchemaDefinition<GenericSchema, boolean>>, name?: string): void;
declare const _default: {
    register: typeof register;
    schema: SchemaDefinition<{
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
    modules: Record<string, () => Promise<unknown>>;
};
export default _default;
//# sourceMappingURL=test.d.ts.map