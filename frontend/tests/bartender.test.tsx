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
  type FakeApi,
} from "./helpers";

let orders: ReturnType<typeof anOrder>[];
let menu: ReturnType<typeof aDrink>[];

let api: FakeApi;

const serve = () => {
  api = fakeApi((path) => {
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
    // The status change the Accept button sends. Without this it 404s and the
    // order never moves, which is how this file used to look green for nothing.
    if (/\/orders\/\d+\/status$/.test(path)) return { success: true };
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

// Reading a recipe used to mean the one switch in the header, which opens
// every pending order at once. That switch is still there on purpose; this is
// the way to one recipe without unfolding the rest of the queue.
describe("reading a recipe while making the drink", () => {
  it("opens the drink to read when its order is tapped", async () => {
    openBar("/bartender/queue");

    await userEvent.click(await screen.findByRole("button", { name: "Negroni" }));

    expect(
      await screen.findByRole("dialog", { name: "Negroni" })
    ).toBeInTheDocument();
  });

  // Accepting must not become a lucky hit now that the row itself is a tap
  // target. Whether the two overlap on screen is a question for a real
  // browser; what this pins down is that Accept still does its own job and
  // does not open the recipe on the way.
  it("accepts the order from its own button, without opening the drink", async () => {
    orders = [anOrder({ id: 1, status: "new", drink_title: "Negroni" })];
    serve();
    openBar("/bartender/queue");

    await userEvent.click(await screen.findByRole("button", { name: "Accept" }));

    await waitFor(() =>
      expect(
        api.calls.some(
          (call) =>
            call.method === "PATCH" &&
            call.path.includes("/orders/1/status") &&
            (call.body as { status?: string })?.status === "accepted"
        )
      ).toBe(true)
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
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

    const dialog = await screen.findByRole("dialog", { name: "Sazerac" });
    // The recipe the order remembered is the reason for the fallback.
    expect(await within(dialog).findByText(/rye, absinthe, sugar/)).toBeInTheDocument();
    // Nothing is claimed about stock for a drink that has left the menu.
    expect(within(dialog).queryByText("Out of stock")).toBeNull();
  });

  // There is no form to open for a drink that is no longer on the menu, and
  // the form would sit on "Loading..." for ever if offered.
  it("offers no way to edit a drink that has left the menu", async () => {
    orders = [anOrder({ id: 3, status: "accepted", drink_id: 99, drink_title: "Sazerac" })];
    serve();
    openBar("/bartender/queue");

    await userEvent.click(await screen.findByRole("button", { name: "Sazerac" }));
    const dialog = await screen.findByRole("dialog", { name: "Sazerac" });

    expect(within(dialog).queryByRole("button", { name: "Edit" })).toBeNull();
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

// The phone is the bartender's actual device, and the search there is a panel
// over the screen rather than a field in the rail.
describe("searching on a phone", () => {
  it("opens over the screen, finds a drink, and gets out of the way", async () => {
    menu = [aDrink({ id: 5, title: "Sazerac" })];
    serve();
    openBar("/bartender/queue");

    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Search drinks" }))[0]
    );

    const fields = await screen.findAllByRole("searchbox", {
      name: "Search drinks",
    });
    await userEvent.type(fields[fields.length - 1], "saz");
    await userEvent.click(await screen.findByRole("button", { name: "Sazerac" }));

    expect(
      await screen.findByRole("dialog", { name: "Sazerac" })
    ).toBeInTheDocument();
    // The panel closes behind it, rather than staying over the queue.
    await waitFor(() =>
      expect(
        screen.getAllByRole("searchbox", { name: "Search drinks" })
      ).toHaveLength(1)
    );
  });

  it("closes on Escape", async () => {
    openBar("/bartender/queue");

    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Search drinks" }))[0]
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole("searchbox", { name: "Search drinks" })
      ).toHaveLength(2)
    );

    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(
        screen.getAllByRole("searchbox", { name: "Search drinks" })
      ).toHaveLength(1)
    );
  });
});
