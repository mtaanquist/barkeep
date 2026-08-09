import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useApp } from "./AppContext";
import type { LiveUpdate } from "../types";

interface LiveUpdatesContextType {
  isConnected: boolean;
  connectionError: boolean;
  reconnect: () => void;
}

const LiveUpdatesContext = createContext<LiveUpdatesContextType | undefined>(
  undefined
);

// eslint-disable-next-line react-refresh/only-export-components
export const useLiveUpdates = () => {
  const context = useContext(LiveUpdatesContext);
  if (context === undefined) {
    throw new Error("useLiveUpdates must be used within a LiveUpdatesProvider");
  }
  return context;
};

// How long to stay quiet before telling anyone. The browser reconnects on its
// own, so short drops are not worth mentioning.
const COMPLAIN_AFTER_MS = 15000;

export const LiveUpdatesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const { currentBar, userType, customerName, setOrders, apiCall } = useApp();

  const complainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const barId = currentBar?.id;
  const signedIn =
    !!barId &&
    (userType === "bartender" || (userType === "guest" && !!customerName));

  const refreshOrders = useCallback(async () => {
    if (!barId) return;
    try {
      setOrders(await apiCall(`/orders/bar/${barId}`));
    } catch (err) {
      console.error("Could not refresh orders:", err);
    }
  }, [barId, apiCall, setOrders]);

  const reconnect = useCallback(() => {
    setConnectionError(false);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setIsConnected(false);
      setConnectionError(false);
      return;
    }

    const source = new EventSource(`/api/events?barId=${barId}`);

    const startComplaining = () => {
      if (complainTimer.current) return;
      complainTimer.current = setTimeout(
        () => setConnectionError(true),
        COMPLAIN_AFTER_MS
      );
    };

    const stopComplaining = () => {
      if (complainTimer.current) {
        clearTimeout(complainTimer.current);
        complainTimer.current = null;
      }
    };

    source.onopen = () => {
      setIsConnected(true);
      setConnectionError(false);
      stopComplaining();
    };

    source.onmessage = (event) => {
      try {
        const update: LiveUpdate = JSON.parse(event.data);
        switch (update.type) {
          case "new_order":
          case "order_status_updated":
            refreshOrders();
            break;
          case "order_deleted":
            setOrders((prev) =>
              prev.filter((order) => order.id !== update.orderId)
            );
            break;
        }
      } catch (err) {
        console.error("Could not read update:", event.data, err);
      }
    };

    // The browser retries by itself, so this only tracks how it is going.
    source.onerror = () => {
      setIsConnected(false);
      startComplaining();
    };

    return () => {
      stopComplaining();
      source.close();
      setIsConnected(false);
    };
  }, [signedIn, barId, attempt, refreshOrders, setOrders]);

  return (
    <LiveUpdatesContext.Provider
      value={{ isConnected, connectionError, reconnect }}
    >
      {children}
    </LiveUpdatesContext.Provider>
  );
};
