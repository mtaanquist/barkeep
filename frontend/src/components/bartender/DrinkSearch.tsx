import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useApp } from "../../hooks/useApp";
import { useCloseOnEscape } from "../../hooks/useCloseOnEscape";
import type { Drink } from "../../types";
import { useTranslation } from "../../utils/translations";
import { loosely } from "../../utils/matching";

/** How many matches are worth showing before the list stops being a shortcut. */
const MOST_SHOWN = 8;

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

  // On the rail there is nothing holding these, so they have to clear
  // themselves or they sit over the queue count below.
  useCloseOnEscape(() => setTerm(""), searching);

  const pick = (drink: Drink) => {
    setViewingRecipe(drink);
    setTerm("");
    onPicked?.();
  };

  // Typing a name and pressing Enter opens the top match, so a bartender on a
  // laptop never has to reach for the mouse.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || found.length === 0) return;
    e.preventDefault();
    pick(found[0]);
  };

  return (
    // The results hang over what is below rather than pushing it down: the
    // pending count sits under this in the rail and must not move.
    <div className="relative">
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
          onKeyDown={onKeyDown}
          aria-label={t("searchDrinks")}
          placeholder={t("searchDrinks")}
          className="w-full h-12 pl-9 pr-3 rounded-md border border-border bg-surface-raised text-body text-text placeholder:text-text-muted"
        />
      </div>

      {/* Read out for anyone who cannot see the list appear. */}
      <p aria-live="polite" className="sr-only">
        {searching &&
          (found.length === 0
            ? t("searchNoMatches")
            : `${found.length} ${t("searchResults")}`)}
      </p>

      {searching && (
        <div className="absolute top-full inset-x-0 z-30 mt-2 p-1 rounded-md border border-border bg-surface-raised shadow-float">
          {found.length === 0 ? (
            <p className="px-2 py-2 text-body text-text-muted">
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
                  {/* Switched off, or held up by a bottle that ran out — from
                      here they mean the same thing: it cannot be made. */}
                  {drink.available !== 1 && (
                    <span className="shrink-0 font-mono text-caption uppercase text-text-muted">
                      {t("outOfStock")}
                    </span>
                  )}
                </button>
              </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default DrinkSearch;
