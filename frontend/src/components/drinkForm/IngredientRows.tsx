import React, { useId, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Ingredient } from "../../types";
import type { translations } from "../../utils/translations";
import { loosely } from "../../utils/matching";

type T = (key: keyof typeof translations.en) => string;

/** How many suggestions are worth showing before the list stops being a help. */
const MOST_SHOWN = 8;

const INPUT =
  "h-14 px-3.5 rounded-md border border-border bg-surface-raised text-body focus:outline-none focus:border-border-strong focus:shadow-focus";

/** One line of a recipe as the form holds it. */
export interface IngredientRow {
  name: string;
  amount: string;
}

interface PickerProps {
  value: string;
  onChange: (name: string) => void;
  known: Ingredient[];
  label: string;
  placeholder: string;
}

/**
 * Picks one of the bar's ingredients, or takes a new name. Typing a name the
 * bar has not got is not a mistake — it is how a new one gets added, without
 * making the bartender leave the drink they are in the middle of.
 */
const IngredientPicker: React.FC<PickerProps> = ({
  value,
  onChange,
  known,
  label,
  placeholder,
}) => {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const field = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const wanted = loosely(value.trim());
    const pool = wanted
      ? known.filter((i) => loosely(i.name).includes(wanted))
      : known;

    // Something already spelled exactly right needs no suggesting.
    const exact = pool.length === 1 && loosely(pool[0]!.name) === wanted;

    return exact ? [] : pool.slice(0, MOST_SHOWN);
  }, [known, value]);

  const showing = open && matches.length > 0;

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    field.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && showing) {
      // Only closes the list. The panel this sits in keeps its own Escape.
      event.stopPropagation();
      setOpen(false);
      return;
    }

    if (!showing) {
      if (event.key === "ArrowDown") setOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((at) => (at + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((at) => (at - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      // Enter inside a form would otherwise save the drink.
      event.preventDefault();
      const chosen = matches[highlighted];
      if (chosen) pick(chosen.name);
    }
  };

  return (
    <div className="relative flex-1 min-w-40">
      <input
        ref={field}
        type="text"
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showing ? `${listId}-${highlighted}` : undefined
        }
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlighted(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Late enough that a click on the list still lands.
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        className={`${INPUT} w-full`}
      />

      {showing && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full inset-x-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-surface-raised shadow-float"
        >
          {matches.map((ingredient, at) => (
            <li
              key={ingredient.id}
              id={`${listId}-${at}`}
              role="option"
              aria-selected={at === highlighted}
              onMouseDown={(e) => {
                // Keeps the field from losing focus before the click lands.
                e.preventDefault();
                pick(ingredient.name);
              }}
              onMouseEnter={() => setHighlighted(at)}
              className={`px-3.5 py-2.5 text-body cursor-pointer ${
                at === highlighted ? "bg-surface-sunken" : ""
              } ${ingredient.in_stock === 1 ? "" : "text-text-muted"}`}
            >
              {ingredient.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface IngredientRowsProps {
  rows: IngredientRow[];
  onChange: (rows: IngredientRow[]) => void;
  /** What the bar already pours, for the suggestions. */
  known: Ingredient[];
  t: T;
}

/**
 * What goes in a drink, a line at a time. The amount is whatever the recipe
 * says — "3 cl", "1 skive", "top op" — because no list of units covers all
 * three, and it is only ever read back to a person.
 */
const IngredientRows: React.FC<IngredientRowsProps> = ({
  rows,
  onChange,
  known,
  t,
}) => {
  const set = (at: number, patch: Partial<IngredientRow>) =>
    onChange(rows.map((row, n) => (n === at ? { ...row, ...patch } : row)));

  const remove = (at: number) => onChange(rows.filter((_, n) => n !== at));

  const add = () => onChange([...rows, { name: "", amount: "" }]);

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && (
        <p className="text-body text-text-muted">{t("noIngredientsOnDrink")}</p>
      )}

      {rows.map((row, at) => (
        <div key={at} className="flex items-start gap-3">
          <input
            type="text"
            value={row.amount}
            onChange={(e) => set(at, { amount: e.target.value })}
            placeholder={t("amountPlaceholder")}
            aria-label={t("amount")}
            className={`${INPUT} w-24 shrink-0`}
          />

          <IngredientPicker
            value={row.name}
            onChange={(name) => set(at, { name })}
            known={known}
            label={t("ingredient")}
            placeholder={t("ingredientNamePlaceholder")}
          />

          <button
            type="button"
            onClick={() => remove(at)}
            aria-label={`${t("removeIngredient")} ${row.name || at + 1}`}
            className="w-14 h-14 shrink-0 flex items-center justify-center rounded-md border border-border bg-surface-raised text-text-muted transition-colors duration-(--duration-instant) hover:bg-surface-sunken hover:text-text cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ))}

      <div>
        <button
          type="button"
          onClick={add}
          className="h-14 px-4 inline-flex items-center gap-2 rounded-md border border-border bg-surface-raised text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
          {t("addIngredient")}
        </button>
      </div>
    </div>
  );
};

export default IngredientRows;
