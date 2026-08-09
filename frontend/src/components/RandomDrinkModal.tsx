import React from "react";
import { Dices } from "lucide-react";
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

/**
 * What the bar picked. The panel and its buttons are a fixed size on
 * purpose: only the photo, the name and the ingredients change when a
 * guest rolls again, so the third go is as quick to tap as the first.
 */
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
    <div className="fixed inset-0 z-50 bg-overlay flex items-start justify-center p-4 pt-24 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("surpriseMe")}
        className="w-full max-w-md bg-surface-raised border border-border rounded-lg shadow-float overflow-hidden"
      >
        <div className="h-35 bg-surface-sunken border-b border-border">
          {drink.image_url && (
            <img
              src={drink.image_url}
              alt=""
              className="w-full h-full object-cover"
              style={{
                transform: `translate(${drink.image_crop_x || 0}%, ${drink.image_crop_y || 0}%) scale(${drink.image_crop_zoom || 1})`,
              }}
            />
          )}
        </div>

        <div className="px-4.5 pt-4 pb-2 flex flex-col gap-1.5">
          <span className="font-mono text-caption uppercase text-text-muted">
            {t("barChoseForYou")}
          </span>
          {/* Bigger than the same name ever gets on a menu card. */}
          <h2 className="text-display line-clamp-2 min-h-[2.2em]">
            {drink.title}
          </h2>
          <p className="text-body text-text-muted line-clamp-2 min-h-[3em]">
            {drink.guest_description || drink.base_spirit}
          </p>
        </div>

        {/* Ordering sits lowest, where the thumb already is. */}
        <div className="px-4.5 pt-3 pb-4.5 flex flex-col gap-2.5">
          <button
            onClick={onOrder}
            disabled={hasOrderInProgress || loading}
            className="w-full h-16 px-4 rounded-md bg-text text-text-inverse text-heading truncate transition-colors duration-(--duration-instant) hover:bg-neutral-800 disabled:bg-disabled-bg disabled:text-disabled-fg disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? t("loading") : `${t("order")} ${drink.title}`}
          </button>

          {/* Turning the suggestion down is the second most likely thing a
              guest does here, so it is a real button, not a corner case. */}
          <button
            onClick={onTryAnother}
            disabled={loading}
            className="w-full h-14 flex items-center justify-center gap-2.5 rounded-md border border-border-strong bg-surface-raised text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Dices className="w-4.5 h-4.5 shrink-0" />
            {t("tryAnother")}
          </button>

          <button
            onClick={onCancel}
            className="w-full h-11 rounded-md text-label text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RandomDrinkModal;
