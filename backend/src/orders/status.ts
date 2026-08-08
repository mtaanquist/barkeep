import type { OrderStatus } from "../../../shared/types.js";
import { HttpError } from "../http.js";

export const ORDER_STATUSES = [
  "new",
  "accepted",
  "rejected",
  "ready",
  "processed",
] as const satisfies readonly OrderStatus[];

/** Which steps may follow each one. */
const NEXT_STEPS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  new: ["accepted", "rejected"],
  accepted: ["ready", "rejected"],
  ready: ["processed"],
  rejected: [],
  processed: [],
};

/** The steps a guest still has something to wait for. */
export const OPEN_STATUSES = ["new", "accepted", "ready"] as const;

export function isOrderStatus(value: unknown): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}

/** Checks a requested step is one that can follow the current one. */
export function assertCanMove(from: OrderStatus, to: OrderStatus): void {
  if (!NEXT_STEPS[from].includes(to)) {
    throw HttpError.badRequest(`Cannot change status from ${from} to ${to}`);
  }
}
