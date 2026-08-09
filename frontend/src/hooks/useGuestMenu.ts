import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../hooks/useApp";
import type { Drink } from "../types";
import { BASE_SPIRITS } from "../utils/spirits";

export type MenuFilter =
  | { type: "all" }
  | { type: "category"; value: string }
  | { type: "spirit"; value: string };

const byTitle = (a: Drink, b: Drink): number => a.title.localeCompare(b.title);

/** Sorts drinks into named piles, each pile in alphabetical order. */
function groupBy(drinks: Drink[], nameOf: (drink: Drink) => string) {
  const groups: Record<string, Drink[]> = {};

  for (const drink of drinks) {
    const name = nameOf(drink);
    (groups[name] ??= []).push(drink);
  }

  for (const pile of Object.values(groups)) pile.sort(byTitle);

  return groups;
}

/**
 * Everything the guest's menu needs: what is on it, how it is grouped, and
 * which part of it they are looking at.
 */
export function useGuestMenu() {
  const { currentBar, customerName, drinks, setDrinks, setOrders, apiCall } =
    useApp();

  const [favourites, setFavourites] = useState<Drink[]>([]);
  const [filter, setFilter] = useState<MenuFilter>({ type: "all" });

  const barId = currentBar?.id;
  const guest = customerName ? encodeURIComponent(customerName) : "";

  const refreshDrinks = useCallback(async () => {
    if (!barId || !guest) return;
    try {
      // The guest's own list, so their favourites come back marked.
      setDrinks(await apiCall(`/drinks/bar/${barId}/guest/${guest}`));
    } catch (err) {
      console.error("Could not load the drinks:", err);
    }
  }, [barId, guest, apiCall, setDrinks]);

  const refreshFavourites = useCallback(async () => {
    if (!barId || !guest) return;
    try {
      const data: Drink[] = await apiCall(
        `/drinks/bar/${barId}/favourites/${guest}`
      );
      setFavourites([...data].sort(byTitle));
    } catch (err) {
      console.error("Could not load the favourites:", err);
    }
  }, [barId, guest, apiCall]);

  const refreshOrders = useCallback(async () => {
    if (!barId) return;
    try {
      setOrders(await apiCall(`/orders/bar/${barId}`));
    } catch (err) {
      console.error("Could not load the orders:", err);
    }
  }, [barId, apiCall, setOrders]);

  useEffect(() => {
    refreshDrinks();
    refreshFavourites();
    refreshOrders();
  }, [refreshDrinks, refreshFavourites, refreshOrders]);

  const inStock = useMemo(() => drinks.filter((d) => d.in_stock), [drinks]);

  const bySpirit = useMemo(
    () => groupBy(inStock, (d) => d.base_spirit || "Other"),
    [inStock]
  );

  const byCategory = useMemo(
    () => groupBy(inStock, (d) => d.category_name || "Uncategorized"),
    [inStock]
  );

  const spirits = BASE_SPIRITS.filter((s) => bySpirit[s]?.length);
  const categories = Object.keys(byCategory).sort();

  // "All" shows every group in turn rather than one flat list.
  const filtered =
    filter.type === "category"
      ? (byCategory[filter.value] ?? [])
      : filter.type === "spirit"
        ? (bySpirit[filter.value] ?? [])
        : [];

  return {
    inStock,
    favourites,
    bySpirit,
    byCategory,
    spirits,
    categories,
    filter,
    setFilter,
    filtered,
    refreshDrinks,
    refreshFavourites,
    refreshOrders,
  };
}
