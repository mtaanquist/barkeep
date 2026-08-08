// Pushes order updates to everyone looking at a bar.
//
// The browser opens one long-lived request per person and we write to it as
// things happen. Browsers reconnect on their own if it drops, which is the
// whole reason for doing it this way.

const KEEPALIVE_MS = 25000;

export function createRealtime() {
  const clients = new Set();

  function subscribe(req, res) {
    const barId = Number(req.query.barId);

    if (!Number.isInteger(barId) || barId <= 0) {
      return res.status(400).json({ error: "A bar id is required" });
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
    res.flush?.();

    const client = { barId, res };
    clients.add(client);

    // Something has to go down the wire now and then, or an idle connection
    // gets closed by whatever sits in between.
    const keepAlive = setInterval(() => {
      res.write(": still here\n\n");
      res.flush?.();
    }, KEEPALIVE_MS);
    keepAlive.unref?.();

    const drop = () => {
      clearInterval(keepAlive);
      clients.delete(client);
    };

    req.on("close", drop);
    req.on("error", drop);
  }

  function broadcast(barId, data) {
    const wanted = Number(barId);
    const payload = `data: ${JSON.stringify({
      ...data,
      timestamp: new Date().toISOString(),
    })}\n\n`;

    for (const client of clients) {
      if (client.barId !== wanted) continue;
      try {
        client.res.write(payload);
        client.res.flush?.();
      } catch {
        clients.delete(client);
      }
    }
  }

  function closeAll() {
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
