// Shapes the API sends and receives. Imported by both halves so a change on
// one side shows up as an error on the other.
//
// Types only, no code. Nothing here exists once it is built, so neither half
// has to bundle or ship it.

export type Language = "en" | "da";

export type UserType = "bartender" | "guest";

/**
 * SQLite has no boolean, so these arrive as 0 or 1. Typed honestly rather
 * than as `boolean`, which is what the frontend used to claim.
 */
export type Flag = 0 | 1;

/** The steps an order moves through. */
export type OrderStatus =
  | "new"
  | "accepted"
  | "rejected"
  | "ready"
  | "processed";

export interface Bar {
  id: number;
  name: string;
  language: Language;
  skip_approval: Flag;
  /** Last orders: the bar serves what is in, but takes nothing new. */
  orders_closed: Flag;
  /** How many drinks one guest may have on the go at once. */
  max_active_orders: number;
  /**
   * When the bar stops taking orders on its own, as a full moment rather
   * than a time of day. Empty means only the switch above decides.
   */
  last_orders_at: string | null;
  created_at: string;
}

export interface Category {
  id: number;
  bar_id: number;
  name: string;
  created_at: string;
}

export interface Drink {
  id: number;
  bar_id: number;
  title: string;
  image_url: string | null;
  recipe: string | null;
  in_stock: Flag;
  base_spirit: string | null;
  guest_description: string | null;
  show_recipe_to_guests: Flag;
  category_id: number | null;
  image_crop_x: number;
  image_crop_y: number;
  image_crop_zoom: number;
  created_at: string;
}

/** A drink as listed, with its category name filled in. */
export interface DrinkWithCategory extends Drink {
  category_name: string | null;
}

/** A drink as a guest sees it, with favourites marked. */
export interface DrinkForGuest extends DrinkWithCategory {
  is_favourite?: Flag;
}

export interface Order {
  id: number;
  bar_id: number;
  customer_name: string;
  drink_id: number;
  drink_title: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

/** An order as the bartender sees it, with the recipe to hand. */
export interface OrderForBartender extends Order {
  drink_recipe?: string | null;
}

export interface Favourite {
  id: number;
  bar_id: number;
  customer_name: string;
  drink_id: number;
  created_at: string;
}

/**
 * The reply to signing in, and to `GET /api/auth/me`, which reads the cookie
 * back to say who is signed in (or answers 401 with `ApiError`).
 */
export interface SignedIn {
  success: true;
  userType: UserType;
  bar: Bar;
  /** Only when a guest signs in. */
  customerName?: string;
}

/**
 * One bar as the operator panel sees it: enough to tell live bars apart, spot a
 * dead one, and know when each was last used. The operator sees retired bars
 * too, which is why `deletedAt` is here and not on the guest-facing `Bar`.
 */
export interface OperatorBar {
  id: number;
  name: string;
  created_at: string;
  /** The most recent order, or null if the bar has never taken one. */
  lastUsed: string | null;
  /** When the bar was retired, or null while it is live. */
  deletedAt: string | null;
  drinkCount: number;
  orderCount: number;
}

/** The reply to `GET /api/operator/me`, or 401 with `ApiError` when not signed in. */
export interface OperatorMe {
  operator: true;
}

/** A printable code that takes a guest straight to the bar. */
export interface BarQrCode {
  barId: number;
  barName: string;
  url: string;
  /** The image itself, ready to drop into an <img>. */
  qrCode: string;
}

/** How busy the bar has been, for the reports tab. */
export interface OrderAnalytics {
  totalOrders: number;
  ordersToday: number;
  recentOrders: number;
  popularDrinks: Array<{ drink_title: string; order_count: number }>;
  peakHours: Array<{ hour: string; count: number }>;
  statusDistribution: Array<{ status: OrderStatus; count: number }>;
  averageOrdersPerDay: number;
  /** The window the numbers cover, e.g. "30 days". */
  period: string;
}

/** What is on the menu, for the reports tab. */
export interface DrinkAnalytics {
  popularDrinks: Array<{ drink_title: string; order_count: number }>;
  totalDrinks: number;
  inStockDrinks: number;
}

/** What the server pushes to browsers watching a bar. */
export type LiveUpdate =
  | { type: "new_order"; order: Order; timestamp: string }
  | { type: "order_status_updated"; order: Order; timestamp: string }
  | { type: "order_deleted"; orderId: number; timestamp: string };

export interface ApiError {
  error: string;
  message?: string;
}
