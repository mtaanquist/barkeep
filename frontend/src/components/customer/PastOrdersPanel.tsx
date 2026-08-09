import React, { useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import type { Drink, Order } from "../../types";
import type { TranslationKeys } from "../../utils/translations";

interface PastOrdersPanelProps {
  orders: Order[];
  drinks: Drink[];
  customerName: string;
  /** The drink already on the go, which is what stops a second one. */
  currentOrder: Order | undefined;
  loading: boolean;
  t: (key: TranslationKeys) => string;
  onClose: () => void;
  onOrderAgain: (drink: Drink) => void;
  onNotMe: () => void;
}

/** Orders a guest has finished with, newest first. */
const SETTLED = ["processed", "rejected"];

const timeOf = (order: Order) =>
  new Date(order.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

/** Same evening or an earlier one — a party is usually just the one. */
const dayOf = (order: Order) =>
  new Date(order.created_at).toDateString();

const PastOrdersPanel: React.FC<PastOrdersPanelProps> = ({
  orders,
  drinks,
  customerName,
  currentOrder,
  loading,
  t,
  onClose,
  onOrderAgain,
  onNotMe,
}) => {
  // Escape goes back to the menu, the same as the labelled way out.
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  const mine = orders
    .filter(
      (order) =>
        order.customer_name === customerName && SETTLED.includes(order.status)
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  // Grouped by evening, so a run of drinks reads as one sitting.
  const today = new Date().toDateString();
  const days = [...new Set(mine.map(dayOf))];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* The menu is still there behind it, and tapping it goes back. */}
      <button
        type="button"
        aria-label={t("backToMenu")}
        onClick={onClose}
        className="absolute inset-0 bg-overlay cursor-default"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("pastOrders")}
        // It stops above the dock: a drink going ready still has to be seen.
        className={`relative w-full sm:max-w-105 bg-surface border-l border-border flex flex-col ${
          currentOrder ? "mb-[70px]" : ""
        }`}
      >
        <div className="shrink-0 px-4 py-3 border-b border-border flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 pl-2.5 pr-3.5 shrink-0 flex items-center gap-1.5 rounded-md border border-border bg-surface-raised text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
          >
            <ChevronLeft className="w-4.5 h-4.5" />
            {t("menuLabel")}
          </button>
          <h2 className="flex-1 min-w-0 text-heading truncate">
            {t("pastOrders")}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
          {mine.length === 0 ? (
            <p className="text-body text-text-muted">{t("noPastOrders")}</p>
          ) : (
            days.map((day) => {
              const ofDay = mine.filter((order) => dayOf(order) === day);

              return (
                <React.Fragment key={day}>
                  <span className="font-mono text-caption uppercase text-text-muted">
                    {day === today ? t("tonight") : day} · {ofDay.length}
                  </span>

                  {ofDay.map((order) => {
                    const drink = drinks.find((d) => d.id === order.drink_id);
                    const wasRejected = order.status === "rejected";
                    const canOrderAgain =
                      !!drink &&
                      drink.in_stock === 1 &&
                      !currentOrder &&
                      !loading;

                    return (
                      <div
                        key={order.id}
                        className="flex items-center gap-3 p-3 rounded-md border border-border"
                      >
                        <span
                          className={`w-13 h-13 shrink-0 rounded-md border border-border overflow-hidden bg-surface-sunken ${
                            wasRejected ? "grayscale opacity-50" : ""
                          }`}
                        >
                          {drink?.image_url && (
                            <img
                              src={drink.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                              style={{
                                transform: `translate(${drink.image_crop_x || 0}%, ${drink.image_crop_y || 0}%) scale(${drink.image_crop_zoom || 1})`,
                              }}
                            />
                          )}
                        </span>

                        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <span
                            className={`font-bold text-[1.0625rem] leading-tight tracking-tight truncate ${
                              wasRejected ? "text-text-muted" : ""
                            }`}
                          >
                            {drink?.title ?? order.drink_title}
                          </span>
                          <span className="text-body text-text-muted truncate">
                            {timeOf(order)} · {t(order.status)}
                          </span>
                        </span>

                        {/* Nothing to offer again on one the bar turned down. */}
                        {!wasRejected && (
                          <button
                            type="button"
                            onClick={() => drink && onOrderAgain(drink)}
                            disabled={!canOrderAgain}
                            className="h-13 px-3.5 shrink-0 rounded-md border border-border-strong text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken disabled:bg-disabled-bg disabled:border-disabled-border disabled:text-disabled-fg disabled:cursor-not-allowed cursor-pointer"
                          >
                            {t("orderAgain")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })
          )}

          {/* Why the buttons are dim, next to them rather than in an alert. */}
          {currentOrder && mine.length > 0 && (
            <p className="text-body text-text-muted">
              {t("reorderWhenCollected")}
            </p>
          )}

          <span className="flex-1" />

          <div className="shrink-0 pt-3.5 border-t border-border flex flex-col items-start gap-2">
            <p className="text-body text-text-muted">
              {t("youAreHereAs")}{" "}
              <strong className="text-label text-text">{customerName}</strong>.
            </p>
            <button
              type="button"
              onClick={onNotMe}
              className="h-12 px-3.5 rounded-md border border-border text-label text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
            >
              {t("notMe")}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default PastOrdersPanel;
