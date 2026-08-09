import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import type { Drink } from "../types";
import { translations, useTranslation } from "../utils/translations";
import { BASE_SPIRITS } from "../utils/spirits";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import LazyMDEditor from "./LazyMDEditor";
import DrinkImageField, { type DrinkImage } from "./drinkForm/DrinkImageField";
import Switch from "./bartender/Switch";
import Field from "./Field";

type T = (key: keyof typeof translations.en) => string;

const INPUT =
  "h-14 px-3.5 rounded-md border border-border bg-surface-raised text-body focus:outline-none focus:border-border-strong focus:shadow-focus";

/** A switch with what it does written next to it. */
const ToggleRow: React.FC<{
  on: boolean;
  onChange: (on: boolean) => void;
  title: string;
  help: string;
}> = ({ on, onChange, title, help }) => (
  <label className="flex items-center gap-3 p-3 rounded-md border border-border cursor-pointer">
    <input
      type="checkbox"
      checked={on}
      onChange={(e) => onChange(e.target.checked)}
      className="sr-only"
    />
    <Switch on={on} />
    <span className="flex-1 flex flex-col gap-0.5">
      <span className="text-label">{title}</span>
      <span className="text-body text-text-muted">{help}</span>
    </span>
  </label>
);

/**
 * A named part of the form. On a new drink everything but the first is
 * folded away, so a name and a recipe is fifteen seconds of work rather
 * than a wall of eleven fields.
 */
const Section: React.FC<{
  kicker: string;
  marker: string;
  open: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}> = ({ kicker, marker, open, onOpen, children }) => {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full h-14 px-5 flex items-center gap-3 text-left transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
      >
        <span className="flex-1 font-mono text-caption uppercase text-text-muted">
          {kicker}
        </span>
        <span className="font-mono text-caption uppercase text-text-muted">
          {marker}
        </span>
        <ChevronDown className="w-4 h-4 text-text-muted" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="px-5 py-4.5 flex flex-col gap-4">
      <span className="font-mono text-caption uppercase text-text-muted">
        {kicker}
      </span>
      {children}
    </div>
  );
};

interface DrinkFormProps {
  /** The drink being changed, or nothing when adding one. */
  drink: Drink | null;
  onDone: () => void;
}

