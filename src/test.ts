/// <reference types="vite/client" />

import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import schema from "./component/schema";

const modules = import.meta.glob([
  "./component/**/*.ts",
  "!./component/**/*.test.ts",
]);

/**
 * Register the ClickHouse component with a convex-test instance.
 *
 * @param t - The test instance returned from convexTest().
 * @param name - Component name used by the app's convex.config.ts.
 */
export function register(
  t: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
  name = "clickhouse",
) {
  t.registerComponent(name, schema, modules);
}

export default { register, schema, modules };
