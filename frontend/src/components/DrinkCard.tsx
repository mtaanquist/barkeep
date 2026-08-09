import React from "react";
import { Star } from "lucide-react";
import type { Drink } from "../types";
import { translations } from "../utils/translations";

interface DrinkCardProps {
  drink: Drink;
  onViewRecipe: (drink: Drink) => void;
  onOrder: (drink: Drink) => void;
  onToggleFavourite?: (drink: Drink) => void;
  disabled: boolean;
  loading: boolean;
  t: (key: keyof typeof translations.en) => string;
}

const DrinkCard: React.FC<DrinkCardProps> = ({
  drink,
  onViewRecipe,
  onOrder,
  onToggleFavourite,
  disabled,
  loading,
  t,
}) => {
  // Calculate image styles with crop parameters
  const imageCropX = drink.image_crop_x || 0;
  const imageCropY = drink.image_crop_y || 0;
  const imageCropZoom = drink.image_crop_zoom || 1;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md dark:hover:shadow-gray-900/20 transition-shadow">
      {drink.image_url && (
        <div className="aspect-video overflow-hidden bg-gray-100 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={drink.image_url}
              alt={drink.title}
              className="w-full h-full object-contain"
              style={{
                transform: `translate(${imageCropX}%, ${imageCropY}%) scale(${imageCropZoom})`,
              }}
            />
          </div>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-800 dark:text-white flex-1">{drink.title}</h3>
          {onToggleFavourite && (
            <button
              onClick={() => onToggleFavourite(drink)}
              className="ml-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={drink.is_favourite ? "Remove from favourites" : "Add to favourites"}
            >
              <Star 
                className={`w-5 h-5 transition-colors ${
                  drink.is_favourite 
                    ? "text-yellow-500 fill-yellow-500" 
                    : "text-gray-400 hover:text-yellow-500"
                }`}
              />
            </button>
          )}
        </div>
        
        {/* Show guest description if available */}
        {drink.guest_description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{drink.guest_description}</p>
        )}
        
        <div className="flex flex-col space-y-2">
          {/* Only show view recipe button if recipe is available to guests */}
          {drink.recipe && (
            <button
              onClick={() => onViewRecipe(drink)}
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-3 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t("viewRecipe")}
            </button>
          )}
          <button
            onClick={() => onOrder(drink)}
            disabled={disabled || loading}
            className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              disabled || loading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {loading ? t("loading") : t("order")}
          </button>
        </div>
      </div>
      <div
        className="prose prose-sm text-gray-800 max-w-none"
        style={{
          // Force readable text color for markdown output
          ["--color-fg-default" as any]: "#222",
        }}
      >
        {/* Rendered markdown content here */}
      </div>
    </div>
  );
};

export default DrinkCard;