export const DrinkForm: React.FC<DrinkFormProps> = ({ drink, onDone }) => {
  const {
    currentBar,
    language,
    loading,
    categories,
    setCategories,
    setDrinks,
    setLoading,
    setError,
    apiCall,
  } = useApp();

  const t: T = useTranslation(language);
  const isEditing = drink !== null;

  const [form, setForm] = useState(() => ({
    title: drink?.title ?? "",
    baseSpirit: drink?.base_spirit ?? "",
    categoryId: drink?.category_id ? String(drink.category_id) : "",
    recipe: drink?.recipe ?? "",
    guestDescription: drink?.guest_description ?? "",
    showRecipeToGuests: drink?.show_recipe_to_guests === 1,
    inStock: drink === null || drink.in_stock === 1,
    image: {
      url: drink?.image_url ?? "",
      cropX: drink?.image_crop_x ?? 0,
      cropY: drink?.image_crop_y ?? 0,
      zoom: drink?.image_crop_zoom ?? 1,
    } satisfies DrinkImage,
  }));

  // Folded away only where there is no room for it: on a wide screen the
  // recipe sits in its own column, so there is nothing to save by hiding it.
  const [open, setOpen] = useState(() => {
    const wide = window.matchMedia("(min-width: 80rem)").matches;
    return { recipe: isEditing || wide, placement: isEditing || wide };
  });

  const update = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const barId = currentBar?.id;

  const fetchCategories = useCallback(async () => {
    if (!barId) return;
    try {
      setCategories(await apiCall(`/categories/bar/${barId}`));
    } catch (err) {
      console.error("Could not load the categories:", err);
    }
  }, [barId, apiCall, setCategories]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const missing =
      (!form.title.trim() && "Drink title is required") ||
      (!form.recipe.trim() && "Recipe is required");

    if (missing) {
      // Whichever part holds the missing field has to be on screen.
      setOpen({ recipe: true, placement: true });
      setError(missing);
      return;
    }

    setLoading(true);
    try {
      // Adding and changing send the same thing; only where to differs.
      const saved: Drink = await apiCall(
        isEditing ? `/drinks/${drink.id}` : "/drinks",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify({
            barId: currentBar!.id,
            title: form.title.trim(),
            imageUrl: form.image.url.trim() || null,
            recipe: form.recipe.trim(),
            baseSpirit: form.baseSpirit.trim(),
            guestDescription: form.guestDescription.trim() || null,
            showRecipeToGuests: form.showRecipeToGuests,
            inStock: form.inStock,
            categoryId: form.categoryId || null,
            imageCropX: form.image.cropX,
            imageCropY: form.image.cropY,
            imageCropZoom: form.image.zoom,
          }),
        }
      );

      setDrinks((prev) =>
        isEditing
          ? prev.map((d) => (d.id === drink.id ? saved : d))
          : [...prev, saved]
      );

      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save drink");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !confirm(t("confirmDeleteDrink"))) return;

    setLoading(true);
    try {
      await apiCall(`/drinks/${drink.id}`, {
        method: "DELETE",
        body: JSON.stringify({ barId: currentBar!.id }),
      });

      setDrinks((prev) => prev.filter((d) => d.id !== drink.id));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete drink");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-160 xl:max-w-none bg-surface border border-border rounded-md overflow-hidden"
    >
      {/* The way out is a labelled step back, not a cross. */}
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-3.5">
        <button
          type="button"
          onClick={onDone}
          className="h-14 pl-3 pr-4 flex items-center gap-2 rounded-md border border-border bg-surface-raised text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
        >
          <ChevronLeft className="w-4.5 h-4.5" />
          {t("drinkMenu")}
        </button>
        <h2
          className={`flex-1 min-w-0 truncate text-display ${
            form.title.trim() ? "" : "text-text-muted"
          }`}
        >
          {form.title.trim() || t("newDrink")}
        </h2>
      </div>

      {/* The recipe is the one field that grows, so on a wide screen it
          takes a column of its own and the short fields keep their 640 —
          which is the width they are legible at, wide screen or not. */}
      <div className="xl:flex xl:items-stretch">
        <div className="xl:w-160 xl:shrink-0 xl:border-r xl:border-border">
          <Section
            kicker={t("sectionGuestSees")}
            marker={t("oneRequiredSection")}
            open
            onOpen={() => {}}
          >
            <Field label={t("drinkName")}>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder={t("drinkNamePlaceholder")}
                className={INPUT}
                required
              />
            </Field>

            <Field
              label={t("guestDescription")}
              hint={t("guestDescriptionHelp")}
            >
              <textarea
                value={form.guestDescription}
                onChange={(e) => update({ guestDescription: e.target.value })}
                rows={3}
                placeholder={t("guestDescriptionPrompt")}
                className="min-h-21 p-3.5 rounded-md border border-border bg-surface-raised text-body resize-y focus:outline-none focus:border-border-strong focus:shadow-focus"
              />
            </Field>

            <DrinkImageField
              value={form.image}
              onChange={(image) => update({ image })}
              loading={loading}
              setLoading={setLoading}
              t={t}
            />
          </Section>

          <div className="h-px bg-border" />

          <Section
            kicker={t("sectionPlacement")}
            marker={t("optionalSection")}
            open={open.placement}
            onOpen={() => setOpen((prev) => ({ ...prev, placement: true }))}
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t("categories")}>
                <select
                  value={form.categoryId}
                  onChange={(e) => update({ categoryId: e.target.value })}
                  className={INPUT}
                >
                  <option value="">{t("noCategory")}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("baseSpirit")}>
                <select
                  value={form.baseSpirit}
                  onChange={(e) => update({ baseSpirit: e.target.value })}
                  className={INPUT}
                >
                  <option value="">{t("selectBaseSpirit")}</option>
                  {BASE_SPIRITS.map((spirit) => (
                    <option key={spirit} value={spirit}>
                      {spirit}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <ToggleRow
              on={form.inStock}
              onChange={(inStock) => update({ inStock })}
              title={t("inStock")}
              help={t("inStockHelp")}
            />

            {/* Down here, where a hand on the way to Save cannot reach it. */}
            {isEditing && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="h-11 px-3.5 -ml-3.5 rounded-md text-label text-danger transition-colors duration-(--duration-instant) hover:bg-status-rejected-bg disabled:opacity-50 cursor-pointer"
                >
                  {t("deleteThisDrink")}
                </button>
              </div>
            )}
          </Section>
        </div>

        <div className="flex-1 min-w-0 border-t border-border xl:border-t-0">
          <Section
            kicker={t("sectionRecipe")}
            marker={t("oneRequiredSection")}
            open={open.recipe}
            onOpen={() => setOpen((prev) => ({ ...prev, recipe: true }))}
          >
            <LazyMDEditor
              value={form.recipe}
              onChange={(value) => update({ recipe: value || "" })}
              height={300}
              textareaProps={{
                placeholder: "## Ingredients\n- 3 cl …\n\n## Method\n1. …",
              }}
            />

            <ToggleRow
              on={form.showRecipeToGuests}
              onChange={(showRecipeToGuests) => update({ showRecipeToGuests })}
              title={t("showRecipeToGuests")}
              help={t("showRecipeHelp")}
            />
          </Section>
        </div>
      </div>

      <div className="lg:sticky lg:bottom-0 px-5 py-3 border-t border-border bg-surface-sunken flex items-center gap-3">
        <button
          type="button"
          onClick={onDone}
          className="h-14 px-4 rounded-md text-label text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
        >
          {t("cancel")}
        </button>
        <span className="flex-1" />
        <button
          type="submit"
          disabled={loading || !form.title.trim() || !form.recipe.trim()}
          className="h-16 px-7 rounded-md bg-text text-text-inverse text-heading transition-colors duration-(--duration-instant) hover:bg-neutral-800 disabled:bg-disabled-bg disabled:text-disabled-fg disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? t("loading") : t("saveDrink")}
        </button>
      </div>
    </form>
  );
};

/**
 * The form is a screen with its own address, so the browser's back button
 * works and the queue count behind it never goes away.
 */
const DrinkFormRoute: React.FC = () => {
  const { drinkId } = useParams<{ drinkId: string }>();
  const { drinks, language } = useApp();
  const t = useTranslation(language);
  const navigate = useNavigate();

  const backToMenu = useCallback(
    () => navigate("/bartender/menu"),
    [navigate]
  );

  if (drinkId === "new") {
    return <DrinkForm drink={null} onDone={backToMenu} />;
  }

  const drink = drinks.find((d) => String(d.id) === drinkId);

  if (!drink) {
    // The drinks arrive a moment after the shell mounts on a fresh load.
    return <p className="text-body text-text-muted">{t("loading")}</p>;
  }

  return <DrinkForm key={drink.id} drink={drink} onDone={backToMenu} />;
};

export default DrinkFormRoute;
