import type { OrderStatus } from "../types";

// How an order looks at each step. Both the guest's page and the bartender's
// queue read from here, so an order never looks like two different things.
//
// Colour is not what tells the steps apart — there are only two hues in the
// whole app. The bar down the left edge, the weight of the type and where the
// order sits in the list do that. Ready is the one step allowed to shout.

/** Background, border and text for the small status label. */
const PILL: Record<OrderStatus, string> = {
  new: "bg-status-new-bg border-status-new-border text-status-new-fg",
  accepted:
    "bg-status-accepted-bg border-status-accepted-border text-status-accepted-fg",
  rejected:
    "bg-status-rejected-bg border-status-rejected-border text-status-rejected-fg",
  ready: "bg-status-ready-bg border-status-ready-border text-status-ready-fg",
  processed:
    "bg-status-processed-bg border-status-processed-border text-status-processed-fg",
};

/** The bar down the left edge of an order, which repeats the step as a shape. */
const RAIL: Record<OrderStatus, string> = {
  new: "bg-status-new-border",
  accepted: "bg-status-accepted-border",
  rejected: "bg-status-rejected-border",
  ready: "bg-accent",
  processed: "bg-status-processed-border",
};

/** The card an order sits on, for the one the guest is watching. */
const CARD: Record<OrderStatus, string> = {
  new: "bg-status-new-bg border-status-new-border text-status-new-fg",
  accepted:
    "bg-status-accepted-bg border-status-accepted-border text-status-accepted-fg",
  rejected:
    "bg-status-rejected-bg border-status-rejected-border text-status-rejected-fg",
  ready: "bg-status-ready-bg border-status-ready-border text-status-ready-fg",
  processed:
    "bg-status-processed-bg border-status-processed-border text-status-processed-fg",
};

const PILL_SHAPE =
  "inline-flex items-center h-7 px-2.5 rounded-sm border font-mono text-caption uppercase whitespace-nowrap";

/** The small label saying which step an order is at. */
export const statusPill = (status: OrderStatus): string =>
  `${PILL_SHAPE} ${PILL[status]}`;

/** The bar down the left edge of an order in the queue. */
export const statusRail = (status: OrderStatus): string => RAIL[status];

/** Background, border and text for a card showing a single order. */
export const statusCard = (status: OrderStatus): string => CARD[status];

/** True for the one step that is meant to be noticed across a room. */
export const isReady = (status: OrderStatus): boolean => status === "ready";
