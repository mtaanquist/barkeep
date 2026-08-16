import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../src/App";
import {
  aDrink,
  anOrder,
  fakeApi,
  FakeEventSource,
  signIn,
} from "./helpers";

let orders: ReturnType<typeof anOrder>[];
let menu: ReturnType<typeof aDrink>[];

const serve = () => {
  fakeApi((path) => {
    if (path.includes("/analytics"))
      return {
        totalOrders: 2,
        ordersToday: 2,
        recentOrders: 2,
        popularDrinks: [],
        peakHours: [],
        statusDistribution: [],
        averageOrdersPerDay: 2,
        period: "30 days",
      };
    if (path.includes("/categories")) return [];
    if (path.includes("/drinks/bar/")) return menu;
    if (path.includes("/orders/bar/")) return orders;
    return undefined;
  });
};

const openBar = (at = "/bartender") => {
  window.history.pushState({}, "", at);
  return render(<App />);
};

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
  signIn({ as: "bartender" });
  orders = [
    anOrder({ id: 1, status: "new", drink_title: "Negroni" }),
    anOrder({ id: 2, status: "accepted", drink_title: "Daiquiri" }),
  ];
  menu = [aDrink({ id: 1, title: "Negroni" })];
  serve();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("finding your way around the bar", () => {
  // The screens used to be remembered state rather than addresses, so the
  // back button did nothing and none of them could be linked to.
  it("puts the queue at its own address", async () => {
    openBar();

    await screen.findByRole("heading", { name: "Pending Orders" });
    expect(window.location.pathname).toBe("/bartender/queue");
  });

  it("opens a setup screen directly, without going through the queue", async () => {
    openBar("/bartender/categories");

    await waitFor(() =>
      expect(window.location.pathname).toBe("/bartender/categories")
    );
    expect(
      screen.queryByRole("heading", { name: "Pending Orders" })
    ).toBeNull();
  });

  it("goes back to where it was before", async () => {
    openBar();
    await screen.findByRole("heading", { name: "Pending Orders" });

    await userEvent.click(screen.getAllByRole("link", { name: "Settings" })[0]);
    await waitFor(() =>
      expect(window.location.pathname).toBe("/bartender/settings")
    );

    window.history.back();

    await waitFor(() =>
      expect(window.location.pathname).toBe("/bartender/queue")
    );
  });

  // Rule two of the shell: nothing may render over the count or in place of
  // it, because an order arriving is the thing the bartender must not miss.
  it("keeps the pending count on screen while setting up", async () => {
    openBar("/bartender/settings");

    const toQueue = await screen.findAllByRole("button", {
      name: /Pending Orders/,
    });
    expect(toQueue.length).toBeGreaterThan(0);
    expect(within(toQueue[0]).getByText("2")).toBeInTheDocument();
  });

  it("gets back to the queue in one go from anywhere", async () => {
    openBar("/bartender/analytics");

    const toQueue = await screen.findAllByRole("button", {
      name: /Pending Orders/,
    });
    await userEvent.click(toQueue[0]);

    await waitFor(() =>
      expect(window.location.pathname).toBe("/bartender/queue")
    );
  });
});

// The recipe used to be one switch for the whole queue, which opened every
// order at once and forgot itself on the way back from another screen.
describe("reading a recipe while making the drink", () => {
  it("opens the drink to read when its order is tapped", async () => {
    openBar("/bartender/queue");

    await userEvent.click(await screen.findByRole("button", { name: "Negroni" }));

    expect(
      await screen.findByRole("dialog", { name: "Negroni" })
    ).toBeInTheDocument();
  });

  // The tap target lies across the row, so the buttons on it have to stay
  // reachable — accepting is the thing that must not become a lucky hit.
  it("leaves the order's own buttons working", async () => {
    openBar("/bartender/queue");

    await userEvent.click(
      await screen.findByRole("button", { name: "Accept" })
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).toBeNull()
    );
    await screen.findByRole("button", { name: "Mark Ready" });
  });

  // A drink can be taken off the menu while an order for it is still waiting.
  it("still opens an order whose drink has left the menu", async () => {
    orders = [
      anOrder({
        id: 3,
        status: "accepted",
        drink_id: 99,
        drink_title: "Sazerac",
        drink_recipe: "rye, absinthe, sugar",
      }),
    ];
    serve();
    openBar("/bartender/queue");

    await userEvent.click(await screen.findByRole("button", { name: "Sazerac" }));

    expect(
      await screen.findByRole("dialog", { name: "Sazerac" })
    ).toBeInTheDocument();
  });
});

// Finding a recipe used to mean scrolling the whole menu and opening the
// drink's edit form, which is no good with a queue waiting.
describe("finding a drink without leaving the queue", () => {
  const stock = () => {
    menu = [
      aDrink({ id: 1, title: "Negroni" }),
      aDrink({ id: 5, title: "Sazerac" }),
      aDrink({ id: 6, title: "Crème de Menthe" }),
    ];
    serve();
  };

  it("is on hand from the queue, not only from the menu", async () => {
    stock();
    openBar("/bartender/queue");

    const field = await screen.findByRole("searchbox", {
      name: "Search drinks",
    });
    await userEvent.type(field, "saz");

    await userEvent.click(await screen.findByRole("button", { name: "Sazerac" }));

    expect(
      await screen.findByRole("dialog", { name: "Sazerac" })
    ).toBeInTheDocument();
  });

  // Nobody types the accent, and nobody matches the bartender's capitals.
  it("finds a drink however its name was typed", async () => {
    stock();
    openBar("/bartender/queue");

    await userEvent.type(
      await screen.findByRole("searchbox", { name: "Search drinks" }),
      "CREME DE"
    );

    expect(
      await screen.findByRole("button", { name: "Crème de Menthe" })
    ).toBeInTheDocument();
  });

  it("says so when nothing matches", async () => {
    stock();
    openBar("/bartender/queue");

    await userEvent.type(
      await screen.findByRole("searchbox", { name: "Search drinks" }),
      "espresso martini"
    );

    expect(await screen.findByText("Nothing matches")).toBeInTheDocument();
  });
});
