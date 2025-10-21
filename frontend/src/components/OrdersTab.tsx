import React, { useState } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  Coffee,
  Check,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { useTranslation } from "../utils/translations";

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
  
  // Track which orders have their recipe expanded
  const [expandedRecipes, setExpandedRecipes] = useState<Set<number>>(new Set());

  const toggleRecipe = (orderId: number) => {
    setExpandedRecipes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
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
                status: status as any,
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "new":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "accepted":
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case "rejected":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "ready":
        return <Coffee className="w-5 h-5 text-green-500" />;
      case "processed":
        return <Check className="w-5 h-5 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-yellow-50 border-yellow-200";
      case "accepted":
        return "bg-blue-50 border-blue-200";
      case "rejected":
        return "bg-red-50 border-red-200";
      case "ready":
        return "bg-green-50 border-green-200";
      case "processed":
        return "bg-gray-50 border-gray-200";
      default:
        return "bg-white border-gray-200";
    }
  };

  const pendingOrders = orders.filter((order) =>
    ["new", "accepted", "ready"].includes(order.status)
  );

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

  return (
    <div className="space-y-6">
      {/* Pending Orders */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">
              {t("pendingOrders")}
            </h3>
            <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
              {pendingOrders.length} active
            </span>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {pendingOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">{t("noPendingOrders")}</p>
              <p className="text-sm">
                New orders will appear here in real-time
              </p>
            </div>
          ) : (
            pendingOrders.map((order) => (
              <div
                key={order.id}
                className={`p-4 ${getStatusColor(order.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(order.status)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold text-gray-800">
                          {order.customer_name}
                        </span>
                      </div>
                      <div className="text-lg font-medium text-gray-900 mt-1">
                        {order.drink_title}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatTime(order.created_at)}</span>
                        </div>
                        <span className="capitalize">
                          Status: {t(order.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {order.status === "new" && (
                      <>
                        <button
                          onClick={() =>
                            handleUpdateOrderStatus(order.id, "accepted")
                          }
                          disabled={loading}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                          {t("acceptOrder")}
                        </button>
                        <button
                          onClick={() =>
                            handleUpdateOrderStatus(order.id, "rejected")
                          }
                          disabled={loading}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                          {t("rejectOrder")}
                        </button>
                      </>
                    )}

                    {order.status === "accepted" && (
                      <button
                        onClick={() =>
                          handleUpdateOrderStatus(order.id, "ready")
                        }
                        disabled={loading}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                      >
                        {t("markReady")}
                      </button>
                    )}

                    {order.status === "ready" && (
                      <button
                        onClick={() =>
                          handleUpdateOrderStatus(order.id, "processed")
                        }
                        disabled={loading}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm font-medium"
                      >
                        {t("markProcessed")}
                      </button>
                    )}
                  </div>
                </div>

                {/* Recipe Toggle and Display */}
                {order.drink_recipe && (
                  <div className="mt-3 border-t pt-3">
                    <button
                      onClick={() => toggleRecipe(order.id)}
                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors text-sm font-medium"
                    >
                      {expandedRecipes.has(order.id) ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          <span>Hide Recipe</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          <span>Show Recipe</span>
                        </>
                      )}
                    </button>
                    
                    {expandedRecipes.has(order.id) && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                        <h4 className="font-semibold text-gray-700 mb-2">Recipe:</h4>
                        <div className="text-sm text-gray-600 whitespace-pre-wrap">
                          {order.drink_recipe}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Completed Orders */}
      {recentOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-800">
              Recent Completed Orders
            </h3>
          </div>

          <div className="divide-y divide-gray-200">
            {recentOrders.map((order) => (
              <div key={order.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Check className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-800">
                          {order.customer_name}
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-600">
                          {order.drink_title}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        Completed at {formatTime(order.updated_at)} on{" "}
                        {formatDate(order.updated_at)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {orders.filter((o) => o.status === "new").length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Coffee className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Ready</p>
              <p className="text-2xl font-bold text-gray-900">
                {orders.filter((o) => o.status === "ready").length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Check className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">
                Completed Today
              </p>
              <p className="text-2xl font-bold text-gray-900">
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
      </div>
    </div>
  );
};

export default OrdersTab;
