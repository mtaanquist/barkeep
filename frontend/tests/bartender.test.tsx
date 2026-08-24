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

  // The panel said it was a dialog but never took the keyboard, so Tab kept
  // walking the queue behind it.
  it("takes the keyboard when it opens and gives it back on close", async () => {
    openBar("/bartender/queue");

    const row = await screen.findByRole("button", { name: "Negroni" });
    await userEvent.click(row);

    const dialog = await screen.findByRole("dialog", { name: "Negroni" });
    await waitFor(() => expect(dialog).toHaveFocus());

    await userEvent.click(
      within(dialog).getAllByRole("button", { name: "Close" })[0]
    );

    await waitFor(() => expect(row).toHaveFocus());
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
    // Nothing is left hanging over the pending count in the rail below.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Sazerac" })).toBeNull()
    );
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

  // A keyboard without the Danish letters is what the bartender often has.
  it("finds a Danish name typed the way it sounds", async () => {
    menu = [aDrink({ id: 7, title: "Gløgg" }), aDrink({ id: 8, title: "Æblemost" })];
    serve();
    openBar("/bartender/queue");

    const field = await screen.findByRole("searchbox", { name: "Search drinks" });
    await userEvent.type(field, "gloegg");
    expect(await screen.findByRole("button", { name: "Gløgg" })).toBeInTheDocument();

    await userEvent.clear(field);
    await userEvent.type(field, "aeble");
    expect(await screen.findByRole("button", { name: "Æblemost" })).toBeInTheDocument();
  });

  it("says so when nothing matches", async () => {
    stock();
    openBar("/bartender/queue");

    await userEvent.type(
      await screen.findByRole("searchbox", { name: "Search drinks" }),
      "espresso martini"
    );

    // Once on screen, once for a screen reader to read out.
    expect((await screen.findAllByText("Nothing matches")).length).toBeGreaterThan(0);
  });

  // Typing a name and then reaching for the mouse to click the one match is
  // the whole reason this was slow on a laptop.
  it("opens the top match on Enter", async () => {
    stock();
    openBar("/bartender/queue");

    const field = await screen.findByRole("searchbox", {
      name: "Search drinks",
    });
    await userEvent.type(field, "saz{Enter}");

    expect(
      await screen.findByRole("dialog", { name: "Sazerac" })
    ).toBeInTheDocument();
  });

  it("does nothing on Enter when nothing matches", async () => {
    stock();
    openBar("/bartender/queue");

    await userEvent.type(
      await screen.findByRole("searchbox", { name: "Search drinks" }),
      "espresso martini{Enter}"
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // Nothing about the list of matches reaches a screen reader on its own.
  it("says out loud how many matches there are", async () => {
    stock();
    openBar("/bartender/queue");

    await userEvent.type(
      await screen.findByRole("searchbox", { name: "Search drinks" }),
      "e"
    );

    expect(await screen.findByText("3 results")).toBeInTheDocument();
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

  // The sheet used to leave the keyboard nowhere: closing it dropped focus to
  // the page, so the next Tab started from the top again.
  it("hands the keyboard back to the button that opened it", async () => {
    openBar("/bartender/queue");

    const openSearch = (
      await screen.findAllByRole("button", { name: "Search drinks" })
    )[0];
    await userEvent.click(openSearch);
    await waitFor(() =>
      expect(
        screen.getAllByRole("searchbox", { name: "Search drinks" })
      ).toHaveLength(2)
    );

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(openSearch).toHaveFocus());
  });

  it("is a dialog, so a screen reader knows the queue is behind it", async () => {
    openBar("/bartender/queue");

    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Search drinks" }))[0]
    );

    expect(
      await screen.findByRole("dialog", { name: "Search drinks" })
    ).toBeInTheDocument();
  });

  // The scrim is a big tap target, not a second Close for the keyboard.
  it("offers Close only once to the keyboard", async () => {
    openBar("/bartender/queue");

    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Search drinks" }))[0]
    );

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1)
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

// Two things the release changed that nothing was holding in place.
describe("a drink never outlives the screen it was opened from", () => {
  it("closes when the bartender leaves for another screen", async () => {
    menu = [aDrink({ id: 1, title: "Negroni" })];
    serve();
    openBar("/bartender/menu");

    await userEvent.click(await screen.findByRole("button", { name: "Negroni" }));
    await screen.findByRole("dialog", { name: "Negroni" });

    await userEvent.click(screen.getAllByRole("link", { name: "Settings" })[0]);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("is gone after signing out, rather than left on a shared tablet", async () => {
    menu = [aDrink({ id: 1, title: "Negroni" })];
    serve();
    openBar("/bartender/menu");

    await userEvent.click(await screen.findByRole("button", { name: "Negroni" }));
    await screen.findByRole("dialog", { name: "Negroni" });

    await userEvent.click(screen.getAllByRole("button", { name: "Logout" })[0]);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  // The order keeps its own copy of the recipe from when it was placed, which
  // can be out of date. The menu is the one to believe when both are there.
  // (The narrow window where the menu has not landed yet is reasoned about
  // rather than covered — the fake server here answers everything at once.)
  it("reads the recipe from the menu, not the copy the order kept", async () => {
    orders = [anOrder({ id: 1, status: "accepted", drink_id: 1, drink_title: "Negroni", drink_recipe: "OLD: three parts gin" })];
    menu = [aDrink({ id: 1, title: "Negroni", recipe: "NEW: one part gin" })];
    serve();
    openBar("/bartender/queue");

    await userEvent.click(await screen.findByRole("button", { name: "Negroni" }));
    const dialog = await screen.findByRole("dialog", { name: "Negroni" });

    expect(await within(dialog).findByText(/NEW: one part gin/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/OLD: three parts gin/)).toBeNull();
  });

  it("offers Edit for a drink that is still on the menu", async () => {
    orders = [anOrder({ id: 1, status: "accepted", drink_id: 1, drink_title: "Negroni" })];
    menu = [aDrink({ id: 1, title: "Negroni" })];
    serve();
    openBar("/bartender/queue");

    await userEvent.click(await screen.findByRole("button", { name: "Negroni" }));
    const dialog = await screen.findByRole("dialog", { name: "Negroni" });

    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});
