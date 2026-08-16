import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../src/App";
import { aDrink, fakeApi, FakeEventSource, signIn, type FakeApi } from "./helpers";

let menu: ReturnType<typeof aDrink>[];
let api: FakeApi;

const serve = () => {
  api = fakeApi((path) => {
    if (path.includes("/analytics"))
      return {
        totalOrders: 0,
        ordersToday: 0,
        recentOrders: 0,
        popularDrinks: [],
        peakHours: [],
        statusDistribution: [],
        averageOrdersPerDay: 0,
        period: "30 days",
      };
    if (path.includes("/categories")) return [];
    if (path.includes("/drinks/bar/")) return menu;
    if (path.includes("/orders/bar/")) return [];
    // Saving replies with the drink as stored.
    if (path.includes("/drinks")) return { ...menu[0], title: "Boulevardier" };
    return undefined;
  });
};

const openAt = (at: string) => {
  window.history.pushState({}, "", at);
  return render(<App />);
};

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
  signIn({ as: "bartender" });
  menu = [
    aDrink({ id: 1, title: "Negroni", category_name: "Classics" }),
    aDrink({ id: 2, title: "Mojito", in_stock: 0, category_name: "Classics" }),
  ];
  serve();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.pushState({}, "", "/");
});

describe("the drink list", () => {
  it("puts stock and category on the row, so drinks compare down the column", async () => {
    openAt("/bartender/menu");

    const mojito = await screen.findByRole("button", { name: "Mojito" });
    const row = mojito.closest("li")!;

    expect(row).toHaveTextContent("Classics");
    expect(within(row).getByRole("switch")).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  // Out of stock is a state, not an error. The drink stays on the list,
  // stays editable, and is simply marked.
  it("keeps a drink that has run out on the list rather than hiding it", async () => {
    openAt("/bartender/menu");

    const row = (await screen.findByRole("button", { name: "Mojito" })).closest(
      "li"
    )!;

    expect(row).toHaveTextContent("Out of stock");
    expect(
      within(row).getByRole("button", { name: "Mojito" })
    ).toBeInTheDocument();
  });

  // There is no undo in Barkeep, so a stray tap must not land in an editor.
  it("opens a drink to read rather than to change", async () => {
    openAt("/bartender/menu");

    await userEvent.click(await screen.findByRole("button", { name: "Negroni" }));

    // The drink, to read — and still on the list, not on the form.
    expect(await screen.findByRole("dialog", { name: "Negroni" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(window.location.pathname).toBe("/bartender/menu");
  });

  it("has editing as its own button, one step further in", async () => {
    openAt("/bartender/menu");

    await userEvent.click(await screen.findByRole("button", { name: "Negroni" }));
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

    await waitFor(() =>
      expect(window.location.pathname).toBe("/bartender/menu/1")
    );
    expect(await screen.findByLabelText("Name")).toHaveValue("Negroni");
  });

  it("asks before a drink goes from the menu for good", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    openAt("/bartender/menu");

    const row = (await screen.findByRole("button", { name: "Negroni" })).closest(
      "li"
    )!;
    await userEvent.click(
      within(row).getByRole("button", { name: /Delete Negroni/ })
    );

    expect(confirm).toHaveBeenCalled();
    expect(api.calls.some((call) => call.method === "DELETE")).toBe(false);
  });
});

describe("adding and editing a drink", () => {
  it("is a screen with its own address, not a dialog over the list", async () => {
    openAt("/bartender/menu/new");

    await screen.findByRole("heading", { name: "New drink" });
    expect(window.location.pathname).toBe("/bartender/menu/new");
  });

  // The shell's one rule: an order arriving is the thing a bartender must
  // never miss, so the count stays put behind the form.
  it("leaves the queue count on screen behind it", async () => {
    openAt("/bartender/menu/new");

    await screen.findByRole("heading", { name: "New drink" });
    expect(
      (await screen.findAllByRole("button", { name: /Pending Orders/ })).length
    ).toBeGreaterThan(0);
  });

  it("folds away everything but the first part when there is no drink yet", async () => {
    openAt("/bartender/menu/new");

    await screen.findByRole("heading", { name: "New drink" });

    // The name is there to type; the recipe is one tap away.
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    const recipe = screen.getByRole("button", { name: /recipe/i });
    expect(recipe).toBeInTheDocument();

    await userEvent.click(recipe);
    expect(screen.queryByRole("button", { name: /^recipe/i })).toBeNull();
  });

  it("opens an existing drink filled in, with a labelled way back", async () => {
    openAt("/bartender/menu/1");

    expect(await screen.findByLabelText("Name")).toHaveValue("Negroni");

    await userEvent.click(screen.getByRole("button", { name: "Drinks" }));
    await waitFor(() =>
      expect(window.location.pathname).toBe("/bartender/menu")
    );
  });

  it("saves the changes and goes back to the list", async () => {
    openAt("/bartender/menu/1");

    const name = await screen.findByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Boulevardier");
    await userEvent.click(screen.getByRole("button", { name: "Save drink" }));

    await waitFor(() =>
      expect(window.location.pathname).toBe("/bartender/menu")
    );

    const saved = api.calls.find((call) => call.method === "PUT");
    expect(saved?.body).toMatchObject({ title: "Boulevardier" });
  });
});
