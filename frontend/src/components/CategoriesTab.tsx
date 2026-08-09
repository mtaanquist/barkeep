import React, { useCallback, useEffect, useState } from "react";
import { Plus, Edit3, Trash2, Tag } from "lucide-react";
import { useApp } from "../hooks/useApp";
import type { Category } from "../types";
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

  const barId = currentBar?.id;

  const fetchCategories = useCallback(async () => {
    if (!barId) return;
    try {
      setCategories(await apiCall<Category[]>(`/categories/bar/${barId}`));
    } catch (err) {
      console.error("Could not load the categories:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch categories"
      );
    }
  }, [barId, apiCall, setCategories, setError]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentBar || !newCategoryName.trim()) return;

    setLoading(true);
    try {
      const newCategory = await apiCall<Category>("/categories", {
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
      const updatedCategory = await apiCall<Category>(`/categories/${category.id}`, {
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
      <div className="bg-surface-raised rounded-md border p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold text-text">
              {t("categories")}
            </h3>
            <p className="text-sm text-text-muted">
              {t("categoriesHelp")}
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-text text-text-inverse px-4 py-2 rounded-md hover:bg-neutral-800 transition-colors flex items-center space-x-2 w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            <span>{t("addCategory")}</span>
          </button>
        </div>
      </div>

      {/* Create Category Form */}
      {showCreateForm && (
        <div className="bg-surface-raised rounded-md border p-4">
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                {t("categoryName")}
              </label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Summer Drinks, Bartender's Favorites"
                className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
                required
                autoFocus
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={loading || !newCategoryName.trim()}
                className="bg-text text-text-inverse px-4 py-2 rounded-md hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Category"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewCategoryName("");
                }}
                className="bg-surface-sunken text-text px-4 py-2 rounded-md hover:bg-border transition-colors"
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories List */}
      {categories.length === 0 ? (
        <div className="bg-surface-raised rounded-md border p-8 text-center">
          <Tag className="w-16 h-16 mx-auto mb-4 text-text-muted" />
          <h3 className="text-lg font-medium text-text mb-2">
            {t("noCategories")}
          </h3>
          <p className="text-text-muted mb-4">
            {t("noCategoriesHelp")}
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-text text-text-inverse px-6 py-2 rounded-md hover:bg-neutral-800 transition-colors inline-flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t("addCategory")}</span>
          </button>
        </div>
      ) : (
        <div className="bg-surface-raised rounded-md border overflow-hidden">
          <div className="grid grid-cols-1 divide-y divide-border">
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
                      <div className="p-2 bg-surface-sunken rounded-md">
                        <Tag className="w-5 h-5 text-text-muted" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-text">
                          {category.name}
                        </h4>
                        <p className="text-sm text-text-muted">
                          Created {new Date(category.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingCategory(category)}
                        className="p-2 text-text-muted hover:text-text-muted transition-colors"
                        title={t("editCategory")}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category)}
                        disabled={loading}
                        className="p-2 text-text-muted hover:text-danger transition-colors disabled:opacity-50"
                        title={t("deleteCategory")}
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
          className="w-full p-2 border border-border rounded-md focus:ring-2 focus:border-transparent"
          required
          autoFocus
        />
      </div>
      <div className="flex space-x-2">
        <button
          type="submit"
          disabled={loading || !name.trim() || name.trim() === category.name}
          className="bg-text text-text-inverse px-3 py-1.5 rounded text-sm hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : t("save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-surface-sunken text-text px-3 py-1.5 rounded text-sm hover:bg-border transition-colors"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
};

export default CategoriesTab;
