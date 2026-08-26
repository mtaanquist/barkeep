import React from "react";
import type { IngredientWithUse } from "../../types";
import type { translations } from "../../utils/translations";

type T = (key: keyof typeof translations.en) => string;

/**
 * What has run out, worst first. Worst is not "in the most drinks" — a bottle
 * in six drinks nobody orders can wait, and one in a single drink everybody
 * asks for cannot. So this ranks by what the bar has actually been asked to
 * make, and falls back to how many drinks are held up when nothing has been
 * ordered yet.
 *
 * No amounts. A recipe writes them as it likes — "3 cl", "3 skiver",
 * "top op" — so they cannot be added up, and a shopping list that pretended
 * otherwise would be worse than one that leaves it to the person buying.
 */
const ShoppingList: React.FC<{
  ingredients: IngredientWithUse[];
  t: T;
}> = ({ ingredients, t }) => {
  const toBuy = [...ingredients]
    .filter((i) => i.in_stock !== 1)
    .sort(
      (a, b) =>
        b.ordered - a.ordered ||
        b.used_by - a.used_by ||
        a.name.localeCompare(b.name)
    );

  // Nothing has run out, so there is nothing to say.
  if (toBuy.length === 0) return null;

  return (
    <section className="px-5 py-4 border-b border-border">
      <div className="flex flex-wrap items-baseline gap-3 mb-1">
        <h3 className="text-heading">{t("shoppingList")}</h3>
        <p className="font-mono text-caption uppercase text-text-muted">
          {toBuy.length} {t("toBuy")}
        </p>
      </div>
      <p className="text-body text-text-muted mb-3.5">{t("shoppingListHelp")}</p>

      <ul className="flex flex-col gap-1.5">
        {toBuy.map((ingredient) => (
          <li
            key={ingredient.id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
          >
            <span className="text-heading">{ingredient.name}</span>
            <span className="font-mono text-caption uppercase text-text-muted">
              {ingredient.used_by === 1
                ? t("usedInOneDrink")
                : `${ingredient.used_by} ${t("usedInDrinks")}`}
              {" · "}
              {ingredient.ordered === 0
                ? t("neverOrdered")
                : `${ingredient.ordered} ${t("timesOrdered")}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ShoppingList;
