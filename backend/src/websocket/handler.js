export function setupWebSocket(wss) {
  const clients = new Map(); // Store clients with their metadata
  let clientIdCounter = 0;

  console.log("WebSocket server initialized");

  wss.on("connection", (ws) => {
    const clientId = ++clientIdCounter;
    const clientInfo = {
      id: clientId,
      barId: null,
      userType: null,
      customerName: null,
      connectedAt: new Date(),
      lastPing: new Date(),
    };

    clients.set(ws, clientInfo);
    console.log(
      `WebSocket client ${clientId} connected. Total clients: ${clients.size}`
    );

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "connection_established",
        clientId: clientId,
        timestamp: new Date().toISOString(),
      })
    );

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        handleWebSocketMessage(ws, data, clients);
      } catch (error) {
        console.error(
          `WebSocket message parse error from client ${clientId}:`,
          error
        );
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid JSON message format",
          })
        );
      }
    });

    ws.on("pong", () => {
      const client = clients.get(ws);
      if (client) {
        client.lastPing = new Date();
      }
    });

    ws.on("close", (code, reason) => {
      const client = clients.get(ws);
      console.log(
        `WebSocket client ${
          client?.id || "unknown"
        } disconnected. Code: ${code}, Reason: ${reason || "none"}`
      );
      clients.delete(ws);
      console.log(`Total clients: ${clients.size}`);
    });

    ws.on("error", (error) => {
      const client = clients.get(ws);
      console.error(
        `WebSocket error from client ${client?.id || "unknown"}:`,
        error
      );
      clients.delete(ws);
    });
  });

  // Heartbeat mechanism to detect dead connections
  const heartbeat = setInterval(() => {
    const now = new Date();

    clients.forEach((clientInfo, ws) => {
      if (ws.readyState === ws.OPEN) {
        // Check if client hasn't responded to ping in 60 seconds
        const timeSinceLastPing = now - clientInfo.lastPing;
        if (timeSinceLastPing > 60000) {
          console.log(
            `Client ${clientInfo.id} seems inactive, terminating connection`
          );
          ws.terminate();
          clients.delete(ws);
          return;
        }

        // Send ping
        ws.ping();
      } else {
        // Remove dead connections
        clients.delete(ws);
      }
    });
  }, 30000); // Check every 30 seconds

  // Cleanup on server shutdown
  wss.on("close", () => {
    clearInterval(heartbeat);
    console.log("WebSocket server closed");
  });

  // Return handler object with broadcast functionality
  return {
    // Broadcast to all clients in a specific bar
    broadcast: (barId, data) => {
      const message = JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      });

      let sentCount = 0;
      clients.forEach((clientInfo, ws) => {
        if (clientInfo.barId === barId && ws.readyState === ws.OPEN) {
          try {
            ws.send(message);
            sentCount++;
          } catch (error) {
            console.error(
              `Error sending message to client ${clientInfo.id}:`,
              error
            );
            clients.delete(ws);
          }
        }
      });

      console.log(
        `Broadcasted message to ${sentCount} clients in bar ${barId}:`,
        data.type
      );
    },

    // Broadcast to specific user types in a bar
    broadcastToUserType: (barId, userType, data) => {
      const message = JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      });

      let sentCount = 0;
      clients.forEach((clientInfo, ws) => {
        if (
          clientInfo.barId === barId &&
          clientInfo.userType === userType &&
          ws.readyState === ws.OPEN
        ) {
          try {
            ws.send(message);
            sentCount++;
          } catch (error) {
            console.error(
              `Error sending message to client ${clientInfo.id}:`,
              error
            );
            clients.delete(ws);
          }
        }
      });

      console.log(
        `Broadcasted message to ${sentCount} ${userType} clients in bar ${barId}:`,
        data.type
      );
    },

    // Broadcast to specific customer
    broadcastToCustomer: (barId, customerName, data) => {
      const message = JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      });

      let sentCount = 0;
      clients.forEach((clientInfo, ws) => {
        if (
          clientInfo.barId === barId &&
          clientInfo.customerName === customerName &&
          ws.readyState === ws.OPEN
        ) {
          try {
            ws.send(message);
            sentCount++;
          } catch (error) {
            console.error(
              `Error sending message to client ${clientInfo.id}:`,
              error
            );
            clients.delete(ws);
          }
        }
      });

      console.log(
        `Broadcasted message to ${sentCount} clients for customer ${customerName} in bar ${barId}:`,
        data.type
      );
    },

    // Get connection stats
    getStats: () => ({
      totalConnections: clients.size,
      connectionsByBar: getConnectionsByBar(clients),
      connectionsByUserType: getConnectionsByUserType(clients),
    }),

    // Close all connections
    closeAll: () => {
      clients.forEach((clientInfo, ws) => {
        ws.close(1000, "Server shutdown");
      });
      clients.clear();
    },
  };
}

