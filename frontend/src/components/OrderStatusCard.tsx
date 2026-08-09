import React from "react";
import { X } from "lucide-react";
import type { Order } from "../types";
import { statusCard, statusPill } from "../utils/orderStatus";
import { translations } from "../utils/translations";

interface OrderStatusCardProps {
  order: Order;
  t: (key: keyof typeof translations.en) => string;
  onCancelOrder?: (orderId: number) => void;
  loading?: boolean;
}

// The one thing the guest's screen must never fail to say. When the drink is
// ready the whole card turns the signal colour, which is the only place that
// colour is used.
const OrderStatusCard: React.FC<OrderStatusCardProps> = ({
  order,
  t,
  onCancelOrder,
  loading = false,
}) => (
  <section
    aria-label={t("yourOrder")}
    className={`rounded-md border p-4 ${statusCard(order.status)}`}
  >
    <div className="flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-mono text-caption uppercase opacity-80">
          {t("yourOrder")}
        </p>
        <h3 className="text-heading mt-1 break-words">{order.drink_title}</h3>
        <span className={`mt-3 ${statusPill(order.status)}`}>
          {t(order.status)}
        </span>
      </div>

      {order.status !== "processed" && onCancelOrder && (
        <button
          onClick={() => onCancelOrder(order.id)}
          disabled={loading}
          title={t("cancelOrder")}
          className="flex items-center gap-1.5 h-11 px-3 rounded-md border border-current text-label shrink-0 transition-colors duration-(--duration-instant) hover:bg-current/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <X className="w-4 h-4" />
          {t("cancel")}
        </button>
      )}
    </div>
  </section>
);

export default OrderStatusCard;
