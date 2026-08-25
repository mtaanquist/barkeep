import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import App from "../src/App";
import CustomerInterface from "../src/components/CustomerInterface";
import RecipeView from "../src/components/RecipeView";
import { AppProvider } from "../src/context/AppContext";
import { LiveUpdatesProvider } from "../src/context/LiveUpdatesContext";
import {
  aBar,
  aDrink,
  anOrder,
  fakeApi,
  FakeEventSource,
  signIn,
  withApp,
  type FakeApi,
} from "./helpers";

let api: FakeApi;
let orders: ReturnType<typeof anOrder>[];

let menu: ReturnType<typeof aDrink>[];

const serve = () => {
  api = fakeApi((path, options) => {
    if (path.includes("/favourites/")) return [];
    if (path.includes("/drinks/bar/")) return menu;
    if (path.includes("/orders/bar/")) return orders;
    if (path === "/api/orders" && options.method === "POST") {
      orders = [anOrder({ id: 99, drink_title: "Negroni" })];
      return orders[0];
    }
    if (path.startsWith("/api/orders/") && options.method === "DELETE") {
      orders = [];
      return { success: true };
    }
    if (path.endsWith("/api/auth/guest/password") && options.method === "PUT") {
      return { success: true };
    }
    return undefined;
  });
};

const showMenu = async () => {
  render(
    <MemoryRouter>
      <AppProvider>
        <LiveUpdatesProvider>
          <CustomerInterface />
        </LiveUpdatesProvider>
      </AppProvider>
    </MemoryRouter>
  );
  // Waits on a drink rather than on the Order button, because the button is
  // relabelled once the guest has an order on the go.
  await screen.findAllByRole("heading", { name: "Negroni" });
};

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
  signIn();
  orders = [];
  menu = [
    aDrink({ id: 1, title: "Negroni", base_spirit: "Gin" }),
    aDrink({ id: 2, title: "Daiquiri", base_spirit: "Rum" }),
  ];
  serve();
});

afterEach(() => vi.unstubAllGlobals());

/** Tapping Order and then saying yes to the drink it asks about. */
const orderFirstDrink = async () => {
  await userEvent.click(screen.getAllByRole("button", { name: "Order" })[0]);
  await userEvent.click(
    screen.getByRole("button", { name: "Yes, order it" })
  );
};

