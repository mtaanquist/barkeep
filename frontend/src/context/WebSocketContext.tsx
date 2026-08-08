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
  connectionError: boolean;
  reconnect: () => void;
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

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 2000; // 2 seconds

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [shouldConnect, setShouldConnect] = useState(false);

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

    setShouldConnect(!!isFullyAuthenticated);

    if (!isFullyAuthenticated) {
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
      // Reset error and attempts when logging out
      setConnectionError(false);
      setReconnectAttempts(0);
      return;
    }

    // Connection logic
    if (isFullyAuthenticated) {
      console.log("[WebSocket] Attempting to connect...", {
        barId: currentBar.id,
        userType,
        customerName: userType === "guest" ? customerName : undefined,
        attempt: reconnectAttempts + 1,
      });

      const websocket = new WebSocket(WS_URL);
      let connectionTimeout: NodeJS.Timeout;

      // Set a timeout to detect connection failures
      connectionTimeout = setTimeout(() => {
        if (websocket.readyState !== WebSocket.OPEN) {
          console.error("[WebSocket] Connection timeout");
          websocket.close();
          handleConnectionFailure();
        }
      }, 5000); // 5 second timeout

      const handleConnectionFailure = () => {
        setIsConnected(false);
        const nextAttempt = reconnectAttempts + 1;
        
        if (nextAttempt < MAX_RECONNECT_ATTEMPTS) {
          console.log(`[WebSocket] Reconnecting in ${RECONNECT_DELAY}ms (attempt ${nextAttempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);
          setReconnectAttempts(nextAttempt);
          
          // Retry connection after delay
          setTimeout(() => {
            if (shouldConnect) {
              setReconnectAttempts(nextAttempt);
            }
          }, RECONNECT_DELAY);
        } else {
          console.error("[WebSocket] Max reconnection attempts reached");
          setConnectionError(true);
          setReconnectAttempts(0);
        }
      };

      websocket.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log("[WebSocket] Connected successfully");
        setIsConnected(true);
        setConnectionError(false);
        setReconnectAttempts(0);
        
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
        clearTimeout(connectionTimeout);
        console.log("[WebSocket] Disconnected", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        setIsConnected(false);
        
        // Only attempt to reconnect if we should still be connected
        // and it wasn't a clean close (user didn't intentionally disconnect)
        if (shouldConnect && !event.wasClean && event.code !== 1000) {
          handleConnectionFailure();
        }
      };

      websocket.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error("[WebSocket] Error occurred:", error);
        console.error("[WebSocket] Attempted URL:", WS_URL);
        console.error("[WebSocket] ReadyState:", websocket.readyState);
        setIsConnected(false);
      };

      setWs(websocket);

      return () => {
        clearTimeout(connectionTimeout);
        console.log("[WebSocket] Cleaning up connection");
        if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
          websocket.close(1000, "Component cleanup"); // Clean close
        }
      };
    }
  }, [currentBar, userType, customerName, reconnectAttempts, shouldConnect]);

  const reconnect = () => {
    console.log("[WebSocket] Manual reconnection triggered");
    setConnectionError(false);
    setReconnectAttempts(0);
    // Trigger reconnection by updating state
    setShouldConnect(false);
    setTimeout(() => setShouldConnect(true), 100);
  };

  const value: WebSocketContextType = {
    ws,
    isConnected,
    connectionError,
    reconnect,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
