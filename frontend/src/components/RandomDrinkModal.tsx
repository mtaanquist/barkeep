import React from "react";
import type { Drink } from "../types";
import { translations } from "../utils/translations";

interface RandomDrinkModalProps {
  drink: Drink;
  visible: boolean;
  onOrder: () => void;
  onTryAnother: () => void;
  onCancel: () => void;
  loading: boolean;
  /** The guest may only have one drink on the go at a time. */
  hasOrderInProgress: boolean;
  t: (key: keyof typeof translations.en) => string;
}

const RandomDrinkModal: React.FC<RandomDrinkModalProps> = ({
  drink,
  visible,
  onOrder,
  onTryAnother,
  onCancel,
  loading,
  hasOrderInProgress,
  t,
}) => {
  if (!visible || !drink) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
        <div className="mb-4">
          <div className="text-4xl mb-2">🍹</div>
          <h2 className="text-xl font-bold mb-2">{t("yourRandomDrink")}</h2>
          <h3 className="text-lg font-semibold text-blue-700 mb-2">
            {drink.title}
          </h3>
          {drink.image_url && (
            <div className="mx-auto mb-2 rounded-lg overflow-hidden max-h-40 aspect-video relative">
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
            </div>
          )}
          <div className="text-sm text-gray-700 mb-2">
            {drink.base_spirit && (
              <span className="font-medium">
                {t("baseSpirit")}: {drink.base_spirit}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onOrder}
            disabled={hasOrderInProgress || loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t("loading") : t("orderThis")}
          </button>
          <button
            onClick={onTryAnother}
            className="w-full px-4 py-2 bg-gray-100 text-gray-800 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            {t("tryAnother")}
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 bg-white text-gray-500 rounded-lg font-medium border hover:bg-gray-50 transition-colors"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RandomDrinkModal;
