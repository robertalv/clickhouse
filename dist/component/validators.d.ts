export declare const clickHouseRowValidator: import("convex/values").VRecord<Record<string, any>, import("convex/values").VString<string, "required">, import("convex/values").VAny<any, "required", string>, "required", string>;
export type ClickHouseRow = Record<string, unknown>;
export declare function validateClickHouseTableName(table: string): void;
export declare function quoteClickHouseTableName(table: string): string;
export declare function validatePositiveInteger(name: string, value: number, max: number): void;
export declare function validateReadOnlyClickHouseQuery(sql: string): void;
//# sourceMappingURL=validators.d.ts.map