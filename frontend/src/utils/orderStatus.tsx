import { Check, CheckCircle, Clock, Coffee, XCircle } from "lucide-react";
import type { OrderStatus } from "../types";

// How an order looks at each step. Both the guest's page and the bartender's
// queue read from here, so an order never looks like two different things.

const ICONS: Record<OrderStatus, React.ReactNode> = {
  new: <Clock className="w-5 h-5 text-yellow-500" />,
  accepted: <CheckCircle className="w-5 h-5 text-blue-500" />,
  rejected: <XCircle className="w-5 h-5 text-red-500" />,
  ready: <Coffee className="w-5 h-5 text-green-500" />,
  processed: <Check className="w-5 h-5 text-gray-500" />,
};

const CARD: Record<OrderStatus, string> = {
  new: "bg-yellow-50 border-yellow-200",
  accepted: "bg-blue-50 border-blue-200",
  rejected: "bg-red-50 border-red-200",
  ready: "bg-green-50 border-green-200",
  processed: "bg-gray-50 border-gray-200",
};

const TEXT: Record<OrderStatus, string> = {
  new: "text-yellow-800",
  accepted: "text-blue-800",
  rejected: "text-red-800",
  ready: "text-green-800",
  processed: "text-gray-800",
};

export const statusIcon = (status: OrderStatus): React.ReactNode =>
  ICONS[status];

/** Background and border, for a card sitting among others. */
export const statusCard = (status: OrderStatus): string => CARD[status];

/** The same, plus a matching text colour, for a card on its own. */
export const statusCardWithText = (status: OrderStatus): string =>
  `${CARD[status]} ${TEXT[status]}`;
