import React from "react";
import DrinkCard from "../DrinkCard";
import type { Drink } from "../../types";
import { translations } from "../../utils/translations";

interface DrinkGridProps {
  drinks: Drink[];
  heading: string;
  headingClass: string;
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
  headingClass,
  id,
  className = "",
  ...card
}) => (
  <section id={id} className={`scroll-mt-24 ${className}`}>
    <h2 className={`text-2xl font-bold mb-4 ${headingClass}`}>{heading}</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {drinks.map((drink) => (
        <DrinkCard key={drink.id} drink={drink} {...card} />
      ))}
    </div>
  </section>
);

export default DrinkGrid;
