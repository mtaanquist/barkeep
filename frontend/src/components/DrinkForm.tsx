import React, { useState, useEffect } from "react";
import { X, Upload, Crop } from "lucide-react";
import { useApp, Drink } from "../context/AppContext";
import { useTranslation } from "../utils/translations";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import LazyMDEditor from "./LazyMDEditor";
import ImageCropper from "./ImageCropper";

interface DrinkFormProps {
  drink: Drink | {};
  onClose: () => void;
}

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
  const isEditing = "id" in drink && drink.id;

  const [formData, setFormData] = useState({
    title: "title" in drink ? drink.title || "" : "",
    image: "image_url" in drink ? drink.image_url || "" : "",
    recipe: "recipe" in drink ? drink.recipe || "" : "",
    baseSpirit: "base_spirit" in drink ? drink.base_spirit || "" : "",
    guestDescription: "guest_description" in drink ? drink.guest_description || "" : "",
    showRecipeToGuests: "show_recipe_to_guests" in drink ? drink.show_recipe_to_guests || false : false,
    categoryId: "category_id" in drink ? drink.category_id || "" : "",
    imageCropX: "image_crop_x" in drink ? drink.image_crop_x || 0 : 0,
    imageCropY: "image_crop_y" in drink ? drink.image_crop_y || 0 : 0,
    imageCropZoom: "image_crop_zoom" in drink ? drink.image_crop_zoom || 1 : 1,
  });

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);

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
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size must be less than 5MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are allowed");
      return;
    }

    setUploadError(null);
    const uploadFormData = new FormData();
    uploadFormData.append("image", file);

    try {
      setLoading(true);
      const response = await fetch("/api/drinks/upload-image", {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setFormData((prev) => ({ ...prev, image: data.imageUrl }));
    } catch (err) {
      setUploadError("Failed to upload image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError("Drink title is required");
      return;
    }

    if (!formData.recipe.trim()) {
      setError("Recipe is required");
      return;
    }

    if (!formData.baseSpirit.trim()) {
      setError("Base spirit is required");
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        // Update existing drink
        const updatedDrink = await apiCall(`/drinks/${drink.id}`, {
          method: "PUT",
          body: JSON.stringify({
            barId: currentBar!.id,
            title: formData.title.trim(),
            imageUrl: formData.image.trim() || null,
            recipe: formData.recipe.trim(),
            baseSpirit: formData.baseSpirit.trim(),
            guestDescription: formData.guestDescription.trim() || null,
            showRecipeToGuests: formData.showRecipeToGuests,
            categoryId: formData.categoryId || null,
            imageCropX: formData.imageCropX,
            imageCropY: formData.imageCropY,
            imageCropZoom: formData.imageCropZoom,
          }),
        });

        setDrinks((prev) =>
          prev.map((d) => (d.id === drink.id ? updatedDrink : d))
        );
      } else {
        // Create new drink
        const newDrink = await apiCall("/drinks", {
          method: "POST",
          body: JSON.stringify({
            barId: currentBar!.id,
            title: formData.title.trim(),
            imageUrl: formData.image.trim() || null,
            recipe: formData.recipe.trim(),
            baseSpirit: formData.baseSpirit.trim(),
            guestDescription: formData.guestDescription.trim() || null,
            showRecipeToGuests: formData.showRecipeToGuests,
            categoryId: formData.categoryId || null,
            imageCropX: formData.imageCropX,
            imageCropY: formData.imageCropY,
            imageCropZoom: formData.imageCropZoom,
          }),
        });

        setDrinks((prev) => [...prev, newDrink]);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save drink");
    } finally {
      setLoading(false);
    }
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
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

        {/* Content */}
        <div className="flex flex-col lg:flex-row max-h-[calc(90vh-180px)]">
          {/* Form Side */}
          <div className="flex-1 p-6 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("drinkTitle")} *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="e.g., Old Fashioned"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Base Spirit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base Spirit *
                </label>
                <select
                  value={formData.baseSpirit}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      baseSpirit: e.target.value,
                    }))
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select base spirit</option>
                  <option value="Vodka">Vodka</option>
                  <option value="Gin">Gin</option>
                  <option value="Rum">Rum</option>
                  <option value="Tequila">Tequila</option>
                  <option value="Whisky/Whiskey">Whisky/Whiskey</option>
                  <option value="Brandy/Cognac">Brandy/Cognac</option>
                  <option value="Liqueur">Liqueur</option>
                  <option value="Non-alcoholic">Non-alcoholic</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      categoryId: e.target.value,
                    }))
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("drinkImage")}
                </label>

                {/* Upload Area */}
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-gray-500" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">
                            {t("uploadImage")}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          PNG, JPG, GIF up to 5MB
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/png, image/jpeg, image/jpg, image/gif, image/webp, image/avif, image/svg+xml, image/bmp, image/tiff, image/x-icon, image/heic, image/heif, image/*"
                        onChange={handleImageUpload}
                        disabled={loading}
                      />
                    </label>
                  </div>

                  {uploadError && (
                    <p className="text-sm text-red-600">{uploadError}</p>
                  )}

                  <div className="text-center text-gray-500 text-sm">
                    {t("or")}
                  </div>

                  <input
                    type="url"
                    value={formData.image}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        image: e.target.value,
                      }))
                    }
                    placeholder="https://example.com/image.jpg"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  {/* Image Preview */}
                  {formData.image && (
                    <div className="mt-4 space-y-2">
                      <div className="relative w-full rounded-lg overflow-hidden bg-gray-100" style={{ aspectRatio: '16/9' }}>
                        <div
                          className="absolute inset-0"
                          style={{
                            transform: `translate(${formData.imageCropX}%, ${formData.imageCropY}%) scale(${formData.imageCropZoom})`,
                            transformOrigin: 'center center',
                          }}
                        >
                          <img
                            src={formData.image}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCropper(true)}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Crop className="w-4 h-4" />
                        <span>Crop & Position</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Image Cropper Modal */}
              {showCropper && formData.image && (
                <ImageCropper
                  imageUrl={formData.image}
                  initialCrop={{ x: formData.imageCropX, y: formData.imageCropY }}
                  initialZoom={formData.imageCropZoom}
                  onSave={(crop, zoom) => {
                    setFormData((prev) => ({
                      ...prev,
                      imageCropX: crop.x,
                      imageCropY: crop.y,
                      imageCropZoom: zoom,
                    }));
                    setShowCropper(false);
                  }}
                  onCancel={() => setShowCropper(false)}
                />
              )}

              {/* Recipe */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("recipe")} *
                </label>
                <div className="relative">
                  <LazyMDEditor
                    value={formData.recipe}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        recipe: value || "",
                      }))
                    }
                    height={300}
                    textareaProps={{
                      placeholder:
                        "## Drink Name\n\n**Ingredients:**\n- 2 oz Spirit\n- 1 oz Mixer\n- Garnish\n\n**Instructions:**\n1. Step 1\n2. Step 2\n3. Serve and enjoy!",
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Use Markdown formatting for better presentation
                </p>
              </div>

              {/* Guest Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("guestDescription")}
                </label>
                <textarea
                  value={formData.guestDescription}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      guestDescription: e.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Optional description shown to guests..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t("guestDescriptionHelp")}
                </p>
              </div>

              {/* Show Recipe to Guests Toggle */}
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={formData.showRecipeToGuests}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        showRecipeToGuests: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      {t("showRecipeToGuests")}
                    </span>
                    <p className="text-xs text-gray-500">
                      {t("showRecipeHelp")}
                    </p>
                  </div>
                </label>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
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
            disabled={
              loading || !formData.title.trim() || !formData.recipe.trim()
            }
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
