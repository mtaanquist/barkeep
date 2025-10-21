import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useApp } from "./AppContext";

interface WebSocketContextType {
  ws: WebSocket | null;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

// Use the correct host and protocol for WebSocket when running behind a reverse proxy
const WS_URL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${
  window.location.host
}/ws`;

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { currentBar, userType, customerName, setOrders, apiCall } = useApp();

  const handleWebSocketMessage = (data: any) => {
    console.log("[WebSocket] Received message:", data);
    switch (data.type) {
      case "new_order":
      case "order_status_updated":
        console.log("[WebSocket] Fetching orders due to:", data.type);
        fetchOrders();
        break;
      case "order_deleted":
        setOrders((prev) => prev.filter((order) => order.id !== data.orderId));
        break;
      default:
        console.log("[WebSocket] Unhandled message type:", data.type);
    }
  };

  const fetchOrders = async () => {
    if (!currentBar) return;
    try {
      const data = await apiCall(`/orders/bar/${currentBar.id}`);
      setOrders(data);
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  };

  useEffect(() => {
    // Only connect WebSocket when user is fully authenticated
    const isFullyAuthenticated =
      currentBar &&
      (userType === "bartender" || (userType === "guest" && customerName));

    if (isFullyAuthenticated) {
      console.log("[WebSocket] Attempting to connect...", {
        barId: currentBar.id,
        userType,
        customerName: userType === "guest" ? customerName : undefined,
      });

      const websocket = new WebSocket(WS_URL);

      websocket.onopen = () => {
        console.log("[WebSocket] Connected successfully");
        setIsConnected(true);
        websocket.send(
          JSON.stringify({
            type: "join_bar",
            barId: currentBar.id,
            userType,
            customerName: userType === "guest" ? customerName : undefined,
          })
        );
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (err) {
          console.error(
            "[WebSocket] Failed to parse message:",
            event.data,
            err
          );
        }
      };

      websocket.onclose = (event) => {
        console.log("[WebSocket] Disconnected", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        setIsConnected(false);
      };

      websocket.onerror = (error) => {
        console.error("[WebSocket] Error occurred:", error);
        console.error("[WebSocket] Attempted URL:", WS_URL);
        console.error("[WebSocket] ReadyState:", websocket.readyState);
        setIsConnected(false);
      };

      setWs(websocket);

      return () => {
        console.log("[WebSocket] Cleaning up connection");
        if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
          websocket.close();
        }
      };
    } else {
      console.log("[WebSocket] Not connecting - authentication incomplete", {
        hasCurrentBar: !!currentBar,
        userType,
        hasCustomerName: !!customerName,
      });
      
      if (ws) {
        console.log("[WebSocket] Closing existing connection");
        ws.close();
        setWs(null);
        setIsConnected(false);
      }
    }
  }, [currentBar, userType, customerName]);

  const value: WebSocketContextType = {
    ws,
    isConnected,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
