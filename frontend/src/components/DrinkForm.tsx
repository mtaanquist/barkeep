import React, { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { Drink } from "../types";
import { useTranslation } from "../utils/translations";
import { BASE_SPIRITS } from "../utils/spirits";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import LazyMDEditor from "./LazyMDEditor";
import DrinkImageField, { type DrinkImage } from "./drinkForm/DrinkImageField";

interface DrinkFormProps {
  /** The drink being changed, or nothing when adding one. */
  drink: Drink | null;
  onClose: () => void;
}

const INPUT =
  "w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent";

/** A labelled row, with an optional note underneath. */
const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label}
    </label>
    {children}
    {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
  </div>
);

const DrinkForm: React.FC<DrinkFormProps> = ({ drink, onClose }) => {
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

  const t = useTranslation(language);
  const isEditing = drink !== null;

  const [form, setForm] = useState(() => ({
    title: drink?.title ?? "",
    baseSpirit: drink?.base_spirit ?? "",
    categoryId: drink?.category_id ? String(drink.category_id) : "",
    recipe: drink?.recipe ?? "",
    guestDescription: drink?.guest_description ?? "",
    showRecipeToGuests: drink?.show_recipe_to_guests === 1,
    image: {
      url: drink?.image_url ?? "",
      cropX: drink?.image_crop_x ?? 0,
      cropY: drink?.image_crop_y ?? 0,
      zoom: drink?.image_crop_zoom ?? 1,
    } satisfies DrinkImage,
  }));

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

  // Escape closes the form.
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const missing =
      (!form.title.trim() && "Drink title is required") ||
      (!form.recipe.trim() && "Recipe is required") ||
      (!form.baseSpirit.trim() && "Base spirit is required");

    if (missing) {
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

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save drink");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">
            {isEditing ? t("editDrink") : t("addDrink")}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row max-h-[calc(90vh-180px)]">
          <div className="flex-1 p-6 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              <Field label={`${t("drinkTitle")} *`}>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => update({ title: e.target.value })}
                  placeholder="e.g., Old Fashioned"
                  className={INPUT}
                  required
                />
              </Field>

              <Field label="Base Spirit *">
                <select
                  value={form.baseSpirit}
                  onChange={(e) => update({ baseSpirit: e.target.value })}
                  className={INPUT}
                  required
                >
                  <option value="">Select base spirit</option>
                  {BASE_SPIRITS.map((spirit) => (
                    <option key={spirit} value={spirit}>
                      {spirit}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Category">
                <select
                  value={form.categoryId}
                  onChange={(e) => update({ categoryId: e.target.value })}
                  className={INPUT}
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>

              <DrinkImageField
                value={form.image}
                onChange={(image) => update({ image })}
                loading={loading}
                setLoading={setLoading}
                t={t}
              />

              <Field
                label={`${t("recipe")} *`}
                hint="Use Markdown formatting for better presentation"
              >
                <LazyMDEditor
                  value={form.recipe}
                  onChange={(value) => update({ recipe: value || "" })}
                  height={300}
                  textareaProps={{
                    placeholder:
                      "## Drink Name\n\n**Ingredients:**\n- 2 oz Spirit\n- 1 oz Mixer\n- Garnish\n\n**Instructions:**\n1. Step 1\n2. Step 2\n3. Serve and enjoy!",
                  }}
                />
              </Field>

              <Field
                label={t("guestDescription")}
                hint={t("guestDescriptionHelp")}
              >
                <textarea
                  value={form.guestDescription}
                  onChange={(e) => update({ guestDescription: e.target.value })}
                  rows={4}
                  placeholder="Optional description shown to guests..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                />
              </Field>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={form.showRecipeToGuests}
                  onChange={(e) =>
                    update({ showRecipeToGuests: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    {t("showRecipeToGuests")}
                  </span>
                  <p className="text-xs text-gray-500">{t("showRecipeHelp")}</p>
                </div>
              </label>
            </form>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-4 p-6 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.title.trim() || !form.recipe.trim()}
            className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t("loading") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrinkForm;
