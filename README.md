# @devwithbobby/clickhouse

Convex component for buffering analytics events in Convex and flushing them to ClickHouse Cloud over the ClickHouse HTTP API.

## Demo

Live demo: https://robertalv.github.io/clickhouse/

The demo is a static example site. It does not collect credentials or connect to a shared ClickHouse account. Users bring their own Convex deployment and ClickHouse HTTP credentials.

Run it locally:

```sh
npm install
npm run demo:dev
```

## Install

```sh
npm install @devwithbobby/clickhouse
```

Mount the component in `convex/convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import clickhouse from "@devwithbobby/clickhouse/convex.config.js";

const app = defineApp();
app.use(clickhouse);

export default app;
```

## Use

Create a small app-local wrapper so credentials stay in your application environment:

```ts
// convex/clickhouse.ts
import { ClickHouse } from "@devwithbobby/clickhouse";
import { components } from "./_generated/api";

export const clickhouse = new ClickHouse(components.clickhouse, {
  credentials: () => ({
    url: process.env.CLICKHOUSE_URL!,
    user: process.env.CLICKHOUSE_USER!,
    password: process.env.CLICKHOUSE_PASSWORD!,
  }),
  batchSize: 500,
  maxRetries: 5,
});
```

Buffer rows from a mutation:

```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { clickhouse } from "./clickhouse";

export const trackEvent = mutation({
  args: {
    workspaceId: v.string(),
    event: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await clickhouse.insert(ctx, "events", [
      {
        workspace_id: args.workspaceId,
        event: args.event,
        created_at: Date.now(),
      },
    ]);
    return null;
  },
});
```

Flush from an action, usually called by a cron or scheduler:

```ts
import { v } from "convex/values";
import { action } from "./_generated/server";
import { clickhouse } from "./clickhouse";

export const flushClickHouse = action({
  args: {},
  returns: v.object({
    flushed: v.number(),
    failed: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx) => {
    return await clickhouse.flush(ctx);
  },
});
```

Run read-only analytics queries from actions:

```ts
const rows = await clickhouse.query<{ count: number }>(
  ctx,
  "SELECT count() AS count FROM events",
);
```

## Table Names and Queries

Table names are validated and quoted before ClickHouse inserts. Valid table names look like `events` or `analytics.events`.

`query()` only accepts read-style statements beginning with `SELECT`, `WITH`, `SHOW`, `DESCRIBE`, `DESC`, or `EXPLAIN`.

## Component Testing

This package exports a test helper for `convex-test`:

```ts
import { convexTest } from "convex-test";
import clickhouseTest from "@devwithbobby/clickhouse/test";

const t = convexTest();
clickhouseTest.register(t);
```

## Publishing Checklist

Before publishing:

```sh
npm install
npm run codegen
npm run check-types
npm run build
npm test
npm pack --dry-run
```

Then publish:

```sh
npm publish --access public
```
