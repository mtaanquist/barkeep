import React from "react";
import { Dices, Star } from "lucide-react";
import type { Drink } from "../../types";
import type { MenuFilter } from "../../hooks/useGuestMenu";
import { translations } from "../../utils/translations";

interface FilterProps {
  categories: string[];
  spirits: string[];
  byCategory: Record<string, Drink[]>;
  bySpirit: Record<string, Drink[]>;
  filter: MenuFilter;
  onFilter: (filter: MenuFilter) => void;
  t: (key: keyof typeof translations.en) => string;
}

interface SidebarProps extends FilterProps {
  favouriteCount: number;
  /** Everything on the menu, for the count beside "all drinks". */
  totalCount: number;
  canSurprise: boolean;
  onSurpriseMe: () => void;
}

const isChosen = (filter: MenuFilter, type: string, value: string): boolean =>
  filter.type === type && "value" in filter && filter.value === value;

/** Chosen is a sunken row with a bar down its left edge, not a fill. */
const row = (chosen: boolean) =>
  `w-full h-14 flex items-center gap-2.5 text-left transition-colors duration-(--duration-instant) cursor-pointer ${
    chosen
      ? "bg-surface-sunken border-l-4 border-border-strong pl-2 pr-3"
      : "px-3 hover:bg-surface-sunken"
  }`;

/** The count sits to the right of every row, in the same column. */
const Count: React.FC<{ n: number }> = ({ n }) => (
  <span className="font-mono text-[0.8125rem] font-bold leading-none text-text-muted">
    {n}
  </span>
);

const GroupLabel: React.FC<{ label: string }> = ({ label }) => (
  <li className="px-3 pt-4 pb-1.5 font-mono text-caption uppercase text-text-muted">
    {label}
  </li>
);

/** The menu down the side, on a wide screen. */
export const MenuSidebar: React.FC<SidebarProps> = ({
  categories,
  spirits,
  byCategory,
  bySpirit,
  filter,
  onFilter,
  favouriteCount,
  totalCount,
  canSurprise,
  onSurpriseMe,
  t,
}) => (
  <nav className="hidden lg:block w-62 shrink-0 self-stretch border-r border-border py-4 pr-3">
    <ul>
      {/* Dashed, because it is the one thing here that is a bit of a game. */}
      <li className="px-3 mb-2">
        <button
          onClick={onSurpriseMe}
          disabled={!canSurprise}
          className="w-full h-14 flex items-center justify-center gap-2.5 rounded-md border-2 border-dashed border-border-strong text-text transition-colors duration-(--duration-instant) hover:bg-surface-sunken disabled:border-disabled-border disabled:text-disabled-fg disabled:cursor-not-allowed cursor-pointer"
        >
          <Dices className="w-5 h-5 shrink-0 text-text-muted" />
          <span className="flex flex-col items-start">
            <span className="font-bold text-base leading-tight tracking-tight">
              {t("surpriseMe")}
            </span>
            <span className="font-mono text-[0.5625rem] font-bold tracking-[0.14em] uppercase text-text-muted">
              {t("letTheBarChoose")}
            </span>
          </span>
        </button>
      </li>

      <li>
        <button
          onClick={() => onFilter({ type: "all" })}
          className={row(filter.type === "all")}
        >
          <span className="flex-1 font-semibold text-base">
            {t("allDrinks")}
          </span>
          <Count n={totalCount} />
        </button>
      </li>

      {favouriteCount > 0 && (
        <li>
          <a href="#favourites" className={row(false)}>
            <span className="flex-1 flex items-center gap-2 font-semibold text-base">
              <Star className="w-4 h-4 shrink-0 fill-current" />
              {t("favourites")}
            </span>
            <Count n={favouriteCount} />
          </a>
        </li>
      )}

      {categories.length > 0 && (
        <>
          <GroupLabel label={t("categories")} />
          {categories.map((category) => (
            <li key={category}>
              <button
                onClick={() => onFilter({ type: "category", value: category })}
                className={row(isChosen(filter, "category", category))}
              >
                <span className="flex-1 font-semibold text-base truncate">
                  {category}
                </span>
                <Count n={byCategory[category].length} />
              </button>
            </li>
          ))}
        </>
      )}

      {spirits.length > 0 && <GroupLabel label={t("baseSpirits")} />}

      {spirits.map((spirit) => (
        <li key={spirit}>
          <button
            onClick={() => onFilter({ type: "spirit", value: spirit })}
            className={row(isChosen(filter, "spirit", spirit))}
          >
            <span className="flex-1 font-semibold text-base truncate">
              {spirit}
            </span>
            <Count n={bySpirit[spirit].length} />
          </button>
        </li>
      ))}
    </ul>
  </nav>
);

/** The same choices as a dropdown, on a phone. */
export const MenuFilterSelect: React.FC<FilterProps> = ({
  categories,
  spirits,
  byCategory,
  bySpirit,
  filter,
  onFilter,
  t,
}) => (
  <div className="lg:hidden mb-4 space-y-3">
    <h2 className="text-heading">{t("availableDrinks")}</h2>

    <label className="block">
      <span className="block text-label mb-2">{t("filterDrinks")}</span>
      {/* A real native select, so the phone's own list still opens. */}
      <span className="relative block">
        <select
          value={
            filter.type === "all" ? "all" : `${filter.type}:${filter.value}`
          }
          onChange={(e) => {
            const [type, ...rest] = e.target.value.split(":");
            // Rejoined, because a category may have a colon in its name.
            const value = rest.join(":");

            onFilter(
              type === "all"
                ? { type: "all" }
                : { type: type as "category" | "spirit", value }
            );
          }}
          className="appearance-none w-full h-14 pl-3.5 pr-11 rounded-md border border-border bg-surface-raised text-text text-body cursor-pointer focus:border-border-strong focus:outline-none focus:shadow-focus"
        >
          <option value="all">{t("allDrinks")}</option>
          {categories.length > 0 && (
            <optgroup label={t("categories")}>
              {categories.map((category) => (
                <option key={category} value={`category:${category}`}>
                  {category} ({byCategory[category].length})
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label={t("baseSpirits")}>
            {spirits.map((spirit) => (
              <option key={spirit} value={`spirit:${spirit}`}>
                {spirit} ({bySpirit[spirit].length})
              </option>
            ))}
          </optgroup>
        </select>
        <span
          className="pointer-events-none absolute right-4 top-1/2 w-2.5 h-2.5 -translate-y-[70%] rotate-45 border-r-2 border-b-2 border-text"
          aria-hidden="true"
        />
      </span>
    </label>
  </div>
);
