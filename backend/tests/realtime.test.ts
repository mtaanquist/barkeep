import { describe, it, expect, vi, afterAll } from "vitest";
import request from "supertest";
import { EventEmitter } from "events";
import { createServer, get } from "http";
import type { AddressInfo } from "net";
import type { Request, Response } from "express";
import type { LiveUpdate, Order } from "../../shared/types.js";

import { createRealtime } from "../src/realtime.js";
import {
  makeTestApp,
  cleanUpTempDirs,
  seedBar,
  sessionCookie,
} from "./helpers.js";

afterAll(cleanUpTempDirs);

/**
 * Stands in for a browser holding the connection open. The bar it watches now
 * comes from the session on res.locals, the way attachSession would leave it.
 * Pass null to stand in for someone with no session.
 */
function fakeListener(barId: number | null) {
  const req = new EventEmitter();

  const written: string[] = [];
  const res = {
    locals:
      barId === null
        ? ({} as Record<string, unknown>)
        : { session: { barId, role: "bartender" as const } },
    writeHead: vi.fn(),
    write: (chunk: string) => written.push(chunk),
    end: vi.fn(),
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };

  return {
    req: req as unknown as Request,
    res: res as unknown as Response,
    written,
    messages: (): LiveUpdate[] =>
      written
        .filter((c) => c.startsWith("data: "))
        .map((c) => JSON.parse(c.slice(6)) as LiveUpdate),
  };
}

/** A stand-in order, since a new_order update carries the whole thing. */
const anOrder = (id = 1): Order => ({
  id,
  bar_id: 1,
  customer_name: "Mads",
  drink_id: 1,
  drink_title: "Negroni",
  status: "new",
  created_at: "2026-01-01 00:00:00",
  updated_at: "2026-01-01 00:00:00",
});

describe("live updates", () => {
  it("sends an update to people watching that bar", () => {
    const realtime = createRealtime();
    const listener = fakeListener(1);
    realtime.subscribe(listener.req, listener.res);

    realtime.broadcast(1, { type: "new_order", order: anOrder(7) });

    expect(listener.messages()).toEqual([
      expect.objectContaining({
        type: "new_order",
        order: expect.objectContaining({ id: 7 }),
      }),
    ]);
  });

  it("does not send it to people watching a different bar", () => {
    const realtime = createRealtime();
    const mine = fakeListener(1);
    const theirs = fakeListener(2);
    realtime.subscribe(mine.req, mine.res);
    realtime.subscribe(theirs.req, theirs.res);

    realtime.broadcast(1, { type: "new_order", order: anOrder() });

    expect(mine.messages()).toHaveLength(1);
    expect(theirs.messages()).toHaveLength(0);
  });

  it("matches the bar whether the id arrives as text or a number", () => {
    const realtime = createRealtime();
    const listener = fakeListener(3);
    realtime.subscribe(listener.req, listener.res);

    realtime.broadcast("3", { type: "order_status_updated", order: anOrder() });

    expect(listener.messages()).toHaveLength(1);
  });

  it("stamps every update with a time", () => {
    const realtime = createRealtime();
    const listener = fakeListener(1);
    realtime.subscribe(listener.req, listener.res);

    realtime.broadcast(1, { type: "order_deleted", orderId: 2 });

    expect(listener.messages()[0]?.timestamp).toEqual(expect.any(String));
  });

  it("forgets someone once they go away", () => {
    const realtime = createRealtime();
    const listener = fakeListener(1);
    realtime.subscribe(listener.req, listener.res);
    expect(realtime.listenerCount).toBe(1);

    (listener.req as unknown as EventEmitter).emit("close");

    expect(realtime.listenerCount).toBe(0);

    realtime.broadcast(1, { type: "new_order", order: anOrder() });
    expect(listener.messages()).toHaveLength(0);
  });

  it("drops anyone whose connection breaks mid-send", () => {
    const realtime = createRealtime();
    const broken = fakeListener(1);
    realtime.subscribe(broken.req, broken.res);

    // Breaks only once it is connected, as a dropped connection would.
    (broken.res as unknown as { write: () => void }).write = () => {
      throw new Error("socket closed");
    };

    expect(() =>
      realtime.broadcast(1, { type: "new_order", order: anOrder() })
    ).not.toThrow();
    expect(realtime.listenerCount).toBe(0);
  });

  it("turns away a connection with no session", () => {
    const realtime = createRealtime();
    const listener = fakeListener(null);

    realtime.subscribe(listener.req, listener.res);

    expect(listener.res.status).toHaveBeenCalledWith(401);
    expect(realtime.listenerCount).toBe(0);
  });

  it("tells the browser how long to wait before trying again", () => {
    const realtime = createRealtime();
    const listener = fakeListener(1);

    realtime.subscribe(listener.req, listener.res);

    expect(listener.written.join("")).toContain("retry:");
  });
});

describe("the updates address", () => {
  it("answers with a stream that stays open", async () => {
    const { app } = makeTestApp();
    const server = createServer(app).listen(0);
    const { port } = server.address() as AddressInfo;

    // A real request, because the reply never ends and supertest waits for
    // one that does.
    const { headers, firstChunk } = await new Promise<{
      headers: Record<string, string | string[] | undefined>;
      firstChunk: string;
    }>((resolve, reject) => {
      const req = get(
        {
          host: "127.0.0.1",
          port,
          path: "/api/events",
          headers: { Cookie: sessionCookie({ barId: 1, role: "bartender" }) },
        },
        (res) => {
          res.once("data", (chunk) => {
            resolve({ headers: res.headers, firstChunk: chunk.toString() });
            req.destroy();
          });
        }
      );
      req.on("error", reject);
    });

    expect(headers["content-type"]).toContain("text/event-stream");
    expect(headers["cache-control"]).toContain("no-cache");
    expect(headers["x-accel-buffering"]).toBe("no");
    expect(firstChunk).toContain("retry:");

    server.close();
  });

  it("turns away a connection with no session", async () => {
    const { app } = makeTestApp();

    const res = await request(app).get("/api/events");

    expect(res.status).toBe(401);
  });
});

describe("orders reach the people watching", () => {
  it("sends an update when an order is placed", async () => {
    const { app, db } = makeTestApp();
    const { barId, drinkId } = seedBar(db);

    const listener = fakeListener(barId);
    app.locals.realtime.subscribe(listener.req, listener.res);

    await request(app)
      .post("/api/orders")
      .set("Cookie", sessionCookie({ barId, role: "guest", name: "Mads" }))
      .send({ drinkId, drinkTitle: "Negroni" });

    expect(listener.messages()).toEqual([
      expect.objectContaining({ type: "new_order" }),
    ]);
  });
});
