// Pushes order updates to everyone looking at a bar.
//
// The browser opens one long-lived request per person and we write to it as
// things happen. Browsers reconnect on their own if it drops, which is the
// whole reason for doing it this way.

import type { Request, Response } from "express";
import type { LiveUpdate } from "../../shared/types.js";

const KEEPALIVE_MS = 25000;

// Omit over a union keeps only the shared keys, so spread it across each
// member first. Without this an update is just { type }.
type WithoutTimestamp<T> = T extends unknown ? Omit<T, "timestamp"> : never;

type Update = WithoutTimestamp<LiveUpdate>;

interface Listener {
  barId: number;
  res: Response;
}

/** Compression middleware adds flush; push it out now if it is there. */
function flush(res: Response): void {
  (res as Response & { flush?: () => void }).flush?.();
}

export interface Realtime {
  subscribe(req: Request, res: Response): void;
  broadcast(barId: number | string, data: Update): void;
  closeAll(): void;
  readonly listenerCount: number;
}

/** Reaches the live updates hub from inside a route. */
export function liveUpdates(req: Request): Realtime | undefined {
  return req.app.locals["realtime"] as Realtime | undefined;
}

export function createRealtime(): Realtime {
  const clients = new Set<Listener>();

  function subscribe(req: Request, res: Response): void {
    const barId = Number(req.query["barId"]);

    if (!Number.isInteger(barId) || barId <= 0) {
      res.status(400).json({ error: "A bar id is required" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Ignored by Caddy, which already streams these. Here so the bar still
      // works behind other proxies.
      "X-Accel-Buffering": "no",
    });

    // Tell the browser to wait 3 seconds between attempts if this drops.
    res.write("retry: 3000\n\n");
    flush(res);

    const client = { barId, res };
    clients.add(client);

    // Something has to go down the wire now and then, or an idle connection
    // gets closed by whatever sits in between.
    const keepAlive = setInterval(() => {
      res.write(": still here\n\n");
      flush(res);
    }, KEEPALIVE_MS);
    keepAlive.unref?.();

    const drop = () => {
      clearInterval(keepAlive);
      clients.delete(client);
    };

    req.on("close", drop);
    req.on("error", drop);
  }

  function broadcast(barId: number | string, data: Update): void {
    const wanted = Number(barId);
    const payload = `data: ${JSON.stringify({
      ...data,
      timestamp: new Date().toISOString(),
    })}\n\n`;

    for (const client of clients) {
      if (client.barId !== wanted) continue;
      try {
        client.res.write(payload);
        flush(client.res);
      } catch {
        clients.delete(client);
      }
    }
  }

  function closeAll(): void {
    for (const client of clients) {
      try {
        client.res.end();
      } catch {
        // Already gone.
      }
    }
    clients.clear();
  }

  return {
    subscribe,
    broadcast,
    closeAll,
    get listenerCount() {
      return clients.size;
    },
  };
}
