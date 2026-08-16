import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useApp } from "../../hooks/useApp";
import type { Drink } from "../../types";
import { useTranslation } from "../../utils/translations";

/** How many matches are worth showing before the list stops being a shortcut. */
const MOST_SHOWN = 8;

/**
 * Case and accents are not how anyone remembers a drink's name, so neither
 * gets in the way of finding it. Danish å, ø and æ stand as they are.
 */
const loosely = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();

const matches = (drinks: Drink[], term: string): Drink[] => {
  const wanted = loosely(term.trim());
  if (!wanted) return [];

  return drinks
    .filter((drink) => loosely(drink.title).includes(wanted))
    .slice(0, MOST_SHOWN);
};

interface DrinkSearchProps {
  /** Given on the phone, where the field opens with the keyboard already up. */
  autoFocus?: boolean;
  /** Called once a drink has been picked, for closing whatever held this. */
  onPicked?: () => void;
}

/**
 * Finding a drink without leaving the queue. The bartender is asked what goes
 * in something while they are working, and the answer should not cost them
 * their place.
 */
const DrinkSearch: React.FC<DrinkSearchProps> = ({ autoFocus, onPicked }) => {
  const { drinks, language, setViewingRecipe } = useApp();
  const t = useTranslation(language);

  const [term, setTerm] = useState("");

  const found = useMemo(() => matches(drinks, term), [drinks, term]);
  const searching = term.trim().length > 0;

  const pick = (drink: Drink) => {
    setViewingRecipe(drink);
    setTerm("");
    onPicked?.();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={term}
          autoFocus={autoFocus}
          onChange={(e) => setTerm(e.target.value)}
          aria-label={t("searchDrinks")}
          placeholder={t("searchDrinks")}
          className="w-full h-12 pl-9 pr-3 rounded-md border border-border bg-surface-raised text-body text-text placeholder:text-text-muted"
        />
      </div>

      {searching &&
        (found.length === 0 ? (
          <p className="px-1 py-2 text-body text-text-muted">
            {t("searchNoMatches")}
          </p>
        ) : (
          <ul className="flex flex-col max-h-72 overflow-y-auto">
            {found.map((drink) => (
              <li key={drink.id}>
                <button
                  type="button"
                  onClick={() => pick(drink)}
                  className="w-full h-12 px-3 flex items-center gap-2 rounded-md text-left transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
                >
                  <span className="flex-1 min-w-0 truncate text-body text-text">
                    {drink.title}
                  </span>
                  {drink.in_stock !== 1 && (
                    <span className="shrink-0 font-mono text-caption uppercase text-text-muted">
                      {t("outOfStock")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
};

export default DrinkSearch;
