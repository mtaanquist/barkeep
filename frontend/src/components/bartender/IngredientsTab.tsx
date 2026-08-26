import React, { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useApp } from "../../hooks/useApp";
import type { Ingredient } from "../../types";
import { translations, useTranslation } from "../../utils/translations";
import StockSwitch from "./StockSwitch";

type T = (key: keyof typeof translations.en) => string;

/** An ingredient, with how many drinks would go without it. */
interface Stocked extends Ingredient {
  used_by: number;
}

const INPUT =
  "h-14 px-3.5 rounded-md border border-border bg-surface-raised text-body focus:outline-none focus:border-border-strong focus:shadow-focus";

/** The row while it is being renamed. */
const Rename: React.FC<{
  ingredient: Stocked;
  onSave: (name: string) => void;
  onCancel: () => void;
  loading: boolean;
  t: T;
}> = ({ ingredient, onSave, onCancel, loading, t }) => {
  const [name, setName] = useState(ingredient.name);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name.trim());
      }}
      className="flex-1 flex flex-wrap items-center gap-3"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label={t("ingredientName")}
        className={`${INPUT} flex-1 min-w-40`}
        autoFocus
        required
      />
      <button
        type="submit"
        disabled={loading || !name.trim() || name.trim() === ingredient.name}
        className="h-14 px-5 rounded-md bg-text text-text-inverse text-label transition-colors duration-(--duration-instant) hover:bg-neutral-800 disabled:bg-disabled-bg disabled:text-disabled-fg disabled:cursor-not-allowed cursor-pointer"
      >
        {t("save")}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-14 px-4 rounded-md text-label text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
      >
        {t("cancel")}
      </button>
    </form>
  );
};

/**
 * What the bar is pouring. One switch each: turn it off and every drink that
 * needs it leaves the menu at once, which is the whole reason this screen
 * exists.
 */
