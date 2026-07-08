/// <reference types="vite/client" />

import { afterEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./component/schema";
import { api } from "./component/_generated/api";

const modules = import.meta.glob("./component/**/*.ts");

function initConvexTest() {
  return convexTest(schema, modules);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ClickHouse component", () => {
  test("buffers and flushes rows", async () => {
    const t = initConvexTest();
    const fetchMock = vi.fn(async () => new Response("OK", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await t.mutation(api.buffer.insert, {
      table: "events",
      rows: [{ event: "signup", count: 1 }],
    });

    expect(await t.query(api.buffer.getBufferStats, {})).toEqual({
      pending: 1,
      flushing: 0,
      failed: 0,
    });

    await expect(
      t.action(api.actions.flush, {
        url: "https://clickhouse.example",
        user: "default",
        password: "secret",
        batchSize: 10,
        maxRetries: 3,
      }),
    ).resolves.toEqual({ flushed: 1, failed: 0, errors: [] });

    expect(await t.query(api.buffer.getBufferStats, {})).toEqual({
      pending: 0,
      flushing: 0,
      failed: 0,
    });

    const logs = await t.query(api.buffer.getFlushLogs, {});
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      table: "events",
      rowCount: 1,
      status: "success",
    });
  });

  test("flushes only the requested table", async () => {
    const t = initConvexTest();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("OK", { status: 200 })));

    await t.mutation(api.buffer.insert, {
      table: "events",
      rows: [{ event: "signup" }],
    });
    await t.mutation(api.buffer.insert, {
      table: "analytics.page_views",
      rows: [{ path: "/" }],
    });

    await expect(
      t.action(api.actions.flush, {
        url: "https://clickhouse.example",
        user: "default",
        password: "secret",
        table: "analytics.page_views",
        batchSize: 10,
        maxRetries: 3,
      }),
    ).resolves.toMatchObject({ flushed: 1, failed: 0 });

    expect(await t.query(api.buffer.getBufferStats, {})).toEqual({
      pending: 1,
      flushing: 0,
      failed: 0,
    });
  });

  test("rejects invalid table names", async () => {
    const t = initConvexTest();

    await expect(
      t.mutation(api.buffer.insert, {
        table: "events;DROP TABLE users",
        rows: [{ event: "signup" }],
      }),
    ).rejects.toThrow("Invalid ClickHouse table name");
  });

  test("rejects write statements in query action", async () => {
    const t = initConvexTest();

    await expect(
      t.action(api.actions.queryClickHouse, {
        url: "https://clickhouse.example",
        user: "default",
        password: "secret",
        query: "DROP TABLE events",
      }),
    ).rejects.toThrow("Only read-only ClickHouse queries");
  });

  test("direct insert quotes table names and sends JSONEachRow", async () => {
    const t = initConvexTest();
    const fetchMock = vi.fn(async () => new Response("OK", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      t.action(api.actions.directInsert, {
        url: "https://clickhouse.example",
        user: "default",
        password: "secret",
        table: "analytics.events",
        rows: [{ event: "signup" }],
      }),
    ).resolves.toEqual({ success: true });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(decodeURIComponent(String(url))).toContain(
      "INSERT INTO `analytics`.`events` FORMAT JSONEachRow",
    );
    expect(init?.body).toBe('{"event":"signup"}');
  });
});
