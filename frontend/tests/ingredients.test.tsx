import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import IngredientsTab from "../src/components/bartender/IngredientsTab";
import { DrinkForm } from "../src/components/DrinkForm";
import { translations, type TranslationKeys } from "../src/utils/translations";
import {
  aDrink,
  anIngredient,
  fakeApi,
  signIn,
  withApp,
  type FakeApi,
} from "./helpers";

const t = (key: TranslationKeys) => translations.en[key] as string;

/** An ingredient as the bartender's screen gets it, with how much rides on it. */
const stocked = (extra: Record<string, unknown> = {}) => ({
  ...anIngredient(),
  used_by: 0,
  ordered: 0,
  used_in: [] as { id: number; title: string }[],
  ...extra,
});

let api: FakeApi;

afterEach(() => vi.unstubAllGlobals());

const showTab = () =>
  render(
    <MemoryRouter>
      <IngredientsTab />
    </MemoryRouter>,
    { wrapper: withApp }
  );

describe("the ingredients screen", () => {
  beforeEach(() => signIn({ as: "bartender" }));

  it("lists what the bar pours, and how much rides on each", async () => {
    api = fakeApi((path) => {
      if (path.includes("/ingredients/bar/")) {
        return [
          stocked({ id: 1, name: "Campari", used_by: 3 }),
          stocked({ id: 2, name: "Gin", used_by: 1 }),
        ];
      }
      return undefined;
    });

    showTab();

    expect(await screen.findByText("Campari")).toBeInTheDocument();
    expect(
      screen.getAllByText(`3 ${t("usedInDrinks")}`)[0]
    ).toBeInTheDocument();
    expect(screen.getAllByText(t("usedInOneDrink"))[0]).toBeInTheDocument();
    void api;
  });

  // "1 drink" is no help to someone looking for that drink.
  it("names the drinks each one is in", async () => {
    api = fakeApi((path) =>
      path.includes("/ingredients/bar/")
        ? [
            stocked({
              id: 1,
              name: "campari",
              used_by: 1,
              used_in: [{ id: 42, title: "Boulevardier" }],
            }),
          ]
        : undefined
    );

    showTab();

    // Each one is the way to its card.
    expect(
      await screen.findByRole("link", { name: "Boulevardier" })
    ).toHaveAttribute("href", "/bartender/menu/42");
  });

  it("keeps a long list of drinks behind a button", async () => {
    const drinks = [
      "Americano",
      "Boulevardier",
      "Negroni",
      "Sbagliato",
      "Spritz",
      "Jungle Bird",
    ].map((title, id) => ({ id, title }));
    api = fakeApi((path) =>
      path.includes("/ingredients/bar/")
        ? [stocked({ id: 1, name: "Campari", used_by: 6, used_in: drinks })]
        : undefined
    );

    showTab();

    expect(await screen.findByText(/Sbagliato/)).toBeInTheDocument();
    expect(screen.queryByText(/Jungle Bird/)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: `${t("andMoreBefore")} 2 ${t("andMoreAfter")}`,
      })
    );

    expect(screen.getByText(/Jungle Bird/)).toBeInTheDocument();
  });

  it("adds one", async () => {
    api = fakeApi((path, options) => {
      if (path.includes("/ingredients/bar/")) return [];
      if (options.method === "POST") return stocked();
      return undefined;
    });

    showTab();

    await userEvent.type(
      await screen.findByLabelText(t("ingredientName")),
      "Campari"
    );
    await userEvent.click(
      screen.getByRole("button", { name: t("addIngredient") })
    );

    await waitFor(() =>
      expect(
        api.calls.some(
          (call) =>
            call.method === "POST" &&
            (call.body as { name?: string })?.name === "Campari"
        )
      ).toBe(true)
    );
  });

  // The one switch the whole feature is for.
  it("switches one off", async () => {
    api = fakeApi((path, options) => {
      if (options.method === "PATCH") return stocked({ in_stock: 0 });
      if (path.includes("/ingredients/bar/")) return [stocked({ id: 7 })];
      return undefined;
    });

    showTab();

    await userEvent.click(
      await screen.findByRole("switch", { name: t("inStock") })
    );

    await waitFor(() =>
      expect(
        api.calls.some((c) => c.path.includes("/ingredients/7/stock"))
      ).toBe(true)
    );
  });

  it("says when there is nothing there yet", async () => {
    api = fakeApi((path) =>
      path.includes("/ingredients/bar/") ? [] : undefined
    );

    showTab();

    expect(await screen.findByText(t("noIngredients"))).toBeInTheDocument();
  });
});

