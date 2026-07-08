import { ConvexError, v } from "convex/values";

const CLICKHOUSE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const clickHouseRowValidator = v.record(v.string(), v.any());

export type ClickHouseRow = Record<string, unknown>;

export function validateClickHouseTableName(table: string): void {
  const parts = table.split(".");
  if (parts.length === 0 || parts.length > 2) {
    throwInvalidTableName(table);
  }

  for (const part of parts) {
    if (!CLICKHOUSE_IDENTIFIER.test(part)) {
      throwInvalidTableName(table);
    }
  }
}

export function quoteClickHouseTableName(table: string): string {
  validateClickHouseTableName(table);
  return table
    .split(".")
    .map((part) => `\`${part}\``)
    .join(".");
}

export function validatePositiveInteger(
  name: string,
  value: number,
  max: number,
): void {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `${name} must be an integer between 1 and ${max}.`,
    });
  }
}

export function validateReadOnlyClickHouseQuery(sql: string): void {
  const trimmed = sql.trim().replace(/;+$/, "");
  if (trimmed.includes(";")) {
    throw new ConvexError({
      code: "INVALID_QUERY",
      message: "ClickHouse read queries must contain a single statement.",
    });
  }

  const command = trimmed.match(/^[A-Za-z]+/)?.[0]?.toLowerCase();
  const allowed = new Set([
    "select",
    "with",
    "show",
    "describe",
    "desc",
    "explain",
  ]);

  if (!command || !allowed.has(command)) {
    throw new ConvexError({
      code: "INVALID_QUERY",
      message: "Only read-only ClickHouse queries are allowed through query().",
    });
  }
}

function throwInvalidTableName(table: string): never {
  throw new ConvexError({
    code: "INVALID_TABLE_NAME",
    message:
      `Invalid ClickHouse table name "${table}". ` +
      "Use an identifier like events or analytics.events.",
  });
}
