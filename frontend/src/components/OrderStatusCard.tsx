import React from "react";
import { X } from "lucide-react";
import { translations } from "../utils/translations";

interface OrderStatusCardProps {
  order: any;
  t: (key: keyof typeof translations.en) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusColor: (status: string) => string;
  onCancelOrder?: (orderId: number) => void;
  loading?: boolean;
}

const OrderStatusCard: React.FC<OrderStatusCardProps> = ({
  order,
  t,
  getStatusIcon,
  getStatusColor,
  onCancelOrder,
  loading = false,
}) => (
  <div className={`rounded-lg border-2 p-4 ${getStatusColor(order.status)}`}>
    <div className="flex items-center space-x-3">
      {getStatusIcon(order.status)}
      <div className="flex-1">
        <h3 className="font-semibold">{t("yourOrder")}</h3>
        <p className="text-sm opacity-90">{order.drink_title}</p>
        <p className="text-xs opacity-75">
          {t("orderStatus")}: {t(order.status)}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        {order.status === "ready" && (
          <div className="text-right">
            <div className="text-lg font-bold">🎉</div>
            <div className="text-xs font-medium">Ready!</div>
          </div>
        )}
        {order.status !== "processed" && onCancelOrder && (
          <button
            onClick={() => onCancelOrder(order.id)}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t("cancelOrder")}
          >
            <X className="w-3 h-3" />
            {t("cancel")}
          </button>
        )}
      </div>
    </div>
  </div>
); 

export default OrderStatusCard;
