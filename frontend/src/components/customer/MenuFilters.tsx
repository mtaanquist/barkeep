import React from "react";
import { Dices, SlidersHorizontal, Star, X } from "lucide-react";
import type { Drink } from "../../types";
import type { MenuFilter } from "../../hooks/useGuestMenu";
import { useCloseOnEscape } from "../../hooks/useCloseOnEscape";
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

interface SurpriseProps {
  canSurprise: boolean;
  onSurpriseMe: () => void;
  t: (key: keyof typeof translations.en) => string;
}

interface SidebarProps extends FilterProps, SurpriseProps {
  favouriteCount: number;
  /** Everything on the menu, for the count beside "all drinks". */
  totalCount: number;
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

/**
 * Let the bar choose. Dashed, because it is the one thing here that is a bit
 * of a game. The same button on both sizes of screen, so it does not have to
 * be restyled twice.
 */
const SurpriseMeButton: React.FC<SurpriseProps> = ({
  canSurprise,
  onSurpriseMe,
  t,
}) => (
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
);

/**
 * Surprise me, on a phone. It rides in the header's own sticky block, under
 * the chips and above the first drink, so it is still there however far down
 * the menu a guest has got.
 */
export const MenuSurpriseRow: React.FC<SurpriseProps> = (props) => (
  <div className="lg:hidden max-w-7xl mx-auto px-4 pb-2.5">
    <SurpriseMeButton {...props} />
  </div>
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
  <nav className="hidden lg:block w-62 shrink-0 self-stretch border-r border-border py-4 px-3">
    <ul className="flex flex-col gap-1">
      <li className="mb-1">
        <SurpriseMeButton
          canSurprise={canSurprise}
          onSurpriseMe={onSurpriseMe}
          t={t}
        />
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

interface ChipsProps extends FilterProps {
  favouriteCount: number;
  totalCount: number;
}

/** One chip: what it filters to, what it says, and how many there are. */
interface Chip {
  key: string;
  label: string;
  count: number;
  filter: MenuFilter;
}

const keyOf = (filter: MenuFilter) =>
  filter.type === "all" ? "all" : `${filter.type}:${filter.value}`;

const chipsFor = ({
  categories,
  spirits,
  byCategory,
  bySpirit,
  totalCount,
  t,
}: ChipsProps): Chip[] => [
  {
    key: "all",
    label: t("allDrinks"),
    count: totalCount,
    filter: { type: "all" },
  },
  ...categories.map((category) => ({
    key: `category:${category}`,
    label: category,
    count: byCategory[category].length,
    filter: { type: "category" as const, value: category },
  })),
  ...spirits.map((spirit) => ({
    key: `spirit:${spirit}`,
    label: spirit,
    count: bySpirit[spirit].length,
    filter: { type: "spirit" as const, value: spirit },
  })),
];

/**
 * On a phone the side menu becomes a rail of chips that scrolls sideways.
 * Every chip carries its count, so a guest sees what is on offer without
 * opening anything; the leading button opens the full list when the rail
 * is not enough.
 *
 * It rides in the header's own sticky block rather than at the top of the
 * page, so it sits against the header instead of below a band of white.
 */
export const MenuChipRail: React.FC<
  ChipsProps & { onOpenFilters: () => void }
> = (props) => {
  const { filter, onFilter, onOpenFilters, t } = props;

  const chosen = keyOf(filter);
  // Whichever is in force comes first, so it is never off the side.
  const chips = chipsFor(props).sort(
    (a, b) => Number(b.key === chosen) - Number(a.key === chosen)
  );

  return (
    <div className="lg:hidden max-w-7xl mx-auto px-4 py-2.5 flex gap-2 overflow-x-auto">
      <button
        onClick={onOpenFilters}
        className="h-11 pl-3.5 pr-4 shrink-0 flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-raised text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
      >
        <SlidersHorizontal className="w-4 h-4 shrink-0" />
        {t("filterShort")}
      </button>

      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={() => onFilter(chip.filter)}
          aria-pressed={chip.key === chosen}
          className={`h-11 px-4 shrink-0 rounded-full text-label whitespace-nowrap transition-colors duration-(--duration-instant) cursor-pointer ${
            chip.key === chosen
              ? "bg-text text-text-inverse"
              : "bg-surface-raised border border-border hover:bg-surface-sunken"
          }`}
        >
          {chip.label} {chip.count}
        </button>
      ))}
    </div>
  );
};

/**
 * The whole list, over the menu, with the menu left where it was. Kept out
 * of the header on purpose: anything fixed inside it is trapped under the
 * dock, which sits higher.
 */
export const FilterSheet: React.FC<FilterProps & { onClose: () => void }> = ({
  categories,
  spirits,
  byCategory,
  bySpirit,
  filter,
  onFilter,
  onClose,
  t,
}) => {
  useCloseOnEscape(onClose);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 bg-overlay cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("filterDrinks")}
        className="relative max-h-[80vh] flex flex-col bg-surface border-t-2 border-border-strong rounded-t-lg"
      >
        <div className="shrink-0 px-4 py-3 border-b border-border flex items-center gap-3">
          <h2 className="flex-1 text-heading">{t("filterDrinks")}</h2>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto py-2">
          <li>
            <button
              onClick={() => onFilter({ type: "all" })}
              className={row(filter.type === "all")}
            >
              <span className="flex-1 font-semibold text-base">
                {t("allDrinks")}
              </span>
            </button>
          </li>

          {categories.length > 0 && <GroupLabel label={t("categories")} />}
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
      </div>
    </div>
  );
};

