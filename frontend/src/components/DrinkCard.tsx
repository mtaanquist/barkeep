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

  // A guest who cannot order should be able to see why without tapping.
  const orderLabel = loading
    ? t("loading")
    : disabled
      ? t("oneOrderLimit")
      : t("order");

  return (
    <article className="flex flex-col bg-surface-raised border border-border rounded-md overflow-hidden">
      {drink.image_url ? (
        <div className="h-49 border-b border-border overflow-hidden relative">
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
      ) : (
        /* No photo is a look of its own, so a half-photographed menu still
           reads as one grid. */
        <div
          className="h-28 px-3.5 flex items-center bg-surface-sunken border-b border-border overflow-hidden"
          aria-hidden="true"
        >
          <span className="text-display">{drink.title}</span>
        </div>
      )}

      <div className="flex-1 px-3.5 py-3 flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-heading break-words">{drink.title}</h3>
          {onToggleFavourite && (
            <button
              onClick={() => onToggleFavourite(drink)}
              className={`-mt-2.5 -mr-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-md transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer ${
                drink.is_favourite ? "text-text" : "text-text-muted"
              }`}
              title={
                drink.is_favourite
                  ? t("removeFavourite")
                  : t("addFavourite")
              }
            >
              <Star
                className={`w-5 h-5 ${drink.is_favourite ? "fill-current" : ""}`}
              />
            </button>
          )}
        </div>

        {drink.guest_description && (
          <p className="text-body text-text-muted">{drink.guest_description}</p>
        )}
      </div>

      <div className="flex border-t border-border">
        {/* Only show view recipe button if recipe is available to guests */}
        {drink.recipe && (
          <button
            onClick={() => onViewRecipe(drink)}
            className="w-33 h-16 shrink-0 border-r border-border text-label text-text transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
          >
            {t("viewRecipe")}
          </button>
        )}
        <button
          onClick={() => onOrder(drink)}
          disabled={disabled || loading}
          className={`flex-1 h-16 px-3 transition-colors duration-(--duration-instant) ${
            disabled || loading
              ? "bg-disabled-bg text-disabled-fg text-label cursor-not-allowed"
              : "bg-accent text-accent-contrast text-heading hover:bg-accent-hover cursor-pointer"
          }`}
        >
          {orderLabel}
        </button>
      </div>
    </article>
  );
};

export default DrinkCard;
