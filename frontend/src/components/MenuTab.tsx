import React from "react";
import { Plus, Edit3, Trash2, Package, PackageX, Eye } from "lucide-react";
import { useApp } from "../hooks/useApp";
import { useTranslation } from "../utils/translations";
import { LazyMarkdownViewer } from "./LazyMDEditor";

const MenuTab: React.FC = () => {
  const {
    currentBar,
    language,
    loading,
    drinks,
    setDrinks,
    setEditingDrink,
    setViewingRecipe,
    setLoading,
    setError,
    apiCall,
  } = useApp();

  const t = useTranslation(language);

  // Sorting state
  const [sortBy, setSortBy] = React.useState<"alphabetical" | "category" | "default">("default");

  const handleDeleteDrink = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

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

  const toggleDrinkStock = async (id: number) => {
    setLoading(true);
    try {
      await apiCall(`/drinks/${id}/stock`, {
        method: "PATCH",
        body: JSON.stringify({ barId: currentBar!.id }),
      });

      setDrinks((prev) =>
        prev.map((drink) =>
          drink.id === id ? { ...drink, in_stock: drink.in_stock ? 0 : 1 } : drink
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle stock");
    } finally {
      setLoading(false);
    }
  };

  const inStockDrinks = drinks.filter((drink) => drink.in_stock);
  const outOfStockDrinks = drinks.filter((drink) => !drink.in_stock);

  // Sort drinks based on selected sort option
  const getSortedDrinks = () => {
    const drinksCopy = [...drinks];
    
    if (sortBy === "alphabetical") {
      return drinksCopy.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "category") {
      return drinksCopy.sort((a, b) => {
        // First sort by category, then by title within category
        const categoryA = a.category_name || "Uncategorized";
        const categoryB = b.category_name || "Uncategorized";
        const categoryCompare = categoryA.localeCompare(categoryB);
        if (categoryCompare !== 0) return categoryCompare;
        return a.title.localeCompare(b.title);
      });
    }
    
    // Default: return as-is (database order)
    return drinksCopy;
  };
  
  const sortedDrinks = getSortedDrinks();

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="bg-surface-raised rounded-md border p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold text-text">
              {t("drinkMenu")}
            </h3>
            <p className="text-sm text-text-muted">
              {drinks.length} total drinks • {inStockDrinks.length} in stock •{" "}
              {outOfStockDrinks.length} out of stock
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "alphabetical" | "category" | "default")}
              className="px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:border-transparent"
            >
              <option value="default">{t("sortDefault")}</option>
              <option value="alphabetical">{t("sortAlphabetical")}</option>
              <option value="category">{t("sortCategory")}</option>
            </select>
            <button
              onClick={() => setEditingDrink("new")}
              className="bg-text text-text-inverse px-4 py-2 rounded-md hover:bg-neutral-800 transition-colors flex items-center space-x-2 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>{t("addDrink")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Drinks Grid */}
      {drinks.length === 0 ? (
        <div className="bg-surface-raised rounded-md border p-8 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-text-muted" />
          <h3 className="text-lg font-medium text-text mb-2">
            {t("noDrinks")}
          </h3>
          <p className="text-text-muted mb-4">
            {t("noDrinksHelp")}
          </p>
          <button
            onClick={() => setEditingDrink("new")}
            className="bg-text text-text-inverse px-6 py-2 rounded-md hover:bg-neutral-800 transition-colors inline-flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t("addDrink")}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedDrinks.map((drink) => (
            <div
              key={drink.id}
              className="bg-surface-raised rounded-md border overflow-hidden hover:shadow-md transition-colors duration-(--duration-instant)"
            >
              {/* Image */}
              <div className="aspect-video overflow-hidden bg-surface-sunken relative">
                {drink.image_url ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src={drink.image_url}
                      alt={drink.title}
                      className="w-full h-full object-contain"
                      style={{
                        transform: `translate(${drink.image_crop_x || 0}%, ${drink.image_crop_y || 0}%) scale(${drink.image_crop_zoom || 1})`,
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted">
                    <Package className="w-12 h-12" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-text truncate pr-2">
                    {drink.title}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs rounded-full flex-shrink-0 ${
                      drink.in_stock
                        ? "bg-surface-sunken text-text"
                        : "bg-status-rejected-bg text-danger"
                    }`}
                  >
                    {drink.in_stock ? t("inStock") : t("outOfStock")}
                  </span>
                </div>

                {/* Recipe Preview */}
                <div className="mb-4 line-clamp-2 prose max-w-none prose-p:text-text prose-li:text-text prose-strong:text-text prose-em:text-text">
                  <LazyMarkdownViewer
                    source={drink.recipe ?? ""}
                    style={{ background: "none", padding: 0, margin: 0 }}
                  />
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  {/* Top Row - Primary Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setEditingDrink(drink)}
                      className="flex-1 bg-surface-sunken text-text py-2 px-3 rounded-md text-sm hover:bg-border transition-colors flex items-center justify-center space-x-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{t("edit")}</span>
                    </button>
                    <button
                      onClick={() => setViewingRecipe(drink)}
                      className="flex-1 bg-surface-sunken text-text py-2 px-3 rounded-md text-sm hover:bg-border transition-colors flex items-center justify-center space-x-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{t("view")}</span>
                    </button>
                  </div>

                  {/* Bottom Row - Secondary Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => toggleDrinkStock(drink.id)}
                      disabled={loading}
                      className={`flex-1 py-2 px-3 rounded-md text-sm transition-colors disabled:opacity-50 flex items-center justify-center space-x-1 ${
                        drink.in_stock
                          ? "bg-surface-sunken text-text-muted hover:bg-border"
                          : "bg-surface-sunken text-text hover:bg-border"
                      }`}
                    >
                      {drink.in_stock ? (
                        <>
                          <PackageX className="w-3 h-3" />
                          <span>{t("outOfStock")}</span>
                        </>
                      ) : (
                        <>
                          <Package className="w-3 h-3" />
                          <span>{t("inStock")}</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteDrink(drink.id, drink.title)}
                      disabled={loading}
                      className="bg-status-rejected-bg text-danger py-2 px-3 rounded-md text-sm hover:bg-status-rejected-bg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      {drinks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface-raised rounded-md border p-4">
            <div className="flex items-center">
              <div className="p-2 bg-surface-sunken rounded-md">
                <Package className="w-6 h-6 text-text-muted" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-text-muted">
                  {t("totalDrinks")}
                </p>
                <p className="text-2xl font-bold text-text">
                  {drinks.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface-raised rounded-md border p-4">
            <div className="flex items-center">
              <div className="p-2 bg-surface-sunken rounded-md">
                <Package className="w-6 h-6 text-text-muted" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-text-muted">{t("inStock")}</p>
                <p className="text-2xl font-bold text-text">
                  {inStockDrinks.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface-raised rounded-md border p-4">
            <div className="flex items-center">
              <div className="p-2 bg-status-rejected-bg rounded-md">
                <PackageX className="w-6 h-6 text-danger" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-text-muted">
                  {t("outOfStock")}
                </p>
                <p className="text-2xl font-bold text-text">
                  {outOfStockDrinks.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuTab;
