import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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

describe("ordering a drink", () => {
  it("sends the order and says so", async () => {
    menu = [aDrink({ id: 1, title: "Negroni", base_spirit: "Gin" })];
    await showMenu();

    await userEvent.click(
      screen.getAllByRole("button", { name: "Order" })[0]
    );

    await waitFor(() =>
      expect(api.calls.some((c) => c.method === "POST")).toBe(true)
    );

    const posted = api.calls.find((c) => c.method === "POST");
    expect(posted?.body).toMatchObject({
      barId: 1,
      customerName: "Ada",
      drinkId: 1,
      drinkTitle: "Negroni",
    });
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

describe("looking at a recipe", () => {
  // A drink with no recipe used to throw, because the recipe was typed as
  // always being there.
  it("opens a drink that has no recipe written down", () => {
    render(<RecipeView drink={aDrink({ recipe: null })} onClose={vi.fn()} />, {
      wrapper: withApp,
    });

    expect(screen.getByText("Negroni")).toBeInTheDocument();
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
});

describe("the surprise me reveal", () => {
  const roll = async () => {
    await showMenu();
    await userEvent.click(screen.getByRole("button", { name: /Surprise me/ }));
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
