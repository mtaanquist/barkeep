import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DrinkCard from "../src/components/DrinkCard";
import DrinkGrid from "../src/components/customer/DrinkGrid";
import { statusCard, statusCardWithText, statusIcon } from "../src/utils/orderStatus";
import { translations, type TranslationKeys } from "../src/utils/translations";
import type { OrderStatus } from "../src/types";
import { aDrink } from "./helpers";

const t = (key: TranslationKeys) => translations.en[key] as string;

const cardActions = {
  onViewRecipe: vi.fn(),
  onOrder: vi.fn(),
  onToggleFavourite: vi.fn(),
  disabled: false,
  loading: false,
  t,
};

describe("a drink on the menu", () => {
  // in_stock arrives as 0 or 1, and used to be typed as a boolean.
  it("offers a drink that is in stock", async () => {
    const onOrder = vi.fn();
    render(
      <DrinkCard {...cardActions} onOrder={onOrder} drink={aDrink({ in_stock: 1 })} />
    );

    await userEvent.click(screen.getByRole("button", { name: /order/i }));

    expect(onOrder).toHaveBeenCalledOnce();
  });

  it("marks a favourite as one, and an ordinary drink as not", () => {
    const { rerender } = render(
      <DrinkCard {...cardActions} drink={aDrink({ is_favourite: 1 })} />
    );
    expect(
      screen.getByTitle("Remove from favourites")
    ).toBeInTheDocument();

    rerender(<DrinkCard {...cardActions} drink={aDrink({ is_favourite: 0 })} />);
    expect(screen.getByTitle("Add to favourites")).toBeInTheDocument();
  });

  it("shows a drink with no picture without breaking", () => {
    render(<DrinkCard {...cardActions} drink={aDrink({ image_url: null })} />);

    expect(screen.getByText("Negroni")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("a section of the menu", () => {
  const drinks = [
    aDrink({ id: 1, title: "Negroni" }),
    aDrink({ id: 2, title: "Aviation" }),
  ];

  it("lists every drink under its heading", () => {
    render(
      <DrinkGrid
        {...cardActions}
        drinks={drinks}
        heading="Gin"
        headingClass="text-blue-800"
      />
    );

    expect(screen.getByRole("heading", { name: "Gin" })).toBeInTheDocument();
    expect(screen.getByText("Negroni")).toBeInTheDocument();
    expect(screen.getByText("Aviation")).toBeInTheDocument();
  });

  it("can be linked to from the menu on the left", () => {
    const { container } = render(
      <DrinkGrid
        {...cardActions}
        drinks={drinks}
        id="favourites"
        heading="Favourites"
        headingClass="text-yellow-700"
      />
    );

    expect(container.querySelector("section")).toHaveAttribute(
      "id",
      "favourites"
    );
  });
});

describe("how an order looks at each step", () => {
  const every: OrderStatus[] = [
    "new",
    "accepted",
    "rejected",
    "ready",
    "processed",
  ];

  it("has an icon and colours for every step, with nothing left over", () => {
    for (const status of every) {
      expect(statusIcon(status)).toBeTruthy();
      expect(statusCard(status)).toMatch(/^bg-\S+ border-\S+$/);
      expect(statusCardWithText(status)).toContain(statusCard(status));
      expect(statusCardWithText(status)).toMatch(/text-\S+$/);
    }
  });

  it("gives each step its own colour", () => {
    const colours = new Set(every.map(statusCard));

    expect(colours.size).toBe(every.length);
  });
});
