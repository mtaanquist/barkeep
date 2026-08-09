import React, { useCallback, useEffect, useState } from "react";
import { BarChart3, TrendingUp, Coffee, Clock, Star } from "lucide-react";
import { useApp } from "../hooks/useApp";
import type { OrderStatus } from "../types";
import { statusCard, statusRail } from "../utils/orderStatus";
import { useTranslation } from "../utils/translations";
import StatCard from "./analytics/StatCard";
import StatList from "./analytics/StatList";
import RankedBars from "./analytics/RankedBars";

/** The steps an order goes through. How each one is drawn comes from the
    shared status helper, so this never drifts from the queue. */
const STATUSES: OrderStatus[] = [
  "new",
  "accepted",
  "rejected",
  "ready",
  "processed",
];

const isToday = (when: string): boolean =>
  new Date(when).toDateString() === new Date().toDateString();

const AnalyticsTab: React.FC = () => {
  const { currentBar, language, analytics, orders, setAnalytics, apiCall } =
    useApp();

  const t = useTranslation(language);
  const barId = currentBar?.id;

  // The server has always accepted a window and the page never asked for
  // one, so seven days was the only report anyone could see.
  const [days, setDays] = useState(7);

  const fetchAnalytics = useCallback(async () => {
    if (!barId) return;
    try {
      setAnalytics(
        await apiCall(`/orders/bar/${barId}/analytics?days=${days}`)
      );
    } catch (err) {
      console.error("Could not load the reports:", err);
    }
  }, [barId, days, apiCall, setAnalytics]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (!analytics) {
    return (
      <div className="bg-surface-raised rounded-md border p-8 text-center">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-text-muted" />
        <h3 className="text-lg font-medium text-text mb-2">
          {t("loadingAnalytics")}
        </h3>
        <p className="text-text-muted">{t("gatheringData")}</p>
      </div>
    );
  }

  const topDrink = analytics.popularDrinks[0]?.drink_title;
  const completedToday = orders.filter(
    (order) => order.status === "processed" && isToday(order.updated_at)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-heading">{t("analytics")}</h2>
        <label className="flex items-center gap-2 ml-auto">
          <span className="font-mono text-caption uppercase text-text-muted">
            {t("reportingWindow")}
          </span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-11 px-3 rounded-md border border-border bg-surface-raised text-label cursor-pointer focus:outline-none focus:border-border-strong focus:shadow-focus"
          >
            <option value={7}>{t("lastSevenDays")}</option>
            <option value={30}>{t("lastThirtyDays")}</option>
            <option value={90}>{t("lastNinetyDays")}</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<BarChart3 className="w-6 h-6 text-text-muted" />}
          tint="bg-surface-sunken"
          label={t("totalOrders")}
          value={analytics.totalOrders}
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6 text-text-muted" />}
          tint="bg-surface-sunken"
          label={t("ordersToday")}
          value={analytics.ordersToday}
        />
        <StatCard
          icon={<Coffee className="w-6 h-6 text-text-muted" />}
          tint="bg-surface-sunken"
          label="Top Drink"
          value={topDrink || "N/A"}
          small
        />
        <StatCard
          icon={<Clock className="w-6 h-6 text-text-muted" />}
          tint="bg-surface-sunken"
          label="Peak Hour"
          value={analytics.peakHours[0]?.hour || "N/A"}
          small
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankedBars
          icon={<Star className="w-5 h-5 text-text-muted mr-2" />}
          heading={t("popularDrinks")}
          rows={analytics.popularDrinks.map((d) => ({
            label: d.drink_title,
            value: d.order_count,
          }))}
          emptyIcon={<Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />}
          emptyMessage="No order data yet"
          barColour="bg-text"
        />

        <RankedBars
          icon={<Clock className="w-5 h-5 text-text-muted mr-2" />}
          heading={t("peakHours")}
          rows={analytics.peakHours.map((h) => ({
            label: h.hour,
            value: h.count,
          }))}
          emptyIcon={<Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />}
          emptyMessage="No peak hour data yet"
          barColour="bg-text"
        />
      </div>

      <div className="bg-surface-raised rounded-md border p-6">
        <h3 className="text-lg font-semibold text-text mb-6">
          {t("statusDistribution")}
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {STATUSES.map((status) => (
            <div
              key={status}
              className={`rounded-md border p-4 text-center ${statusCard(status)}`}
            >
              <div
                className={`w-4 h-4 rounded-full mx-auto mb-2 ${statusRail(status)}`}
              />
              <p className="text-label">{t(status)}</p>
              <p className="font-mono text-display mt-1">
                {orders.filter((order) => order.status === status).length}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-raised rounded-md border p-6">
        <h3 className="text-lg font-semibold text-text mb-6">
          {t("recentActivity")}
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
