import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../hooks/useApp";
import { useSessionManager } from "../../hooks/useSessionManager";
import { useLiveUpdates } from "../../hooks/useLiveUpdates";
import { useTranslation } from "../../utils/translations";
import { ConnectionLost } from "../ConnectionLost";
import GuestDock from "./GuestDock";

/** Statuses that mean a guest still has a drink on the go. */
const IN_PROGRESS = ["new", "accepted", "ready"];

interface GuestShellProps {
  children: React.ReactNode;
  /** A labelled way back, on the screens that are not the menu. */
  back?: { label: string; onClick: () => void };
  onCancelOrder?: (orderId: number) => void;
  loading?: boolean;
}

// Every guest screen sits in here, so there is one header rather than one per
// page drifting apart, and so the order in progress is on screen wherever the
// guest happens to be.
const GuestShell: React.FC<GuestShellProps> = ({
  children,
  back,
  onCancelOrder,
  loading = false,
}) => {
  const { currentBar, customerName, language, orders } = useApp();
  const t = useTranslation(language);
  const { clearSession } = useSessionManager();
  const { connectionError, reconnect } = useLiveUpdates();
  const navigate = useNavigate();

  const [noticeDismissed, setNoticeDismissed] = useState(false);

  // Show the notice again if updates drop out a second time.
  useEffect(() => {
    if (!connectionError) setNoticeDismissed(false);
  }, [connectionError]);

  const currentOrder = orders.find(
    (order) =>
      order.customer_name === customerName && IN_PROGRESS.includes(order.status)
  );

  return (
    <div className="min-h-screen bg-surface">
      {connectionError && !noticeDismissed && (
        <ConnectionLost
          onRetry={reconnect}
          onDismiss={() => setNoticeDismissed(true)}
        />
      )}

      <header className="bg-surface-raised border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {back && (
                <button
                  onClick={back.onClick}
                  className="w-11 h-11 shrink-0 flex items-center justify-center rounded-md border border-border text-text-muted transition-colors duration-(--duration-instant) hover:text-text hover:border-border-strong cursor-pointer"
                  aria-label={back.label}
                  title={back.label}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="text-heading truncate">{currentBar?.name}</h1>
                <div className="flex items-center gap-4">
                  <p className="font-mono text-caption uppercase text-text-muted truncate">
                    {customerName}
                  </p>
                  {!back && (
                    <button
                      onClick={() => navigate("/customer/past-orders")}
                      className="text-label text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
                    >
                      {t("pastOrders")}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={clearSession}
              className="text-label text-text-muted shrink-0 transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </header>

      {/* Room at the bottom so the dock never covers the last drink. */}
      <div className={currentOrder ? "pb-40" : "pb-8"}>{children}</div>

      {currentOrder && (
        <GuestDock
          order={currentOrder}
          t={t}
          onCancelOrder={onCancelOrder}
          loading={loading}
        />
      )}
    </div>
  );
};

export default GuestShell;
