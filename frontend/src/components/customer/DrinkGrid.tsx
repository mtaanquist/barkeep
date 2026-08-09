import React from "react";
import DrinkCard from "../DrinkCard";
import type { Drink } from "../../types";
import { translations } from "../../utils/translations";

interface DrinkGridProps {
  drinks: Drink[];
  heading: string;
  /** Set when the section is a jump target for the menu on the left. */
  id?: string;
  /** Extra spacing, where a section wants setting apart from the next. */
  className?: string;
  onViewRecipe: (drink: Drink) => void;
  onOrder: (drink: Drink) => void;
  onToggleFavourite: (drink: Drink) => void;
  disabled: boolean;
  loading: boolean;
  t: (key: keyof typeof translations.en) => string;
}

/** One headed section of drinks. The guest's menu is made of these. */
const DrinkGrid: React.FC<DrinkGridProps> = ({
  drinks,
  heading,
  id,
  className = "",
  ...card
}) => (
  <section id={id} className={`scroll-mt-24 ${className}`}>
    {/* A quiet label and a rule, so the drinks are the only loud thing. */}
    <div className="flex items-center gap-2.5 mb-4">
      <h2 className="font-mono text-caption uppercase text-text-muted">
        {heading} · {drinks.length}
      </h2>
      <span className="flex-1 h-px bg-border" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {drinks.map((drink) => (
        <DrinkCard key={drink.id} drink={drink} {...card} />
      ))}
    </div>
  </section>
);

export default DrinkGrid;
