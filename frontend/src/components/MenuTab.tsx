import React from "react";
import { Plus, Edit3, Trash2, Package, PackageX, Eye } from "lucide-react";
import { useApp } from "../context/AppContext";
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
          drink.id === id ? { ...drink, in_stock: !drink.in_stock } : drink
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
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              {t("drinkMenu")}
            </h3>
            <p className="text-sm text-gray-600">
              {drinks.length} total drinks • {inStockDrinks.length} in stock •{" "}
              {outOfStockDrinks.length} out of stock
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "alphabetical" | "category" | "default")}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="default">Sort: Default</option>
              <option value="alphabetical">Sort: Alphabetical</option>
              <option value="category">Sort: Category</option>
            </select>
            <button
              onClick={() => setEditingDrink({})}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>{t("addDrink")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Drinks Grid */}
      {drinks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No drinks yet
          </h3>
          <p className="text-gray-600 mb-4">
            Start building your menu by adding your first drink
          </p>
          <button
            onClick={() => setEditingDrink({})}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
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
              className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Image */}
              <div className="aspect-video overflow-hidden bg-gray-100">
                {drink.image_url ? (
                  <div
                    className="w-full h-full"
                    style={{
                      transform: `translate(${drink.image_crop_x || 0}%, ${drink.image_crop_y || 0}%) scale(${drink.image_crop_zoom || 1})`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <img
                      src={drink.image_url}
                      alt={drink.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Package className="w-12 h-12" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-gray-800 truncate pr-2">
                    {drink.title}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs rounded-full flex-shrink-0 ${
                      drink.in_stock
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {drink.in_stock ? t("inStock") : t("outOfStock")}
                  </span>
                </div>

                {/* Recipe Preview */}
                <div className="mb-4 line-clamp-2 prose max-w-none prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-900 prose-em:text-gray-700">
                  <LazyMarkdownViewer
                    source={drink.recipe}
                    style={{ background: "none", padding: 0, margin: 0 }}
                  />
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  {/* Top Row - Primary Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setEditingDrink(drink)}
                      className="flex-1 bg-blue-100 text-blue-700 py-2 px-3 rounded-lg text-sm hover:bg-blue-200 transition-colors flex items-center justify-center space-x-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setViewingRecipe(drink)}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 px-3 rounded-lg text-sm hover:bg-gray-200 transition-colors flex items-center justify-center space-x-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View</span>
                    </button>
                  </div>

                  {/* Bottom Row - Secondary Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => toggleDrinkStock(drink.id)}
                      disabled={loading}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center space-x-1 ${
                        drink.in_stock
                          ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}
                    >
                      {drink.in_stock ? (
                        <>
                          <PackageX className="w-3 h-3" />
                          <span>Out of Stock</span>
                        </>
                      ) : (
                        <>
                          <Package className="w-3 h-3" />
                          <span>In Stock</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteDrink(drink.id, drink.title)}
                      disabled={loading}
                      className="bg-red-100 text-red-700 py-2 px-3 rounded-lg text-sm hover:bg-red-200 transition-colors disabled:opacity-50"
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
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">
                  Total Drinks
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {drinks.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">In Stock</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inStockDrinks.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <PackageX className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">
                  Out of Stock
                </p>
                <p className="text-2xl font-bold text-gray-900">
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
