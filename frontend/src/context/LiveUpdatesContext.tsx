import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useApp } from "../hooks/useApp";
import { LiveUpdatesContext } from "../hooks/useLiveUpdates";
import type { LiveUpdate } from "../types";



// How long to stay quiet before telling anyone. The browser reconnects on its
// own, so short drops are not worth mentioning.
const COMPLAIN_AFTER_MS = 15000;

export const LiveUpdatesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const { currentBar, userType, customerName, setDrinks, setOrders, apiCall } =
    useApp();

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

  /**
   * The menu, from whichever end the person watching is at. A bartender sees
   * every drink; a guest sees theirs, with their favourites marked.
   */
  const refreshDrinks = useCallback(async () => {
    if (!barId) return;

    const where =
      userType === "bartender"
        ? `/drinks/bar/${barId}`
        : customerName
          ? `/drinks/bar/${barId}/guest/${encodeURIComponent(customerName)}`
          : null;

    if (!where) return;

    try {
      setDrinks(await apiCall(where));
    } catch (err) {
      console.error("Could not refresh the drinks:", err);
    }
  }, [barId, userType, customerName, apiCall, setDrinks]);

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

    // The server reads the bar from the sign-in cookie, so no id in the address.
    // withCredentials sends that cookie in development, where the pages come
    // from a different origin.
    const source = new EventSource("/api/events", { withCredentials: true });

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
          // A bottle ran out, or a drink changed. Which drinks that touches is
          // the server's to work out, so ask it again rather than guess.
          case "menu_changed":
            refreshDrinks();
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
  }, [signedIn, barId, attempt, refreshDrinks, refreshOrders, setOrders]);

  return (
    <LiveUpdatesContext.Provider
      value={{ isConnected, connectionError, reconnect }}
    >
      {children}
    </LiveUpdatesContext.Provider>
  );
};
