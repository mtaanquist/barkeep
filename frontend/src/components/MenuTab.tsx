import React from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import type { Drink } from "../types";
import { translations, useTranslation } from "../utils/translations";
import StockSwitch from "./bartender/StockSwitch";

type Sort = "default" | "alphabetical" | "category";
type T = (key: keyof typeof translations.en) => string;

/** 56 square: the photo, or a dashed box saying there isn't one. */
const Thumbnail: React.FC<{ drink: Drink; t: T }> = ({ drink, t }) => {
  const dimmed = drink.available !== 1 ? "grayscale opacity-50" : "";

  if (!drink.image_url) {
    return (
      <span
        className={`w-14 h-14 shrink-0 rounded-md border border-dashed border-border bg-surface-sunken flex items-center justify-center text-center font-mono text-[0.5rem] leading-tight uppercase text-text-muted ${dimmed}`}
        aria-hidden="true"
      >
        {t("noPhoto")}
      </span>
    );
  }

  return (
    <span
      className={`w-14 h-14 shrink-0 rounded-md border border-border overflow-hidden ${dimmed}`}
    >
      <img
        src={drink.image_url}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
        style={{
          transform: `translate(${drink.image_crop_x || 0}%, ${drink.image_crop_y || 0}%) scale(${drink.image_crop_zoom || 1})`,
        }}
      />
    </span>
  );
};

/** Out of stock is a state, not an error — muted mono, never red. */
const SoldOutTag: React.FC<{ t: T }> = ({ t }) => (
  <span className="inline-flex items-center h-6 px-2 shrink-0 rounded-sm bg-status-processed-bg border border-status-processed-border text-status-processed-fg font-mono text-[0.625rem] font-bold tracking-[0.12em] uppercase">
    {t("outOfStock")}
  </span>
);

/**
 * Held up by something it is made of, rather than by its own switch. Says
 * which, because "why is this off the menu" is the next question.
 */
const MissingTag: React.FC<{ missing: string[]; t: T }> = ({ missing, t }) => (
  <span className="inline-flex items-center h-6 px-2 shrink-0 rounded-sm bg-status-processed-bg border border-status-processed-border text-status-processed-fg font-mono text-[0.625rem] font-bold tracking-[0.12em] uppercase">
    {t("missingIngredients")} {missing.join(", ")}
  </span>
);

/** A column heading that also sorts by that column. */
const ColumnSort: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}> = ({ label, active, onClick, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`text-left uppercase transition-colors duration-(--duration-instant) hover:text-text cursor-pointer ${
      active ? "text-text" : ""
    } ${className}`}
  >
    {label}
  </button>
);

