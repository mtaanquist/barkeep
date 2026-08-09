import type { Bar } from "../types";

/**
 * Whether the bar is taking orders. The switch closes it outright; a time
 * closes it when that time comes round. The server decides for real — this
 * is so the menu can dim the Order buttons at the same moment.
 */
export function ordersAreClosed(
  bar: Pick<Bar, "orders_closed" | "last_orders_at"> | null | undefined,
  now: number = Date.now()
): boolean {
  if (!bar) return false;
  if (bar.orders_closed === 1) return true;
  if (!bar.last_orders_at) return false;

  const closesAt = new Date(bar.last_orders_at).getTime();
  return !Number.isNaN(closesAt) && now >= closesAt;
}

/**
 * "02:00" typed at ten in the evening means two tomorrow morning, not two
 * this afternoon — a party runs past midnight, so the next time that clock
 * reads it is always what was meant.
 */
export function nextTimeOfDay(clock: string, now: Date = new Date()): Date {
  const [hours, minutes] = clock.split(":").map(Number);
  const when = new Date(now);

  when.setHours(hours, minutes, 0, 0);
  if (when <= now) when.setDate(when.getDate() + 1);

  return when;
}

/** The HH:MM to put back in the field for a stored moment. */
export function timeOfDay(iso: string | null): string {
  if (!iso) return "";

  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";

  return `${String(when.getHours()).padStart(2, "0")}:${String(
    when.getMinutes()
  ).padStart(2, "0")}`;
}