function handleWebSocketMessage(ws, data, clients) {
  const client = clients.get(ws);

  if (!client) {
    return;
  }

  switch (data.type) {
    case "join_bar":
      handleJoinBar(ws, data, client, clients);
      break;

    case "leave_bar":
      handleLeaveBar(ws, client, clients);
      break;

    case "ping":
      ws.send(
        JSON.stringify({ type: "pong", timestamp: new Date().toISOString() })
      );
      break;

    case "get_stats":
      if (client.userType === "bartender") {
        ws.send(
          JSON.stringify({
            type: "stats",
            data: getConnectionStats(clients, client.barId),
          })
        );
      }
      break;

    default:
      console.log(`Unknown message type from client ${client.id}:`, data.type);
      ws.send(
        JSON.stringify({
          type: "error",
          message: `Unknown message type: ${data.type}`,
        })
      );
  }
}

function handleJoinBar(ws, data, client, clients) {
  const { barId, userType, customerName } = data;

  if (!barId || !userType) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "barId and userType are required to join a bar",
      })
    );
    return;
  }

  // Update client info
  client.barId = parseInt(barId);
  client.userType = userType;
  client.customerName = userType === "guest" ? customerName : null;

  console.log(
    `Client ${client.id} joined bar ${barId} as ${userType}${
      customerName ? ` (${customerName})` : ""
    }`
  );

  // Send confirmation
  ws.send(
    JSON.stringify({
      type: "bar_joined",
      barId: client.barId,
      userType: client.userType,
      customerName: client.customerName,
    })
  );

  // Notify other clients in the bar about new connection (optional)
  const connectionCount = getBarConnectionCount(clients, client.barId);

  // You could broadcast this to bartenders for monitoring
  if (userType === "guest") {
    broadcastToBartenders(clients, client.barId, {
      type: "guest_connected",
      customerName: customerName,
      connectionCount: connectionCount,
    });
  }
}

function handleLeaveBar(ws, client, clients) {
  if (client.barId) {
    console.log(`Client ${client.id} left bar ${client.barId}`);

    // Notify bartenders if a guest is leaving
    if (client.userType === "guest" && client.customerName) {
      broadcastToBartenders(clients, client.barId, {
        type: "guest_disconnected",
        customerName: client.customerName,
      });
    }

    client.barId = null;
    client.userType = null;
    client.customerName = null;
  }

  ws.send(
    JSON.stringify({
      type: "bar_left",
    })
  );
}

function getConnectionsByBar(clients) {
  const barConnections = new Map();

  clients.forEach((clientInfo) => {
    if (clientInfo.barId) {
      const count = barConnections.get(clientInfo.barId) || 0;
      barConnections.set(clientInfo.barId, count + 1);
    }
  });

  return Object.fromEntries(barConnections);
}

function getConnectionsByUserType(clients) {
  const userTypeConnections = { bartender: 0, guest: 0, unknown: 0 };

  clients.forEach((clientInfo) => {
    if (clientInfo.userType) {
      userTypeConnections[clientInfo.userType]++;
    } else {
      userTypeConnections.unknown++;
    }
  });

  return userTypeConnections;
}

function getBarConnectionCount(clients, barId) {
  let count = 0;
  clients.forEach((clientInfo) => {
    if (clientInfo.barId === barId) {
      count++;
    }
  });
  return count;
}

function getConnectionStats(clients, barId) {
  const stats = {
    totalConnections: 0,
    bartenders: 0,
    guests: 0,
    guestNames: [],
  };

  clients.forEach((clientInfo) => {
    if (clientInfo.barId === barId) {
      stats.totalConnections++;
      if (clientInfo.userType === "bartender") {
        stats.bartenders++;
      } else if (clientInfo.userType === "guest") {
        stats.guests++;
        if (clientInfo.customerName) {
          stats.guestNames.push(clientInfo.customerName);
        }
      }
    }
  });

  return stats;
}

function broadcastToBartenders(clients, barId, data) {
  const message = JSON.stringify({
    ...data,
    timestamp: new Date().toISOString(),
  });

  clients.forEach((clientInfo, ws) => {
    if (
      clientInfo.barId === barId &&
      clientInfo.userType === "bartender" &&
      ws.readyState === ws.OPEN
    ) {
      try {
        ws.send(message);
      } catch (error) {
        console.error(`Error sending message to bartender:`, error);
      }
    }
  });
}
