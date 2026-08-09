import { createContext, useContext } from "react";

export interface LiveUpdatesContextType {
  isConnected: boolean;
  connectionError: boolean;
  reconnect: () => void;
}

export const LiveUpdatesContext = createContext<
  LiveUpdatesContextType | undefined
>(undefined);

/** How the live connection is doing, and a way to try it again. */
export function useLiveUpdates(): LiveUpdatesContextType {
  const context = useContext(LiveUpdatesContext);

  if (context === undefined) {
    throw new Error("useLiveUpdates must be used within a LiveUpdatesProvider");
  }

  return context;
}