describe("ordering a drink", () => {
  it("sends the order and says so", async () => {
    menu = [aDrink({ id: 1, title: "Negroni", base_spirit: "Gin" })];
    await showMenu();

    await orderFirstDrink();

    await waitFor(() =>
      expect(api.calls.some((c) => c.method === "POST")).toBe(true)
    );

    const posted = api.calls.find((c) => c.method === "POST");
    // Only the drink id goes up; the server fills in the title from the drink,
    // so a guest can't put words on the queue.
    expect(posted?.body).toMatchObject({
      barId: 1,
      customerName: "Ada",
      drinkId: 1,
    });
    expect(posted?.body).not.toHaveProperty("drinkTitle");
    expect(await screen.findByText(/order placed/i)).toBeInTheDocument();
  });

  // One drink at a time, or the bartender ends up with a queue per guest.
  it("will not take a second order while one is still on the go", async () => {
    orders = [anOrder({ id: 5, status: "accepted" })];

    await showMenu();
    await screen.findByRole("region", { name: "Your Order" });

    // The button says why it cannot be used, rather than going quietly grey
    // and telling the guest only once they have tapped it.
    const blocked = screen.getAllByRole("button", {
      name: "You can only have one active order at a time",
    });
    expect(blocked.length).toBeGreaterThan(0);
    for (const button of blocked) {
      expect(button).toBeDisabled();
    }
    expect(screen.queryByRole("button", { name: "Order" })).toBeNull();

    await userEvent.click(blocked[0]);
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("shows how the order is getting on", async () => {
    orders = [anOrder({ id: 5, status: "ready", drink_title: "Negroni" })];

    await showMenu();

    // Found the way a screen reader would, so restyling the card cannot
    // break this and losing the label can.
    const card = await screen.findByRole("region", { name: "Your Order" });
    expect(card).toHaveTextContent("Negroni");
    expect(card).toHaveTextContent("Ready");
  });

  it("asks before cancelling, and does nothing if you say no", async () => {
    orders = [anOrder({ id: 5, status: "new" })];
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));

    await showMenu();
    // Cancelling lives inside the dock, which opens when tapped.
    await userEvent.click(screen.getByRole("button", { name: /Negroni/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel Order" }));

    expect(api.calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("cancels when you say yes", async () => {
    orders = [anOrder({ id: 5, status: "new" })];
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

    await showMenu();
    await userEvent.click(screen.getByRole("button", { name: /Negroni/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel Order" }));

    await waitFor(() =>
      expect(api.calls.some((c) => c.method === "DELETE")).toBe(true)
    );
    const sent = api.calls.find((c) => c.method === "DELETE");
    expect(sent?.body).toMatchObject({ barId: 1, customerName: "Ada" });
  });

  // Once it is poured and waiting on the bar there is nothing left to call
  // off, so the button goes rather than sitting there doing harm.
  it("takes cancelling away once the drink is ready", async () => {
    orders = [anOrder({ id: 5, status: "ready", drink_title: "Negroni" })];

    await showMenu();
    const dock = await screen.findByRole("region", { name: "Your Order" });

    expect(dock).toHaveTextContent("Ready");
    expect(
      within(dock).queryByRole("button", { name: "Cancel Order" })
    ).toBeNull();
  });

  it("still allows cancelling before it is poured", async () => {
    orders = [anOrder({ id: 5, status: "accepted", drink_title: "Negroni" })];

    await showMenu();
    await userEvent.click(screen.getByRole("button", { name: /Negroni/ }));

    expect(
      screen.getByRole("button", { name: "Cancel Order" })
    ).toBeInTheDocument();
  });

  // Last orders. The drinks stay on screen so a guest can see what they
  // missed, but nothing can be ordered.
  it("says so, and takes the buttons away, once the bar has closed", async () => {
    signIn({ bar: aBar({ orders_closed: 1 }) });

    await showMenu();

    expect(screen.getByText("The bar has stopped taking orders")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Order" })).toBeNull();
    // One for the phone, one for the wide screen; both are off.
    for (const button of screen.getAllByRole("button", {
      name: /Surprise me/,
    })) {
      expect(button).toBeDisabled();
    }
  });

  // A guest holding the menu open at one minute to should see it close,
  // rather than finding out by tapping Order.
  it("closes itself when the set time comes round", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const closesAt = new Date(Date.now() + 60_000).toISOString();
    signIn({ bar: aBar({ last_orders_at: closesAt }) });

    await showMenu();
    expect(screen.getAllByRole("button", { name: "Order" }).length)
      .toBeGreaterThan(0);

    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });

    expect(
      screen.getByText("The bar has stopped taking orders")
    ).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("says so plainly when there is nothing on", async () => {
    menu = [];

    render(
      <MemoryRouter>
        <AppProvider>
          <LiveUpdatesProvider>
            <CustomerInterface />
          </LiveUpdatesProvider>
        </AppProvider>
      </MemoryRouter>
    );

    expect(
      await screen.findByText("No drinks available right now")
    ).toBeInTheDocument();
  });
});

describe("filtering on a phone", () => {
  // The rail belongs to the header's own sticky block. Put it at the top of
  // the scrolling content instead and it sits below a band of white.
  it("rides with the header rather than the page", async () => {
    await showMenu();

    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("button", { name: "Filter" })
    ).toBeInTheDocument();
    expect(
      within(header).getByRole("button", { name: /All drinks/ })
    ).toBeInTheDocument();
  });

  it("carries a count on every chip, so nothing needs opening", async () => {
    await showMenu();

    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("button", { name: "All drinks 2" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(header).getByRole("button", { name: "Gin 1" })
    ).toBeInTheDocument();
  });

  it("opens the whole list when the rail is not enough", async () => {
    await showMenu();

    await userEvent.click(screen.getByRole("button", { name: "Filter" }));

    const sheet = screen.getByRole("dialog", { name: "Filter drinks" });
    await userEvent.click(within(sheet).getByRole("button", { name: /Rum/ }));

    // Choosing closes it, and the menu is still where it was.
    expect(screen.queryByRole("dialog", { name: "Filter drinks" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Daiquiri", level: 3 })
    ).toBeInTheDocument();
  });
});

describe("surprise me on a phone", () => {
  // It used to be in the side menu only, which a phone never shows, so there
  // was no way to be surprised on one at all.
  it("is offered, and rides with the header so scrolling cannot lose it", async () => {
    await showMenu();

    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("button", { name: /Surprise me/ })
    ).toBeInTheDocument();
  });

  it("picks a drink, the same as the side menu does", async () => {
    await showMenu();

    const header = screen.getByRole("banner");
    await userEvent.click(
      within(header).getByRole("button", { name: /Surprise me/ })
    );

    expect(
      screen.getByRole("dialog", { name: "Surprise me" })
    ).toHaveTextContent(/the bar chose for you/i);
  });
});

// A tap is easy to make by accident on a phone, and an unmeant order both
// lands on the bartender's queue and blocks the guest's real one.
describe("asking before an order goes in", () => {
  it("sends nothing until the guest says yes", async () => {
    menu = [aDrink({ id: 1, title: "Negroni", base_spirit: "Gin" })];
    await showMenu();

    await userEvent.click(screen.getAllByRole("button", { name: "Order" })[0]);

    const ask = screen.getByRole("dialog", { name: "Order this drink?" });
    expect(ask).toHaveTextContent("Negroni");
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);

    await userEvent.click(
      within(ask).getByRole("button", { name: "Yes, order it" })
    );

    await waitFor(() =>
      expect(api.calls.some((c) => c.method === "POST")).toBe(true)
    );
  });

  it("sends nothing when the guest backs out", async () => {
    await showMenu();

    await userEvent.click(screen.getAllByRole("button", { name: "Order" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog", { name: "Order this drink?" })).toBeNull();
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);
  });

  // Tapping beside it is the way out a phone leads you to expect, and it has
  // to be the harmless one of the two answers.
  it("takes a tap beside it as backing out, not as saying yes", async () => {
    await showMenu();

    await userEvent.click(screen.getAllByRole("button", { name: "Order" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog", { name: "Order this drink?" })).toBeNull();
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("asks about the drink that was tapped", async () => {
    await showMenu();

    const daiquiri = screen
      .getAllByRole("article")
      .find((card) =>
        within(card).queryByRole("heading", { name: "Daiquiri", level: 3 })
      )!;
    await userEvent.click(within(daiquiri).getByRole("button", { name: "Order" }));

    const ask = screen.getByRole("dialog", { name: "Order this drink?" });
    expect(ask).toHaveTextContent("Daiquiri");
    expect(ask).not.toHaveTextContent("Negroni");

    await userEvent.click(
      within(ask).getByRole("button", { name: "Yes, order it" })
    );

    await waitFor(() =>
      expect(api.calls.some((c) => c.method === "POST")).toBe(true)
    );
    expect(api.calls.find((c) => c.method === "POST")?.body).toMatchObject({
      drinkId: 2,
    });
  });

  // The reveal already names the drink and asks, so a second dialog on top of
  // it would only be in the way.
  it("does not ask twice when the bar chose the drink", async () => {
    await showMenu();
    await userEvent.click(
      screen.getAllByRole("button", { name: /Surprise me/ })[0]
    );

    const reveal = screen.getByRole("dialog", { name: "Surprise me" });
    await userEvent.click(within(reveal).getByRole("button", { name: /^Order / }));

    await waitFor(() =>
      expect(api.calls.some((c) => c.method === "POST")).toBe(true)
    );
    expect(screen.queryByRole("dialog", { name: "Order this drink?" })).toBeNull();
  });
});

describe("looking at a recipe", () => {
  // A drink with no recipe used to throw, because the recipe was typed as
  // always being there.
  it("opens a drink that has no recipe written down", () => {
    render(<RecipeView drink={aDrink({ recipe: null })} onClose={vi.fn()} />, {
      wrapper: withApp,
    });

    expect(screen.getByText("Negroni")).toBeInTheDocument();
  });

  // The same view serves the bartender, where it does have a way in to the
  // form. A guest must never be handed one.
  it("offers no way to edit unless the caller gives one", () => {
    render(<RecipeView drink={aDrink()} onClose={vi.fn()} />, {
      wrapper: withApp,
    });

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("closes when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(<RecipeView drink={aDrink()} onClose={onClose} />, {
      wrapper: withApp,
    });

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  // Everything a guest reads here used to be written into the file in
  // English, whatever language the bar was set to.
  it("reads in the bar's language", () => {
    signIn({ bar: aBar({ language: "da" }) });

    render(
      <RecipeView
        drink={aDrink({ base_spirit: "Gin", in_stock: 0 })}
        onClose={vi.fn()}
      />,
      { wrapper: withApp }
    );

    const recipe = screen.getByRole("dialog", { name: "Negroni" });
    expect(recipe).toHaveTextContent("Basisspiritus");
    expect(recipe).toHaveTextContent("Udsolgt");
    expect(recipe).not.toHaveTextContent(/Base Spirit|Out of stock/);
  });

  // The recipe used to be returned in place of the whole app, so a guest
  // reading one could not be told their drink was ready.
  it("opens over the menu, leaving the order in progress on screen", async () => {
    orders = [anOrder({ id: 5, status: "ready", drink_title: "Daiquiri" })];
    window.history.pushState({}, "", "/customer");

    render(<App />);

    const dock = await screen.findByRole("region", { name: "Your Order" });
    expect(dock).toHaveTextContent("Daiquiri");

    await userEvent.click(
      (await screen.findAllByRole("button", { name: "View Recipe" }))[0]
    );

    // The recipe is open, and the dock survived it.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Your Order" })
    ).toHaveTextContent("Daiquiri");

    window.history.pushState({}, "", "/");
  });
});

describe("past orders, as a panel over the menu", () => {
  // A panel, not a peer screen: the menu stays behind it and the dock keeps
  // carrying the drink that is on its way.
  const openDirectly = () =>
    render(
      <MemoryRouter initialEntries={["/customer/past-orders"]}>
        <AppProvider>
          <LiveUpdatesProvider>
            <CustomerInterface />
          </LiveUpdatesProvider>
        </AppProvider>
      </MemoryRouter>
    );

  // The history used to read whatever the menu had already loaded, so
  // arriving straight at it, or refreshing, showed nothing.
  it("loads the orders itself rather than relying on the menu", async () => {
    orders = [
      anOrder({ id: 5, status: "processed", drink_id: 1, drink_title: "Negroni" }),
      anOrder({
        id: 6,
        status: "processed",
        drink_id: 2,
        drink_title: "Daiquiri",
      }),
    ];

    openDirectly();

    const history = await screen.findByRole("dialog", { name: "Past orders" });
    expect(within(history).getByText("Negroni")).toBeInTheDocument();
    expect(within(history).getByText("Daiquiri")).toBeInTheDocument();
  });

  it("shows only this guest's finished orders", async () => {
    orders = [
      anOrder({ id: 5, status: "processed", drink_title: "Negroni" }),
      anOrder({ id: 6, status: "new", drink_title: "Still Coming" }),
      anOrder({ id: 7, status: "processed", customer_name: "Bob", drink_title: "Someone Elses" }),
    ];

    openDirectly();

    const history = await screen.findByRole("dialog", { name: "Past orders" });
    expect(within(history).getByText("Negroni")).toBeInTheDocument();
    expect(within(history).queryByText("Still Coming")).toBeNull();
    expect(within(history).queryByText("Someone Elses")).toBeNull();

    // The one still on the go is not history — it is in the dock, which
    // the panel deliberately stops short of.
    const dock = screen.getByRole("region", { name: "Your Order" });
    expect(within(dock).getByText("Still Coming")).toBeInTheDocument();
  });

  it("leaves the menu underneath rather than replacing it", async () => {
    orders = [anOrder({ id: 5, status: "processed", drink_title: "Negroni" })];

    openDirectly();

    await screen.findByRole("dialog", { name: "Past orders" });
    // The menu's own drink headings are still on the page behind the panel.
    expect(
      screen.getAllByRole("heading", { name: "Negroni", level: 3 }).length
    ).toBeGreaterThan(0);
  });

  it("cannot order again while a drink is already on the way", async () => {
    orders = [
      anOrder({ id: 5, status: "processed", drink_id: 1, drink_title: "Negroni" }),
      anOrder({ id: 6, status: "new", drink_id: 2, drink_title: "Daiquiri" }),
    ];

    openDirectly();

    const history = await screen.findByRole("dialog", { name: "Past orders" });
    expect(within(history).getByRole("button", { name: "Again" })).toBeDisabled();
    // The reason sits beside the button rather than behind an alert.
    expect(history).toHaveTextContent(/once your current drink has been/i);
  });

  // Ordering again is one tap in a list of small rows, so it asks first too.
  it("asks before ordering again, and closes the history once it has", async () => {
    orders = [
      anOrder({ id: 5, status: "processed", drink_id: 1, drink_title: "Negroni" }),
    ];

    openDirectly();

    const history = await screen.findByRole("dialog", { name: "Past orders" });
    await userEvent.click(within(history).getByRole("button", { name: "Again" }));

    const ask = screen.getByRole("dialog", { name: "Order this drink?" });
    expect(ask).toHaveTextContent("Negroni");
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);

    await userEvent.click(
      within(ask).getByRole("button", { name: "Yes, order it" })
    );

    await waitFor(() =>
      expect(api.calls.some((c) => c.method === "POST")).toBe(true)
    );
    // What matters next is the drink coming, which the dock is carrying.
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Past orders" })).toBeNull()
    );
  });

  // Escape used to reach both, so backing out of the asking also lost the
  // guest's place in their history.
  it("answers the asking with Escape, and leaves the history open", async () => {
    orders = [
      anOrder({ id: 5, status: "processed", drink_id: 1, drink_title: "Negroni" }),
    ];

    openDirectly();

    const history = await screen.findByRole("dialog", { name: "Past orders" });
    await userEvent.click(within(history).getByRole("button", { name: "Again" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Order this drink?" })).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Past orders" })
    ).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);
  });

  // Changing a password is two fields and a keyboard, which is a dialog's
  // worth of room rather than a form squeezed into the foot of the panel.
  describe("changing the password on a name", () => {
    const asARegular = async () => {
      localStorage.setItem("homeBarSystem_authenticated", JSON.stringify(true));
      openDirectly();
      await screen.findByRole("dialog", { name: "Past orders" });
      await userEvent.click(
        screen.getByRole("button", { name: "Change password" })
      );
      return screen.getByRole("dialog", { name: "Change password" });
    };

    const fillIn = async (
      dialog: HTMLElement,
      { next, again }: { next: string; again: string }
    ) => {
      await userEvent.type(
        within(dialog).getByPlaceholderText("Current password"),
        "old-one"
      );
      await userEvent.type(
        within(dialog).getByPlaceholderText("New password"),
        next
      );
      await userEvent.type(
        within(dialog).getByPlaceholderText("Type the new one again"),
        again
      );
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Change password" })
      );
    };

    it("takes the new password, and says it went through", async () => {
      const dialog = await asARegular();

      await fillIn(dialog, { next: "new-one", again: "new-one" });

      await waitFor(() =>
        expect(api.calls.some((c) => c.method === "PUT")).toBe(true)
      );
      expect(api.calls.find((c) => c.method === "PUT")?.body).toMatchObject({
        currentPassword: "old-one",
        newPassword: "new-one",
      });
      expect(await screen.findByText("Password changed.")).toBeInTheDocument();
    });

    // Typed behind dots twice over, so the slip is caught here rather than
    // the next time the guest tries to use their name.
    it("says so when the two are not typed the same, and sends nothing", async () => {
      const dialog = await asARegular();

      await fillIn(dialog, { next: "new-one", again: "nwe-one" });

      expect(
        await within(dialog).findByText(/not the same/i)
      ).toBeInTheDocument();
      expect(api.calls.some((c) => c.method === "PUT")).toBe(false);

      // Putting it right sends it, without having to start over.
      await userEvent.clear(
        within(dialog).getByPlaceholderText("Type the new one again")
      );
      await userEvent.type(
        within(dialog).getByPlaceholderText("Type the new one again"),
        "new-one"
      );
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Change password" })
      );

      await waitFor(() =>
        expect(api.calls.some((c) => c.method === "PUT")).toBe(true)
      );
    });

    // Escape used to reach the panel underneath as well, which would have
    // dropped the guest back on the menu.
    it("closes on Escape, and leaves the history open", async () => {
      await asARegular();

      await userEvent.keyboard("{Escape}");

      expect(
        screen.queryByRole("dialog", { name: "Change password" })
      ).toBeNull();
      expect(
        screen.getByRole("dialog", { name: "Past orders" })
      ).toBeInTheDocument();
    });

    // Nobody without an account has a password to change.
    it("is not offered to a one-time guest", async () => {
      openDirectly();

      await screen.findByRole("dialog", { name: "Past orders" });
      expect(
        screen.queryByRole("button", { name: "Change password" })
      ).toBeNull();
    });
  });
});

describe("the surprise me reveal", () => {
  const roll = async () => {
    await showMenu();
    await userEvent.click(
      screen.getAllByRole("button", { name: /Surprise me/ })[0]
    );
    return screen.getByRole("dialog", { name: "Surprise me" });
  };

  it("says who chose, and puts ordering below the second go", async () => {
    const reveal = await roll();

    expect(reveal).toHaveTextContent(/the bar chose for you/i);

    // Turning the suggestion down is expected, not a corner case, so it is
    // a button of its own between ordering and backing out.
    const labels = within(reveal)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim());

    expect(labels).toHaveLength(3);
    expect(labels[0]).toMatch(/^Order /);
    expect(labels[1]).toMatch(/Try another/);
    expect(labels[2]).toMatch(/Cancel/);
  });

  // The panel and its buttons stay put across a re-roll, so the third go is
  // as quick to tap as the first.
  it("swaps the drink without changing anything around it", async () => {
    const reveal = await roll();
    const first = within(reveal).getByRole("heading").textContent;

    await userEvent.click(
      within(reveal).getByRole("button", { name: /Try another/ })
    );

    const again = screen.getByRole("dialog", { name: "Surprise me" });
    expect(within(again).getByRole("heading").textContent).not.toBe(first);

    const labels = within(again)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim());

    expect(labels).toHaveLength(3);
    expect(labels[1]).toMatch(/Try another/);
    expect(labels[2]).toMatch(/Cancel/);
  });
});

// The menu is over a hundred drinks in a real bar, and every photo on it used
// to be fetched before the guest saw anything.
describe("a menu full of photos", () => {
  it("waits to fetch a photo until it is scrolled to", async () => {
    menu = [
      aDrink({ id: 1, title: "Negroni", image_url: "/uploads/negroni.jpg" }),
    ];
    serve();
    await showMenu();

    // The same drink can sit in more than one section of the menu.
    for (const photo of screen.getAllByAltText("Negroni")) {
      expect(photo).toHaveAttribute("loading", "lazy");
    }
  });
});

// The component takes an edit action only when it is given one; this is the
// gate that decides whether a guest is ever given one at all.
describe("what a guest is allowed to do with a recipe", () => {
  it("is never offered a way into the form", async () => {
    menu = [
      aDrink({ id: 1, title: "Negroni", recipe: "gin", show_recipe_to_guests: 1 }),
    ];
    serve();
    window.history.pushState({}, "", "/customer");
    render(<App />);

    await userEvent.click(
      (await screen.findAllByRole("button", { name: "View Recipe" }))[0]
    );

    const dialog = await screen.findByRole("dialog", { name: "Negroni" });
    expect(within(dialog).queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
