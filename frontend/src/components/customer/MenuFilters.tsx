import React from "react";
import { Sparkles } from "lucide-react";
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
  canSurprise: boolean;
  onSurpriseMe: () => void;
}

const isChosen = (filter: MenuFilter, type: string, value: string): boolean =>
  filter.type === type && "value" in filter && filter.value === value;

/** Chosen is a filled row rather than a colour, so the menu stays quiet. */
const button = (chosen: boolean) =>
  `w-full text-left px-3 py-2.5 rounded-md text-label transition-colors duration-(--duration-instant) cursor-pointer ${
    chosen
      ? "bg-text text-text-inverse"
      : "text-text-muted hover:bg-surface-sunken hover:text-text"
  }`;

const Divider: React.FC<{ label: string }> = ({ label }) => (
  <li className="pt-4 pb-1">
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-caption uppercase text-text-muted">
        {label}
      </span>
      <span className="flex-1 h-px bg-border" />
    </div>
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
  canSurprise,
  onSurpriseMe,
  t,
}) => (
  <nav className="hidden md:block w-48 sticky top-24 self-start">
    <ul className="space-y-1">
      <li className="mb-3">
        <button
          onClick={onSurpriseMe}
          disabled={!canSurprise}
          className="w-full h-14 flex items-center justify-center gap-2 px-3 rounded-md border border-border bg-surface-raised text-label text-text transition-colors duration-(--duration-instant) hover:border-border-strong disabled:bg-disabled-bg disabled:text-disabled-fg disabled:border-disabled-border disabled:cursor-not-allowed cursor-pointer"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          {t("surpriseMe")}
        </button>
      </li>

      <li>
        <button
          onClick={() => onFilter({ type: "all" })}
          className={button(filter.type === "all")}
        >
          All Drinks
        </button>
      </li>

      {favouriteCount > 0 && (
        <li>
          <a
            href="#favourites"
            className="block px-3 py-2.5 rounded-md text-label text-text-muted transition-colors duration-(--duration-instant) hover:bg-surface-sunken hover:text-text"
          >
            {t("favourites")} ({favouriteCount})
          </a>
        </li>
      )}

      {categories.length > 0 && (
        <>
          <Divider label="Categories" />
          {categories.map((category) => (
            <li key={category}>
              <button
                onClick={() => onFilter({ type: "category", value: category })}
                className={button(isChosen(filter, "category", category))}
              >
                {category} ({byCategory[category].length})
              </button>
            </li>
          ))}
        </>
      )}

      {spirits.length > 0 && <Divider label="Base Spirits" />}

      {spirits.map((spirit) => (
        <li key={spirit}>
          <button
            onClick={() => onFilter({ type: "spirit", value: spirit })}
            className={button(isChosen(filter, "spirit", spirit))}
          >
            {spirit} ({bySpirit[spirit].length})
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
  <div className="md:hidden mb-4 space-y-3">
    <h2 className="text-heading">{t("availableDrinks")}</h2>

    <label className="block">
      <span className="block text-label mb-2">Filter Drinks</span>
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
          <option value="all">All Drinks</option>
          {categories.length > 0 && (
            <optgroup label="Categories">
              {categories.map((category) => (
                <option key={category} value={`category:${category}`}>
                  {category} ({byCategory[category].length})
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Base Spirits">
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
