import React, { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Grid2x2,
  List,
  LogOut,
  QrCode,
  Settings,
} from "lucide-react";
import { useApp } from "../../hooks/useApp";
import type { Analytics, BarQrCode, Drink, Order } from "../../types";
import { useTranslation } from "../../utils/translations";
import { useSessionManager } from "../../hooks/useSessionManager";
import { useLiveUpdates } from "../../hooks/useLiveUpdates";
import { ConnectionLost } from "../ConnectionLost";
import QrCodeDialog from "./QrCodeDialog";
import QueueTile from "./QueueTile";

const PENDING = ["new", "accepted", "ready"];

/** The four screens that are set up once and then mostly left alone. */
const SETUP = [
  { to: "menu", label: "drinkMenu", Icon: List },
  { to: "categories", label: "categories", Icon: Grid2x2 },
  { to: "analytics", label: "analytics", Icon: BarChart3 },
  { to: "settings", label: "settings", Icon: Settings },
] as const;

// The queue is the floor and everything else is a drawer. The count is on
// screen on every route, including behind the drink form, and tapping it is
// always one step back to the queue.
const BartenderShell: React.FC = () => {
  const {
    currentBar,
    language,
    orders,
    setDrinks,
    setOrders,
    setAnalytics,
    apiCall,
  } = useApp();

  const t = useTranslation(language);
  const { clearSession } = useSessionManager();
  const { connectionError, reconnect } = useLiveUpdates();
  const navigate = useNavigate();
  const location = useLocation();

  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [qrData, setQrData] = useState<BarQrCode | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Show the notice again if updates drop out a second time.
  useEffect(() => {
    if (!connectionError) setNoticeDismissed(false);
  }, [connectionError]);

  const barId = currentBar?.id;
  const onQueue = location.pathname.endsWith("/queue");

  const pending = orders.filter((order) => PENDING.includes(order.status));
  const pendingCount = pending.length;

  // An order landing while the bartender is elsewhere is worth a mark in the
  // navigation, but not a noise or a jump: their hands are busy. It holds
  // until the queue is opened.
  const [arrived, setArrived] = useState(false);
  const lastCount = useRef(pendingCount);

  useEffect(() => {
    if (onQueue) {
      setArrived(false);
    } else if (pendingCount > lastCount.current) {
      setArrived(true);
    }
    lastCount.current = pendingCount;
  }, [pendingCount, onQueue]);

  const fetchDrinks = useCallback(async () => {
    if (!barId) return;
    try {
      setDrinks(await apiCall<Drink[]>(`/drinks/bar/${barId}`));
    } catch (err) {
      console.error("Could not load the drinks:", err);
    }
  }, [barId, apiCall, setDrinks]);

  const fetchOrders = useCallback(async () => {
    if (!barId) return;
    try {
      setOrders(await apiCall<Order[]>(`/orders/bar/${barId}`));
    } catch (err) {
      console.error("Could not load the orders:", err);
    }
  }, [barId, apiCall, setOrders]);

  const fetchAnalytics = useCallback(async () => {
    if (!barId) return;
    try {
      setAnalytics(await apiCall<Analytics>(`/orders/bar/${barId}/analytics`));
    } catch (err) {
      console.error("Could not load the reports:", err);
    }
  }, [barId, apiCall, setAnalytics]);

  useEffect(() => {
    fetchDrinks();
    fetchOrders();
    fetchAnalytics();
  }, [fetchDrinks, fetchOrders, fetchAnalytics]);

  const showQrCode = async () => {
    if (!currentBar) return;

    setQrLoading(true);
    try {
      setQrData(await apiCall<BarQrCode>(`/bars/${currentBar.id}/qrcode`));
    } catch (err) {
      console.error("Error generating QR code:", err);
    } finally {
      setQrLoading(false);
    }
  };

  const setupRow = ({ isActive }: { isActive: boolean }) =>
    `h-12 px-3 flex items-center gap-3 rounded-md text-body transition-colors duration-(--duration-instant) cursor-pointer ${
      isActive
        ? "bg-surface-sunken text-text"
        : "text-text-muted hover:text-text"
    }`;

  return (
    <div className="min-h-screen bg-surface-sunken lg:flex">
      {connectionError && !noticeDismissed && (
        <ConnectionLost
          onRetry={reconnect}
          onDismiss={() => setNoticeDismissed(true)}
        />
      )}

      {/* The rail, on a laptop or a tablet in landscape. */}
      <nav className="hidden lg:flex w-58 shrink-0 flex-col bg-surface border-r border-border sticky top-0 h-screen">
        <div className="px-4 pt-4 pb-3.5">
          <p className="text-heading truncate">{currentBar?.name}</p>
          <p className="font-mono text-caption uppercase text-text-muted mt-0.5">
            {t("bartender")}
          </p>
        </div>

        <div className="px-3">
          <QueueTile
            count={pendingCount}
            arrived={arrived}
            onClick={() => navigate("/bartender/queue")}
            t={t}
          />
        </div>

        <p className="px-4 pt-5 pb-2 font-mono text-caption uppercase text-text-muted">
          {t("setup")}
        </p>
        <div className="px-3 flex flex-col">
          {SETUP.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={setupRow}>
              <Icon className="w-4.5 h-4.5 shrink-0" />
              {t(label)}
            </NavLink>
          ))}
        </div>

        <span className="flex-1" />

        <div className="p-3 flex flex-col gap-2 border-t border-border">
          <button
            onClick={showQrCode}
            disabled={qrLoading}
            className="h-14 flex items-center justify-center gap-2.5 rounded-md border border-border-strong bg-surface-raised text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <QrCode className="w-4.5 h-4.5 shrink-0" />
            {t("generateQR")}
          </button>
          {/* The language is a bar setting, not a thing to sign out with —
              it lives under Settings. */}
          <button
            onClick={clearSession}
            className="h-11 px-3 flex items-center gap-2.5 rounded-md text-label text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {t("logout")}
          </button>
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* On a narrow screen the setup screens get a plain header instead. */}
        <div className="lg:hidden bg-surface border-b border-border px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-heading truncate">{currentBar?.name}</p>
            <p className="font-mono text-caption uppercase text-text-muted">
              {t("bartender")}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={showQrCode}
              disabled={qrLoading}
              aria-label={t("generateQR")}
              title={t("generateQR")}
              className="w-11 h-11 flex items-center justify-center rounded-md border border-border text-text transition-colors duration-(--duration-instant) hover:bg-surface-sunken disabled:opacity-50 cursor-pointer"
            >
              <QrCode className="w-5 h-5" />
            </button>
            <button
              onClick={clearSession}
              className="h-11 px-3 rounded-md text-label text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
            >
              {t("logout")}
            </button>
          </div>
        </div>

        <div className="lg:hidden border-b border-border bg-surface overflow-x-auto">
          <div className="flex w-max">
            {SETUP.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `h-14 min-w-18 px-4 flex items-center text-label whitespace-nowrap border-b-2 transition-colors duration-(--duration-instant) ${
                    isActive
                      ? "border-border-strong text-text"
                      : "border-transparent text-text-muted"
                  }`
                }
              >
                {t(label)}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Room for the bottom queue bar on a narrow screen. */}
        <div className="flex-1 p-4 lg:p-6 pb-28 lg:pb-6">
          <Outlet />
        </div>
      </div>

      {/* Below the rail's width the queue lives here instead, and is still
          never off screen. */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 p-3 bg-surface border-t-2 border-border-strong">
        <QueueTile
          count={pendingCount}
          arrived={arrived}
          onClick={() => navigate("/bartender/queue")}
          t={t}
        />
      </div>

      {qrData && (
        <QrCodeDialog data={qrData} onClose={() => setQrData(null)} t={t} />
      )}
    </div>
  );
};

export default BartenderShell;
