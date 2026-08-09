import React from "react";
import { Eye, Package } from "lucide-react";
import type { Drink, Order } from "../types";
import { TranslationKeys } from "../utils/translations";

interface PastOrdersProps {
  orders: Order[];
  drinks: Drink[];
  customerName: string;
  customerOrder: Order | undefined;
  loading: boolean;
  t: (key: TranslationKeys) => string;
  handlePlaceOrder: (drink: Drink) => void;
  setViewingRecipe?: (drink: Drink) => void;
}

const PastOrders: React.FC<PastOrdersProps> = ({
  orders,
  drinks,
  customerName,
  customerOrder,
  loading,
  t,
  handlePlaceOrder,
  setViewingRecipe,
}) => {
  const pastOrders = orders
    .filter(
      (order) =>
        order.customer_name === customerName && order.status === "processed" // Only show completed orders
    )
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

  const formatOrderDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (pastOrders.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="w-12 h-12 mx-auto mb-3 opacity-50 text-text-muted" />
        <p className="text-text-muted">No past orders found</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-text mb-4">
        {t("pastOrders")}
      </h2>
      <div className="space-y-3">
        {pastOrders.map((order) => {
          const drink = drinks.find((d) => d.id === order.drink_id);
          const isInStock = drink && drink.in_stock;
          const canReorder = isInStock && !customerOrder && !loading;

          return (
            <div
              key={order.id}
              className="bg-surface-raised border rounded-md p-4"
            >
              <div className="flex gap-4">
                {/* Drink Image */}
                <div className="w-20 h-20 flex-shrink-0 overflow-hidden rounded-md relative">
                  {drink?.image_url ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <img
                        src={drink.image_url}
                        alt={drink.title}
                        className="w-full h-full object-contain"
                        style={{
                          transform: `translate(${drink.image_crop_x || 0}%, ${drink.image_crop_y || 0}%) scale(${drink.image_crop_zoom || 1})`,
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-surface-sunken flex items-center justify-center">
                      <Package className="w-6 h-6 text-text-muted" />
                    </div>
                  )}
                </div>

                {/* Drink Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-text text-lg">
                        {drink ? drink.title : order.drink_title}
                      </h3>
                      {drink?.base_spirit && (
                        <p className="text-sm text-text-muted">
                          {drink.base_spirit}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm text-text-muted">
                      {formatOrderDate(order.created_at)}
                    </div>
                  </div>

                  {!isInStock && drink && (
                    <div className="mb-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-status-rejected-bg text-danger">
                        Out of Stock
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {drink && setViewingRecipe && (
                      <button
                        onClick={() => setViewingRecipe(drink)}
                        className="flex items-center gap-1 bg-surface-sunken text-text py-2 px-3 rounded-md text-sm hover:bg-surface-sunken transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View Recipe
                      </button>
                    )}

                    <button
                      onClick={() => drink && handlePlaceOrder(drink)}
                      disabled={!canReorder}
                      className="flex items-center gap-1 bg-text text-text-inverse py-2 px-4 rounded-md text-sm hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        !drink
                          ? "Drink no longer available"
                          : !isInStock
                          ? "Drink is out of stock"
                          : customerOrder
                          ? "You already have an active order"
                          : "Reorder this drink"
                      }
                    >
                      <Package className="w-4 h-4" />
                      {t("reorder")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PastOrders;
