import React, { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { Order, OrderStatus } from "../../types";
import { translations } from "../../utils/translations";

interface GuestDockProps {
  order: Order;
  t: (key: keyof typeof translations.en) => string;
  onCancelOrder?: (orderId: number) => void;
  loading?: boolean;
}

/** How far along the four steps an order is, for the bar across the top. */
const STEP: Record<OrderStatus, number> = {
  new: 1,
  accepted: 2,
  ready: 3,
  processed: 4,
  rejected: 0,
};

// The order in progress, pinned to the bottom of every guest screen. It is
// not a card in the menu that scrolls away: a guest reading a recipe or
// looking through their history still has to be told the drink is ready.
const GuestDock: React.FC<GuestDockProps> = ({
  order,
  t,
  onCancelOrder,
  loading = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const ready = order.status === "ready";
  const reached = STEP[order.status];

  // Once it is poured and waiting on the bar there is nothing left to call
  // off — the drink exists. Cancelling stops at accepted.
  const canCancel = order.status === "new" || order.status === "accepted";

  const cancel = canCancel && onCancelOrder && (
    <button
      onClick={() => onCancelOrder(order.id)}
      disabled={loading}
      className="w-full h-14 flex items-center justify-center gap-2 rounded-md border border-current text-label transition-colors duration-(--duration-instant) hover:bg-current/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      <X className="w-4 h-4" />
      {t("cancelOrder")}
    </button>
  );

  return (
    <section
      aria-label={t("yourOrder")}
      className={`fixed inset-x-0 bottom-0 z-40 ${
        ready
          ? "bg-accent text-accent-contrast shadow-[0_-18px_44px_rgb(0_0_0/0.55)]"
          : "bg-surface-raised text-text border-t-2 border-border-strong"
      }`}
    >
      {/* Four steps, so how far along it is can be read without words. */}
      <div className="flex gap-[3px]" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={`flex-1 h-1.5 ${
              step <= reached
                ? ready
                  ? "bg-accent-contrast"
                  : "bg-text"
                : ready
                  ? "bg-accent-contrast/25"
                  : "bg-surface-sunken"
            }`}
          />
        ))}
      </div>

      {ready ? (
        /* It opens itself out and takes the signal colour. The guest has one
           job now, and it is not browsing the menu. */
        <div className="px-4 pt-4 pb-4 flex flex-col gap-2.5">
          <span className="font-mono text-caption uppercase">
            {t("readyCollect")}
          </span>
          <span className="font-bold text-3xl leading-[1.05] tracking-[-0.02em] break-words">
            {order.drink_title}
          </span>
          {cancel}
        </div>
      ) : (
        <>
          <button
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="w-full h-16 px-4 flex items-center gap-3 text-left cursor-pointer"
          >
            <span className="flex-1 min-w-0">
              <span className="block font-bold text-[1.0625rem] leading-tight truncate">
                {order.drink_title}
              </span>
              <span className="block text-body text-text-muted">
                {t(order.status)}
              </span>
            </span>
            {expanded ? (
              <ChevronDown className="w-5 h-5 shrink-0 text-text-muted" />
            ) : (
              <ChevronUp className="w-5 h-5 shrink-0 text-text-muted" />
            )}
          </button>

          {expanded && <div className="px-4 pb-4">{cancel}</div>}
        </>
      )}
    </section>
  );
};

export default GuestDock;
