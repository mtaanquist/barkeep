import type { Bar } from "../../../shared/types.js";

/**
 * Whether the bar is taking orders. Two ways it can stop: the bartender
 * flicks the switch, or the time they set for last orders has come round.
 *
 * Worked out when it is asked rather than by a timer, so a restart in the
 * middle of the evening cannot lose it.
 */
export function ordersAreClosed(
  bar: Pick<Bar, "orders_closed" | "last_orders_at">,
  now: Date = new Date()
): boolean {
  if (bar.orders_closed === 1) return true;
  if (!bar.last_orders_at) return false;

  const closesAt = new Date(bar.last_orders_at);
  return !Number.isNaN(closesAt.getTime()) && now >= closesAt;
}
