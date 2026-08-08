import React, { useState, useEffect } from "react";
import { Plus, Edit3, Trash2, Tag } from "lucide-react";
import { useApp, Category } from "../context/AppContext";
import { useTranslation } from "../utils/translations";

const CategoriesTab: React.FC = () => {
  const {
    currentBar,
    language,
    loading,
    categories,
    setCategories,
    setLoading,
    setError,
    apiCall,
  } = useApp();

  const t = useTranslation(language);
  // TODO: Add translation keys for categories functionality

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Fetch categories when component mounts
  useEffect(() => {
    if (currentBar) {
      fetchCategories();
    }
  }, [currentBar]);

  const fetchCategories = async () => {
    if (!currentBar) return;
    try {
      const data = await apiCall(`/categories/bar/${currentBar.id}`);
      setCategories(data);
    } catch (err) {
      console.error("Error fetching categories:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch categories");
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentBar || !newCategoryName.trim()) return;

    setLoading(true);
    try {
      const newCategory = await apiCall("/categories", {
        method: "POST",
        body: JSON.stringify({
          barId: currentBar.id,
          name: newCategoryName.trim(),
        }),
      });

      setCategories((prev) => [...prev, newCategory]);
      setNewCategoryName("");
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (category: Category, newName: string) => {
    if (!currentBar || !newName.trim()) return;

    setLoading(true);
    try {
      const updatedCategory = await apiCall(`/categories/${category.id}`, {
        method: "PUT",
        body: JSON.stringify({
          barId: currentBar.id,
          name: newName.trim(),
        }),
      });

      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? updatedCategory : c))
      );
      setEditingCategory(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!currentBar) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the category "${category.name}"? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await apiCall(`/categories/${category.id}`, {
        method: "DELETE",
        body: JSON.stringify({ barId: currentBar.id }),
      });

      setCategories((prev) => prev.filter((c) => c.id !== category.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Drink Categories
            </h3>
            <p className="text-sm text-gray-600">
              Create and manage categories to organize your drinks
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Create Category Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category Name
              </label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Summer Drinks, Bartender's Favorites"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                autoFocus
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={loading || !newCategoryName.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Category"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewCategoryName("");
                }}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories List */}
      {categories.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <Tag className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No categories yet
          </h3>
          <p className="text-gray-600 mb-4">
            Create your first category to start organizing your drinks
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="grid grid-cols-1 divide-y divide-gray-200">
            {categories.map((category) => (
              <div key={category.id} className="p-4">
                {editingCategory?.id === category.id ? (
                  <EditCategoryForm
                    category={category}
                    onSave={(newName) => handleUpdateCategory(category, newName)}
                    onCancel={() => setEditingCategory(null)}
                    loading={loading}
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Tag className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">
                          {category.name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          Created {new Date(category.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingCategory(category)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Edit category"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category)}
                        disabled={loading}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// EditCategoryForm component
interface EditCategoryFormProps {
  category: Category;
  onSave: (newName: string) => void;
  onCancel: () => void;
  loading: boolean;
}

const EditCategoryForm: React.FC<EditCategoryFormProps> = ({
  category,
  onSave,
  onCancel,
  loading,
}) => {
  const [name, setName] = useState(category.name);
  const { language } = useApp();
  const t = useTranslation(language);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
          autoFocus
        />
      </div>
      <div className="flex space-x-2">
        <button
          type="submit"
          disabled={loading || !name.trim() || name.trim() === category.name}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : t("save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-200 transition-colors"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
};

export default CategoriesTab;
