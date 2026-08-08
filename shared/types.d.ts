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

/** What the server pushes to browsers watching a bar. */
export type LiveUpdate =
  | { type: "new_order"; order: Order; timestamp: string }
  | { type: "order_status_updated"; order: Order; timestamp: string }
  | { type: "order_deleted"; orderId: number; timestamp: string };

export interface ApiError {
  error: string;
  message?: string;
}
