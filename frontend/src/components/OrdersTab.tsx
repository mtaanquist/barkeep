import React, { useState } from "react";
import { ChevronDown, ChevronUp, Coffee, X } from "lucide-react";
import { useApp } from "../hooks/useApp";
import type { OrderStatus } from "../types";
import { statusPill, statusRail } from "../utils/orderStatus";
import { useTranslation } from "../utils/translations";

/** Rightmost, always the same size and place, so it can be hit without looking. */
const PRIMARY =
  "h-14 w-full lg:w-auto lg:min-w-55 px-4 rounded-md bg-text text-text-inverse text-label " +
  "transition-colors duration-(--duration-instant) hover:bg-neutral-800 " +
  "disabled:bg-disabled-bg disabled:text-disabled-fg disabled:cursor-not-allowed cursor-pointer";

/** A different shape and size to the primary, and set apart from it. */
const REJECT =
  "h-14 w-14 shrink-0 flex items-center justify-center rounded-md border border-border text-danger " +
  "transition-colors duration-(--duration-instant) hover:bg-danger hover:text-danger-contrast " +
  "disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

const PANEL = "bg-surface-raised rounded-md border border-border";

const OrdersTab: React.FC = () => {
  const {
    currentBar,
    language,
    loading,
    orders,
    setOrders,
    setLoading,
    setError,
    apiCall,
  } = useApp();

  const t = useTranslation(language);

  // Track whether to show recipes for all orders
  const [showRecipes, setShowRecipes] = useState(false);

  const toggleRecipes = () => {
    setShowRecipes((prev) => !prev);
  };

  const handleUpdateOrderStatus = async (
    orderId: number,
    status: OrderStatus
  ) => {
    setLoading(true);
    try {
      await apiCall(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          barId: currentBar!.id,
          status,
        }),
      });

      // Update local state
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status,
                updated_at: new Date().toISOString(),
              }
            : order
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setLoading(false);
    }
  };

  const pendingOrders = orders.filter((order) =>
    ["new", "accepted", "ready"].includes(order.status)
  );

  const readyCount = orders.filter((order) => order.status === "ready").length;

  const recentOrders = orders
    .filter((order) => order.status === "processed")
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 10);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  /** The one thing to do next for an order at this step. */
  const nextStep = (status: OrderStatus) => {
    if (status === "new") return { to: "accepted" as const, label: t("acceptOrder") };
    if (status === "accepted") return { to: "ready" as const, label: t("markReady") };
    if (status === "ready")
      return { to: "processed" as const, label: t("markProcessed") };
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Pending Orders */}
      <div className={PANEL}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-heading">{t("pendingOrders")}</h3>
            <div className="flex items-center gap-4">
              {/* Goes the signal colour only when a drink is waiting to be collected. */}
              <span
                className={`inline-flex items-center gap-2 h-8 pl-2.5 pr-3 rounded-full text-label ${
                  readyCount > 0
                    ? "bg-accent text-accent-contrast"
                    : "bg-text text-text-inverse"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full font-mono text-caption ${
                    readyCount > 0
                      ? "bg-accent-contrast text-accent"
                      : "bg-text-inverse text-text"
                  }`}
                >
                  {pendingOrders.length}
                </span>
                active
              </span>
              {pendingOrders.length > 0 &&
                pendingOrders.some((order) => order.drink_recipe) && (
                  <button
                    onClick={toggleRecipes}
                    className="flex items-center gap-2 h-11 px-3 rounded-md text-label text-text-muted transition-colors duration-(--duration-instant) hover:bg-surface-sunken hover:text-text cursor-pointer"
                  >
                    {showRecipes ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        <span>Hide Recipes</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        <span>Show Recipes</span>
                      </>
                    )}
                  </button>
                )}
            </div>
          </div>
        </div>

        <div className="divide-y divide-border">
          {pendingOrders.length === 0 ? (
            <div className="p-8 text-center text-text-muted">
              <Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-heading text-text">{t("noPendingOrders")}</p>
              <p className="text-body">
                New orders will appear here in real-time
              </p>
            </div>
          ) : (
            pendingOrders.map((order) => {
              const step = nextStep(order.status);

              return (
                <div key={order.id} className="flex items-stretch">
                  {/* Repeats the step as a shape, for reading down the list at a glance. */}
                  <div
                    className={`w-1 shrink-0 ${statusRail(order.status)}`}
                    aria-hidden="true"
                  />

                  <div className="flex-1 min-w-0 p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-caption uppercase text-text-muted">
                          {order.customer_name} · {formatTime(order.created_at)}
                        </p>
                        <p className="text-heading mt-1 break-words">
                          {order.drink_title}
                        </p>
                      </div>

                      <div className="lg:w-52 shrink-0">
                        <span className={statusPill(order.status)}>
                          {t(order.status)}
                        </span>
                      </div>

                      <div className="flex items-center gap-5">
                        {order.status === "new" && (
                          <button
                            onClick={() =>
                              handleUpdateOrderStatus(order.id, "rejected")
                            }
                            disabled={loading}
                            title={t("rejectOrder")}
                            aria-label={t("rejectOrder")}
                            className={REJECT}
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}

                        {step && (
                          <button
                            onClick={() =>
                              handleUpdateOrderStatus(order.id, step.to)
                            }
                            disabled={loading}
                            className={PRIMARY}
                          >
                            {step.label}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Recipe Display */}
                    {order.drink_recipe && showRecipes && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <h4 className="font-mono text-caption uppercase text-text-muted mb-2">
                          Recipe
                        </h4>
                        <div className="text-body text-text-muted whitespace-pre-wrap">
                          {order.drink_recipe}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Recent Completed Orders */}
      {recentOrders.length > 0 && (
        <div className={PANEL}>
          <div className="p-4 border-b border-border">
            <h3 className="text-heading">Recent Completed Orders</h3>
          </div>

          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 transition-colors duration-(--duration-instant) hover:bg-surface-sunken"
              >
                <p className="text-body text-text">
                  {order.customer_name} · {order.drink_title}
                </p>
                <p className="font-mono text-caption uppercase text-text-muted mt-1">
                  {formatTime(order.updated_at)} · {formatDate(order.updated_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${PANEL} p-4`}>
          <p className="font-mono text-caption uppercase text-text-muted">
            Pending
          </p>
          <p className="font-mono text-display mt-2">
            {orders.filter((o) => o.status === "new").length}
          </p>
        </div>

        <div className={`${PANEL} p-4`}>
          <p className="font-mono text-caption uppercase text-text-muted">
            Ready
          </p>
          <p className="font-mono text-display mt-2">{readyCount}</p>
        </div>

        <div className={`${PANEL} p-4`}>
          <p className="font-mono text-caption uppercase text-text-muted">
            Completed Today
          </p>
          <p className="font-mono text-display mt-2">
            {
              orders.filter(
                (o) =>
                  o.status === "processed" &&
                  new Date(o.updated_at).toDateString() ===
                    new Date().toDateString()
              ).length
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrdersTab;
