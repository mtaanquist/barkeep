import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

/** An ingredient as the bartender's screen gets it, with its use count. */
const stocked = (extra: Record<string, unknown> = {}) => ({
  ...anIngredient(),
  used_by: 0,
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
    expect(screen.getAllByText(`3 ${t("usedInDrinks")}`)[0]).toBeInTheDocument();
    expect(screen.getAllByText(t("usedInOneDrink"))[0]).toBeInTheDocument();
    void api;
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
      expect(api.calls.some((c) => c.path.includes("/ingredients/7/stock"))).toBe(
        true
      )
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
