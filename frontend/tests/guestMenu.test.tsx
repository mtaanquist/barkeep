import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { useGuestMenu } from "../src/hooks/useGuestMenu";
import { aDrink, fakeApi, signIn, withApp, type FakeApi } from "./helpers";

const MENU = [
  aDrink({ id: 1, title: "Negroni", base_spirit: "Gin", category_name: "Classics" }),
  aDrink({ id: 2, title: "Aviation", base_spirit: "Gin", category_name: "Classics" }),
  aDrink({ id: 3, title: "Daiquiri", base_spirit: "Rum", category_name: "Sours" }),
  aDrink({ id: 4, title: "Old Fashioned", base_spirit: "Whisky/Whiskey" }),
  // Switched off by the bartender, so it should not appear anywhere.
  aDrink({ id: 5, title: "Mojito", base_spirit: "Rum", in_stock: 0, available: 0 }),
  // Still switched on, but the gin has run out — which the menu treats the
  // same way. Before ingredients existed this one would have been on it.
  aDrink({
    id: 6,
    title: "Martini",
    base_spirit: "Gin",
    in_stock: 1,
    available: 0,
    ingredient_names: ["gin", "dry vermouth"],
  }),
];

let api: FakeApi;

beforeEach(() => {
  signIn();
  api = fakeApi((path) => {
    if (path.includes("/favourites/")) return [aDrink({ id: 2, title: "Aviation" })];
    if (path.includes("/drinks/bar/")) return MENU;
    if (path.includes("/orders/bar/")) return [];
    return undefined;
  });
});

afterEach(() => vi.unstubAllGlobals());

const openMenu = async () => {
  const view = renderHook(() => useGuestMenu(), { wrapper: withApp });
  await waitFor(() => expect(view.result.current.available.length).toBe(4));
  return view;
};

describe("the guest's menu", () => {
  it("leaves out anything whose ingredient has run out", async () => {
    const { result } = await openMenu();

    expect(result.current.available.map((d) => d.title)).not.toContain(
      "Martini"
    );
    expect(result.current.bySpirit["Gin"]).toHaveLength(2);
  });

  it("leaves out anything that is not in stock", async () => {
    const { result } = await openMenu();

    expect(result.current.available.map((d) => d.title)).not.toContain(
      "Mojito"
    );
    expect(result.current.bySpirit["Rum"]).toHaveLength(1);
  });

  it("groups by spirit in the bar's order, not alphabetically", async () => {
    const { result } = await openMenu();

    expect(result.current.spirits).toEqual(["Gin", "Rum", "Whisky/Whiskey"]);
  });

  it("sorts the drinks inside each group by name", async () => {
    const { result } = await openMenu();

    expect(result.current.bySpirit["Gin"].map((d) => d.title)).toEqual([
      "Aviation",
      "Negroni",
    ]);
  });

  it("files a drink with no category under Uncategorized", async () => {
    const { result } = await openMenu();

    expect(result.current.categories).toEqual([
      "Classics",
      "Sours",
      "Uncategorized",
    ]);
    expect(result.current.byCategory["Uncategorized"]).toHaveLength(1);
  });

  it("shows the chosen group only, and every group when none is chosen", async () => {
    const { result } = await openMenu();

    expect(result.current.filtered).toEqual([]);

    act(() => result.current.setFilter({ type: "spirit", value: "Gin" }));
    expect(result.current.filtered.map((d) => d.title)).toEqual([
      "Aviation",
      "Negroni",
    ]);

    act(() => result.current.setFilter({ type: "category", value: "Sours" }));
    expect(result.current.filtered.map((d) => d.title)).toEqual(["Daiquiri"]);
  });

  it("puts the favourites in alphabetical order", async () => {
    api = fakeApi((path) => {
      if (path.includes("/favourites/"))
        return [aDrink({ id: 3, title: "Zombie" }), aDrink({ id: 2, title: "Aviation" })];
      if (path.includes("/drinks/bar/")) return MENU;
      if (path.includes("/orders/bar/")) return [];
      return undefined;
    });

    const { result } = renderHook(() => useGuestMenu(), { wrapper: withApp });

    await waitFor(() =>
      expect(result.current.favourites.map((d) => d.title)).toEqual([
        "Aviation",
        "Zombie",
      ])
    );
  });

  // apiCall used to be rebuilt on every render, so the effect that loads the
  // menu listed a dependency that never stopped changing.
  it("loads each thing once and then stops", async () => {
    const { rerender } = await openMenu();

    rerender();
    rerender();
    await new Promise((r) => setTimeout(r, 50));

    expect(api.countOf("/drinks/bar/1/guest/")).toBe(1);
    expect(api.countOf("/favourites/")).toBe(1);
    expect(api.countOf("/orders/bar/1")).toBe(1);
  });

  it("asks for the guest's own list, so favourites come back marked", async () => {
    await openMenu();

    expect(api.calls.map((c) => c.path)).toContain(
      "/api/drinks/bar/1/guest/Ada"
    );
  });

  it("escapes a name that would otherwise break the address", async () => {
    localStorage.clear();
    signIn({ name: "Ada & Bob" });

    renderHook(() => useGuestMenu(), { wrapper: withApp });

    await waitFor(() =>
      expect(api.calls.map((c) => c.path)).toContain(
        "/api/drinks/bar/1/guest/Ada%20%26%20Bob"
      )
    );
  });
});