const IngredientsTab: React.FC = () => {
  const { currentBar, language, loading, setLoading, setError, apiCall } =
    useApp();

  const t: T = useTranslation(language);

  const [ingredients, setIngredients] = useState<Stocked[]>([]);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [adding, setAdding] = useState("");

  const barId = currentBar?.id;

  const fetchIngredients = useCallback(async () => {
    if (!barId) return;
    try {
      setIngredients(await apiCall<Stocked[]>(`/ingredients/bar/${barId}`));
    } catch (err) {
      console.error("Could not load the ingredients:", err);
    }
  }, [barId, apiCall]);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  /** Runs something against the server and puts the list right afterwards. */
  const change = async (work: () => Promise<unknown>, whenItGoesWrong: string) => {
    setLoading(true);
    try {
      await work();
      await fetchIngredients();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : whenItGoesWrong);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = adding.trim();
    if (!name) return;

    const added = await change(
      () =>
        apiCall("/ingredients", {
          method: "POST",
          body: JSON.stringify({ barId, name }),
        }),
      "Failed to add ingredient"
    );

    if (added) setAdding("");
  };

  const handleRename = async (ingredient: Stocked, name: string) => {
    const renamed = await change(
      () =>
        apiCall(`/ingredients/${ingredient.id}`, {
          method: "PUT",
          body: JSON.stringify({ barId, name }),
        }),
      "Failed to rename ingredient"
    );

    if (renamed) setRenaming(null);
  };

  const toggleStock = (ingredient: Stocked) =>
    change(
      () =>
        apiCall(`/ingredients/${ingredient.id}/stock`, {
          method: "PATCH",
          body: JSON.stringify({ barId }),
        }),
      "Failed to toggle stock"
    );

  const handleDelete = (ingredient: Stocked) => {
    if (!confirm(t("confirmDeleteIngredient"))) return;

    return change(
      () =>
        apiCall(`/ingredients/${ingredient.id}`, {
          method: "DELETE",
          body: JSON.stringify({ barId }),
        }),
      "Failed to delete ingredient"
    );
  };

  const outOfStock = ingredients.filter((i) => i.in_stock !== 1).length;

  return (
    <div className="bg-surface border border-border rounded-md overflow-hidden">
      <div className="flex flex-wrap items-center gap-3.5 px-5 py-4 border-b border-border">
        <h2 className="text-display">{t("ingredients")}</h2>
        <p className="font-mono text-caption uppercase text-text-muted">
          {ingredients.length} {t("inTotal")}
          {outOfStock > 0 && ` · ${outOfStock} ${t("outOfStock")}`}
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border bg-surface-sunken"
      >
        <input
          type="text"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder={t("ingredientNamePlaceholder")}
          aria-label={t("ingredientName")}
          className={`${INPUT} flex-1 min-w-40`}
        />
        <button
          type="submit"
          disabled={loading || !adding.trim()}
          className="h-14 px-5 inline-flex items-center gap-2 rounded-md bg-text text-text-inverse text-heading transition-colors duration-(--duration-instant) hover:bg-neutral-800 disabled:bg-disabled-bg disabled:text-disabled-fg disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
          {t("addIngredient")}
        </button>
      </form>

      {ingredients.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <h3 className="text-heading mb-1">{t("noIngredients")}</h3>
          <p className="text-body text-text-muted">{t("noIngredientsHelp")}</p>
        </div>
      ) : (
        <>
          <div className="hidden lg:flex items-center gap-4 px-5 py-2.5 border-b border-border bg-surface-sunken font-mono text-caption text-text-muted">
            <span className="flex-1 uppercase">{t("ingredientName")}</span>
            <span className="w-28 shrink-0 uppercase">{t("columnUsedBy")}</span>
            <span className="w-28 shrink-0 uppercase">{t("columnStock")}</span>
            <span className="w-14 shrink-0" />
          </div>

          <ul>
            {ingredients.map((ingredient) => {
              const inStock = ingredient.in_stock === 1;

              return (
                <li
                  key={ingredient.id}
                  className="flex flex-wrap items-center gap-4 px-4 lg:px-5 py-3 border-b border-border last:border-b-0 transition-colors duration-(--duration-instant) hover:bg-surface-sunken"
                >
                  {renaming === ingredient.id ? (
                    <Rename
                      ingredient={ingredient}
                      onSave={(name) => handleRename(ingredient, name)}
                      onCancel={() => setRenaming(null)}
                      loading={loading}
                      t={t}
                    />
                  ) : (
                    <>
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        {/* The row's name is the way in to renaming it, the
                            same as a drink's name is the way in to reading it. */}
                        <button
                          type="button"
                          onClick={() => setRenaming(ingredient.id)}
                          aria-label={`${t("editIngredient")} ${ingredient.name}`}
                          className={`text-heading truncate text-left cursor-pointer ${
                            inStock ? "" : "text-text-muted"
                          }`}
                        >
                          {ingredient.name}
                        </button>
                        <span className="lg:hidden text-body text-text-muted truncate">
                          {ingredient.used_by === 1
                            ? t("usedInOneDrink")
                            : `${ingredient.used_by} ${t("usedInDrinks")}`}
                        </span>
                      </div>

                      <span className="hidden lg:block w-28 shrink-0 text-body text-text-muted">
                        {ingredient.used_by === 1
                          ? t("usedInOneDrink")
                          : `${ingredient.used_by} ${t("usedInDrinks")}`}
                      </span>

                      <span className="w-28 shrink-0">
                        <StockSwitch
                          on={inStock}
                          disabled={loading}
                          onChange={() => toggleStock(ingredient)}
                          label={inStock ? t("inStock") : t("outOfStock")}
                        />
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDelete(ingredient)}
                        disabled={loading}
                        aria-label={`${t("deleteIngredient")} ${ingredient.name}`}
                        className="w-14 h-14 shrink-0 flex items-center justify-center rounded-md border border-border bg-surface-raised text-danger transition-colors duration-(--duration-instant) hover:bg-status-rejected-bg disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

export default IngredientsTab;
