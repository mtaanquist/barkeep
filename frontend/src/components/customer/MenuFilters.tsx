import React from "react";
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

const button = (chosen: boolean, chosenClass: string, hoverClass: string) =>
  `w-full text-left px-3 py-2 rounded font-medium transition-colors ${
    chosen ? chosenClass : `${hoverClass} text-gray-700`
  }`;

const Divider: React.FC<{ label: string }> = ({ label }) => (
  <>
    <li className="py-2">
      <hr className="border-gray-300" />
    </li>
    <li>
      <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
        {label}
      </div>
    </li>
  </>
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
    <ul className="space-y-2">
      <li>
        <button
          onClick={onSurpriseMe}
          disabled={!canSurprise}
          className="w-full flex items-center justify-center px-3 py-2 mb-2 bg-pink-600 text-white rounded font-bold text-base shadow hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          🎲 {t("surpriseMe")}
        </button>
      </li>

      <li>
        <button
          onClick={() => onFilter({ type: "all" })}
          className={button(
            filter.type === "all",
            "bg-blue-100 text-blue-700",
            "hover:bg-gray-100"
          )}
        >
          📋 All Drinks
        </button>
      </li>

      {favouriteCount > 0 && (
        <li>
          <a
            href="#favourites"
            className="block px-3 py-2 rounded hover:bg-yellow-100 text-yellow-700 font-medium"
          >
            ⭐ {t("favourites")} ({favouriteCount})
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
                className={button(
                  isChosen(filter, "category", category),
                  "bg-green-100 text-green-700",
                  "hover:bg-green-50"
                )}
              >
                📁 {category} ({byCategory[category].length})
              </button>
            </li>
          ))}
          <Divider label="Base Spirits" />
        </>
      )}

      {spirits.map((spirit) => (
        <li key={spirit}>
          <button
            onClick={() => onFilter({ type: "spirit", value: spirit })}
            className={button(
              isChosen(filter, "spirit", spirit),
              "bg-blue-100 text-blue-700",
              "hover:bg-blue-50"
            )}
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
  <div className="md:hidden mb-4 space-y-4">
    <h2 className="text-lg font-bold text-blue-800 text-center py-2">
      {t("availableDrinks")}
    </h2>

    <div className="px-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Filter Drinks
      </label>
      <select
        value={filter.type === "all" ? "all" : `${filter.type}:${filter.value}`}
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
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="all">📋 All Drinks</option>
        {categories.length > 0 && (
          <optgroup label="Categories">
            {categories.map((category) => (
              <option key={category} value={`category:${category}`}>
                📁 {category} ({byCategory[category].length})
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
    </div>
  </div>
);