describe("the shopping list", () => {
  beforeEach(() => signIn({ as: "bartender" }));

  const showing = (list: ReturnType<typeof stocked>[]) => {
    api = fakeApi((path) =>
      path.includes("/ingredients/bar/") ? list : undefined
    );
    return showTab();
  };

  // Nothing to buy is nothing to say.
  it("stays away while the bar has everything", async () => {
    showing([stocked({ id: 1, name: "Campari", in_stock: 1, used_by: 3 })]);

    expect(await screen.findByText("Campari")).toBeInTheDocument();
    expect(screen.queryByText(t("shoppingList"))).not.toBeInTheDocument();
  });

  it("lists only what has run out", async () => {
    showing([
      stocked({ id: 1, name: "Campari", in_stock: 0 }),
      stocked({ id: 2, name: "Gin", in_stock: 1 }),
    ]);

    const list = (
      await screen.findByRole("heading", {
        name: t("shoppingList"),
      })
    ).closest("section") as HTMLElement;

    expect(within(list).getByText("Campari")).toBeInTheDocument();
    expect(within(list).queryByText("Gin")).not.toBeInTheDocument();
  });

  // A bottle in six drinks nobody orders can wait; one in a single drink
  // everybody asks for cannot.
  it("puts what the bar misses most at the top", async () => {
    showing([
      stocked({ id: 1, name: "Absinthe", in_stock: 0, used_by: 6, ordered: 0 }),
      stocked({ id: 2, name: "Gin", in_stock: 0, used_by: 1, ordered: 40 }),
      stocked({ id: 3, name: "Campari", in_stock: 0, used_by: 3, ordered: 12 }),
    ]);

    const list = (
      await screen.findByRole("heading", {
        name: t("shoppingList"),
      })
    ).closest("section") as HTMLElement;

    expect(
      within(list)
        .getAllByRole("listitem")
        .map((row) => row.textContent)
    ).toEqual([
      expect.stringMatching(/^Gin/),
      expect.stringMatching(/^Campari/),
      expect.stringMatching(/^Absinthe/),
    ]);
  });

  it("falls back to what is held up when nothing has been ordered", async () => {
    showing([
      stocked({ id: 1, name: "Absinthe", in_stock: 0, used_by: 1, ordered: 0 }),
      stocked({ id: 2, name: "Campari", in_stock: 0, used_by: 6, ordered: 0 }),
    ]);

    const list = (
      await screen.findByRole("heading", {
        name: t("shoppingList"),
      })
    ).closest("section") as HTMLElement;

    expect(
      within(list)
        .getAllByRole("listitem")
        .map((row) => row.textContent)
    ).toEqual([
      expect.stringMatching(/^Campari/),
      expect.stringMatching(/^Absinthe/),
    ]);
  });

  it("says how much rides on each, and never an amount", async () => {
    showing([
      stocked({ id: 1, name: "Campari", in_stock: 0, used_by: 6, ordered: 12 }),
    ]);

    const list = (
      await screen.findByRole("heading", {
        name: t("shoppingList"),
      })
    ).closest("section") as HTMLElement;

    expect(
      within(list).getByText(`6 ${t("usedInDrinks")} · 12 ${t("timesOrdered")}`)
    ).toBeInTheDocument();
  });

  it("says so plainly when nobody has ordered it yet", async () => {
    showing([stocked({ id: 1, name: "Campari", in_stock: 0, used_by: 1 })]);

    const list = (
      await screen.findByRole("heading", {
        name: t("shoppingList"),
      })
    ).closest("section") as HTMLElement;

    expect(
      within(list).getByText(`${t("usedInOneDrink")} · ${t("neverOrdered")}`)
    ).toBeInTheDocument();
  });
});

describe("saying what a drink is made of", () => {
  beforeEach(() => {
    signIn({ as: "bartender" });
    api = fakeApi((path, options) => {
      if (path.includes("/ingredients/bar/")) {
        return [
          stocked({ id: 1, name: "Campari" }),
          stocked({ id: 2, name: "Crème de Menthe" }),
        ];
      }
      if (path.includes("/categories/bar/")) return [];
      if (options.method === "PUT") return aDrink();
      return undefined;
    });
  });

  const editing = (drink = aDrink({ title: "Negroni" })) =>
    render(
      <MemoryRouter>
        <DrinkForm drink={drink} onDone={vi.fn()} />
      </MemoryRouter>,
      { wrapper: withApp }
    );

  it("starts with what the drink already has", async () => {
    editing(
      aDrink({
        ingredients: [
          { ingredient_id: 1, name: "Campari", amount: "3 cl", in_stock: 1 },
        ],
      })
    );

    expect(await screen.findByDisplayValue("Campari")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3 cl")).toBeInTheDocument();
  });

  it("adds a line and sends it with the drink", async () => {
    editing();

    await userEvent.click(
      await screen.findByRole("button", { name: t("addIngredient") })
    );

    await userEvent.type(screen.getByLabelText(t("amount")), "3 cl");
    await userEvent.type(screen.getByLabelText(t("ingredient")), "Campari");
    await userEvent.click(screen.getByRole("button", { name: t("saveDrink") }));

    await waitFor(() => {
      const saved = api.calls.find((call) => call.method === "PUT");
      expect((saved?.body as { ingredients?: unknown })?.ingredients).toEqual([
        { name: "Campari", amount: "3 cl" },
      ]);
    });
  });

  it("takes a line away again", async () => {
    editing(
      aDrink({
        ingredients: [
          { ingredient_id: 1, name: "Campari", amount: "3 cl", in_stock: 1 },
        ],
      })
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /Remove Campari/ })
    );

    expect(screen.queryByDisplayValue("Campari")).not.toBeInTheDocument();
  });

  // Accents and case are not how anyone types a name they half remember.
  it("suggests one the bar already has, spelled loosely", async () => {
    editing();

    await userEvent.click(
      await screen.findByRole("button", { name: t("addIngredient") })
    );
    await userEvent.type(screen.getByLabelText(t("ingredient")), "creme de");

    await userEvent.click(
      await screen.findByRole("option", { name: "Crème de Menthe" })
    );

    expect(screen.getByDisplayValue("Crème de Menthe")).toBeInTheDocument();
  });

  // Typing something new is how a new ingredient gets added, not a mistake.
  it("takes a name the bar has never poured", async () => {
    editing();

    await userEvent.click(
      await screen.findByRole("button", { name: t("addIngredient") })
    );
    await userEvent.type(
      screen.getByLabelText(t("ingredient")),
      "Hyldeblomstsirup"
    );
    await userEvent.click(screen.getByRole("button", { name: t("saveDrink") }));

    await waitFor(() => {
      const saved = api.calls.find((call) => call.method === "PUT");
      expect((saved?.body as { ingredients?: unknown })?.ingredients).toEqual([
        { name: "Hyldeblomstsirup", amount: "" },
      ]);
    });
  });
});