const MenuTab: React.FC = () => {
  const {
    currentBar,
    language,
    loading,
    drinks,
    setDrinks,
    setLoading,
    setError,
    setViewingRecipe,
    apiCall,
  } = useApp();

  const t = useTranslation(language);
  const navigate = useNavigate();

  const [sortBy, setSortBy] = React.useState<Sort>("default");

  // Clicking the column already sorted puts it back the way it was added.
  const sortByColumn = (next: Sort) =>
    setSortBy((prev) => (prev === next ? "default" : next));

  const handleDelete = async (id: number) => {
    if (!confirm(t("confirmDeleteDrink"))) return;

    setLoading(true);
    try {
      await apiCall(`/drinks/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ barId: currentBar!.id }),
      });

      setDrinks((prev) => prev.filter((drink) => drink.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete drink");
    } finally {
      setLoading(false);
    }
  };

  const toggleStock = async (id: number) => {
    setLoading(true);
    try {
      await apiCall(`/drinks/${id}/stock`, {
        method: "PATCH",
        body: JSON.stringify({ barId: currentBar!.id }),
      });

      setDrinks((prev) =>
        prev.map((drink) =>
          drink.id === id
            ? { ...drink, in_stock: drink.in_stock === 1 ? 0 : 1 }
            : drink
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle stock");
    } finally {
      setLoading(false);
    }
  };

  const soldOut = drinks.filter((drink) => drink.available !== 1).length;

  const sorted = [...drinks].sort((a, b) => {
    if (sortBy === "alphabetical") return a.title.localeCompare(b.title);
    if (sortBy === "category") {
      const byCategory = (a.category_name ?? "").localeCompare(
        b.category_name ?? ""
      );
      return byCategory !== 0 ? byCategory : a.title.localeCompare(b.title);
    }
    return 0;
  });

  return (
    <div>
      <div className="bg-surface border border-border rounded-md overflow-hidden">
        <div className="flex items-center gap-3.5 px-5 py-4 border-b border-border">
          <h2 className="text-display">{t("drinkMenu")}</h2>
          <p className="font-mono text-caption uppercase text-text-muted">
            {drinks.length} {t("inTotal")}
            {soldOut > 0 && ` · ${soldOut} ${t("outOfStock")}`}
          </p>
          <span className="flex-1" />
          <Link
            to="new"
            className="hidden sm:inline-flex h-14 px-5 items-center rounded-md bg-text text-text-inverse text-heading transition-colors duration-(--duration-instant) hover:bg-neutral-800"
          >
            {t("newDrink")}
          </Link>
        </div>

        {drinks.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <h3 className="text-heading mb-1">{t("noDrinks")}</h3>
            <p className="text-body text-text-muted">{t("noDrinksHelp")}</p>
          </div>
        ) : (
          <>
            {/* The headings sort, so there is no separate sort control. */}
            <div className="hidden lg:flex items-center gap-4 px-5 py-2.5 border-b border-border bg-surface-sunken font-mono text-caption text-text-muted">
              <span className="w-14 shrink-0" />
              <ColumnSort
                label={t("columnName")}
                active={sortBy === "alphabetical"}
                onClick={() => sortByColumn("alphabetical")}
                className="flex-1"
              />
              <ColumnSort
                label={t("columnCategory")}
                active={sortBy === "category"}
                onClick={() => sortByColumn("category")}
                className="w-38 shrink-0"
              />
              <span className="w-28 shrink-0 uppercase">
                {t("columnStock")}
              </span>
              <span className="w-28 shrink-0" />
            </div>

            <ul>
              {sorted.map((drink) => {
                const inStock = drink.in_stock === 1;
                const missing = drink.missing_ingredients ?? [];
                const canBeMade = drink.available === 1;

                return (
                  <li
                    key={drink.id}
                    className="relative flex items-center gap-4 px-4 lg:px-5 py-3 border-b border-border last:border-b-0 transition-colors duration-(--duration-instant) hover:bg-surface-sunken"
                  >
                    <Thumbnail drink={drink} t={t} />

                    {/* The whole row opens the drink to read. Changing one is
                        a button on that screen, because there is no undo. */}
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setViewingRecipe(drink)}
                          className={`text-heading truncate text-left after:absolute after:inset-0 cursor-pointer ${
                            canBeMade ? "" : "text-text-muted"
                          }`}
                        >
                          {drink.title}
                        </button>
                        {/* Switched off by hand is its own thing; held up by a
                            bottle that ran out says which bottle. */}
                        {!inStock && <SoldOutTag t={t} />}
                        {inStock && missing.length > 0 && (
                          <MissingTag missing={missing} t={t} />
                        )}
                      </span>
                      <span className="text-body text-text-muted truncate">
                        {/* On a phone the columns fold into this line. */}
                        <span className="lg:hidden">
                          {[
                            drink.category_name,
                            canBeMade ? t("inStock") : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span className="hidden lg:inline">
                          {drink.guest_description || drink.base_spirit}
                        </span>
                      </span>
                    </div>

                    <span className="hidden lg:block w-38 shrink-0 text-body text-text-muted truncate">
                      {drink.category_name}
                    </span>

                    <span className="hidden lg:block relative w-28 shrink-0">
                      <StockSwitch
                        on={inStock}
                        disabled={loading}
                        onChange={() => toggleStock(drink.id)}
                        label={inStock ? t("inStock") : t("outOfStock")}
                      />
                    </span>

                    {/* This column sits above the row, so the delete button
                        can be clicked. Everything else here lets taps through
                        to the row underneath instead of swallowing them. */}
                    <span className="relative pointer-events-none flex items-center justify-end gap-5 lg:w-28 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDelete(drink.id)}
                        disabled={loading}
                        aria-label={`${t("deleteDrink")} ${drink.title}`}
                        className="hidden lg:flex pointer-events-auto w-14 h-14 items-center justify-center rounded-md border border-border bg-surface-raised text-danger transition-colors duration-(--duration-instant) hover:bg-status-rejected-bg disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      {/* An eye, not an arrow: this opens a panel over the
                          list, it does not go anywhere. */}
                      <Eye
                        className="w-5 h-5 text-text-muted"
                        aria-hidden="true"
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* The only floating thing in the product, and it sits clear of the
          queue bar rather than over it. */}
      <button
        type="button"
        onClick={() => navigate("new")}
        aria-label={t("newDrink")}
        className="sm:hidden fixed right-4 bottom-20 z-30 w-16 h-16 flex items-center justify-center rounded-md bg-text text-text-inverse shadow-float cursor-pointer"
      >
        <Plus className="w-7 h-7" strokeWidth={2.5} />
      </button>
    </div>
  );
};

export default MenuTab;
