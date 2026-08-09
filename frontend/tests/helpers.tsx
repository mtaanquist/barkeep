import type { ReactNode } from "react";
import { vi } from "vitest";
import { AppProvider } from "../src/context/AppContext";
import type { Bar, Drink, Order, OrderStatus } from "../src/types";

/** A bar with nothing unusual about it. */
export const aBar = (extra: Partial<Bar> = {}): Bar => ({
  id: 1,
  name: "The Spotted Cow",
  language: "en",
  skip_approval: 0,
  orders_closed: 0,
  max_active_orders: 1,
  created_at: "2025-07-13 14:23:32",
  ...extra,
});

export const aDrink = (extra: Partial<Drink> = {}): Drink => ({
  id: 1,
  bar_id: 1,
  title: "Negroni",
  image_url: null,
  recipe: "gin, campari, vermouth",
  in_stock: 1,
  base_spirit: "Gin",
  guest_description: null,
  show_recipe_to_guests: 0,
  category_id: null,
  category_name: null,
  image_crop_x: 0,
  image_crop_y: 0,
  image_crop_zoom: 1,
  created_at: "2025-07-13 14:23:32",
  ...extra,
});

export const anOrder = (extra: Partial<Order> = {}): Order => ({
  id: 1,
  bar_id: 1,
  customer_name: "Ada",
  drink_id: 1,
  drink_title: "Negroni",
  status: "new" as OrderStatus,
  created_at: "2025-07-13 14:23:32",
  updated_at: "2025-07-13 14:23:32",
  ...extra,
});

/** Signs someone in, the way a real session is remembered. */
export function signIn({
  bar = aBar(),
  as = "guest",
  name = "Ada",
}: { bar?: Bar; as?: "guest" | "bartender"; name?: string } = {}): void {
  localStorage.setItem("homeBarSystem_userType", JSON.stringify(as));
  localStorage.setItem("homeBarSystem_currentBar", JSON.stringify(bar));
  // Signing in is also what settles which language the app reads in.
  localStorage.setItem("homeBarSystem_language", JSON.stringify(bar.language));
  if (as === "guest") {
    localStorage.setItem("homeBarSystem_customerName", JSON.stringify(name));
  }
}

export interface FakeApi {
  /** Every request made, oldest first. */
  calls: Array<{ path: string; method: string; body: unknown }>;
  /** How many requests went to a path containing this. */
  countOf: (fragment: string) => number;
}

/**
 * Stands in for the server. `reply` gets the path and returns the body;
 * returning undefined answers with a 404, so a route nobody set up is
 * obvious rather than silently empty.
 */
export function fakeApi(
  reply: (path: string, options: RequestInit) => unknown
): FakeApi {
  const calls: FakeApi["calls"] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit = {}) => {
      const path = String(url);
      calls.push({
        path,
        method: options.method ?? "GET",
        body: options.body ? JSON.parse(String(options.body)) : undefined,
      });

      const body = reply(path, options);

      return {
        ok: body !== undefined,
        status: body === undefined ? 404 : 200,
        json: async () => body ?? { error: "Not found" },
      } as Response;
    })
  );

  return {
    calls,
    countOf: (fragment) => calls.filter((c) => c.path.includes(fragment)).length,
  };
}

/** Wraps whatever is being tested in the shared state the pages expect. */
export const withApp = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

type Listener = ((event: MessageEvent) => void) | null;

/**
 * A stand-in for the browser's own EventSource, which jsdom does not have.
 * Tests drive it by hand: open it, send an update, make it fail.
 */
export class FakeEventSource {
  static opened: FakeEventSource[] = [];

  onopen: (() => void) | null = null;
  onmessage: Listener = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.opened.push(this);
  }

  close(): void {
    this.closed = true;
  }

  /** The ones still connected, which is what a leak would show up in. */
  static get live(): FakeEventSource[] {
    return FakeEventSource.opened.filter((s) => !s.closed);
  }

  static reset(): void {
    FakeEventSource.opened = [];
  }

  connect(): void {
    this.onopen?.();
  }

  send(update: unknown): void {
    this.onmessage?.({ data: JSON.stringify(update) } as MessageEvent);
  }

  drop(): void {
    this.onerror?.();
  }
}
