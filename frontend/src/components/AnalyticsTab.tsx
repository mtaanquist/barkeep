import React, { useCallback, useEffect } from "react";
import { BarChart3, TrendingUp, Coffee, Clock, Star } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { OrderStatus } from "../types";
import { useTranslation } from "../utils/translations";
import StatCard from "./analytics/StatCard";
import StatList from "./analytics/StatList";
import RankedBars from "./analytics/RankedBars";

/** The steps an order goes through, and how each is drawn. */
const STATUS_TILES: Array<{
  status: OrderStatus;
  label: string;
  dot: string;
  tint: string;
  text: string;
}> = [
  {
    status: "new",
    label: "New",
    dot: "bg-yellow-500",
    tint: "bg-yellow-50",
    text: "text-yellow-700",
  },
  {
    status: "accepted",
    label: "Accepted",
    dot: "bg-blue-500",
    tint: "bg-blue-50",
    text: "text-blue-700",
  },
  {
    status: "rejected",
    label: "Rejected",
    dot: "bg-red-500",
    tint: "bg-red-50",
    text: "text-red-700",
  },
  {
    status: "ready",
    label: "Ready",
    dot: "bg-green-500",
    tint: "bg-green-50",
    text: "text-green-700",
  },
  {
    status: "processed",
    label: "Completed",
    dot: "bg-gray-500",
    tint: "bg-gray-50",
    text: "text-gray-700",
  },
];

const isToday = (when: string): boolean =>
  new Date(when).toDateString() === new Date().toDateString();

const AnalyticsTab: React.FC = () => {
  const { currentBar, language, analytics, orders, setAnalytics, apiCall } =
    useApp();

  const t = useTranslation(language);
  const barId = currentBar?.id;

  const fetchAnalytics = useCallback(async () => {
    if (!barId) return;
    try {
      setAnalytics(await apiCall(`/orders/bar/${barId}/analytics`));
    } catch (err) {
      console.error("Could not load the reports:", err);
    }
  }, [barId, apiCall, setAnalytics]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (!analytics) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Loading Analytics...
        </h3>
        <p className="text-gray-600">Gathering data from your orders</p>
      </div>
    );
  }

  const topDrink = analytics.popularDrinks[0]?.drink_title;
  const completedToday = orders.filter(
    (order) => order.status === "processed" && isToday(order.updated_at)
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<BarChart3 className="w-6 h-6 text-blue-600" />}
          tint="bg-blue-100"
          label={t("totalOrders")}
          value={analytics.totalOrders}
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6 text-green-600" />}
          tint="bg-green-100"
          label={t("ordersToday")}
          value={analytics.ordersToday}
        />
        <StatCard
          icon={<Coffee className="w-6 h-6 text-purple-600" />}
          tint="bg-purple-100"
          label="Top Drink"
          value={topDrink || "N/A"}
          small
        />
        <StatCard
          icon={<Clock className="w-6 h-6 text-yellow-600" />}
          tint="bg-yellow-100"
          label="Peak Hour"
          value={analytics.peakHours[0]?.hour || "N/A"}
          small
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankedBars
          icon={<Star className="w-5 h-5 text-yellow-500 mr-2" />}
          heading={t("popularDrinks")}
          rows={analytics.popularDrinks.map((d) => ({
            label: d.drink_title,
            value: d.order_count,
          }))}
          emptyIcon={<Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />}
          emptyMessage="No order data yet"
          barColour="bg-blue-600"
        />

        <RankedBars
          icon={<Clock className="w-5 h-5 text-green-500 mr-2" />}
          heading={t("peakHours")}
          rows={analytics.peakHours.map((h) => ({
            label: h.hour,
            value: h.count,
          }))}
          emptyIcon={<Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />}
          emptyMessage="No peak hour data yet"
          barColour="bg-green-600"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">
          Order Status Distribution
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {STATUS_TILES.map(({ status, label, dot, tint, text }) => (
            <div key={status} className={`${tint} rounded-lg p-4 text-center`}>
              <div className={`w-4 h-4 ${dot} rounded-full mx-auto mb-2`} />
              <p className={`text-sm font-medium ${text}`}>{label}</p>
              <p className="text-2xl font-bold text-gray-900">
                {orders.filter((order) => order.status === status).length}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">
          Recent Activity Summary
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatList
            heading="Today's Performance"
            rows={[
              { label: "Orders placed", value: analytics.ordersToday },
              { label: "Orders completed", value: completedToday },
              {
                label: "Completion rate",
                value: `${
                  analytics.ordersToday > 0
                    ? Math.round((completedToday / analytics.ordersToday) * 100)
                    : 0
                }%`,
              },
            ]}
          />

          <StatList
            heading="All Time Stats"
            rows={[
              { label: "Total orders", value: analytics.totalOrders },
              {
                // The server works this out over the report's window, so the
                // label says which window rather than implying all time.
                label: `Avg orders per day (last ${analytics.period})`,
                value: analytics.averageOrdersPerDay,
              },
              { label: "Most popular drink", value: topDrink || "None" },
            ]}
          />
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
