import React from "react";
import type { Drink } from "../../types";
import { useCloseOnEscape } from "../../hooks/useCloseOnEscape";
import type { TranslationKeys } from "../../utils/translations";

interface ConfirmOrderModalProps {
  drink: Drink;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  t: (key: TranslationKeys) => string;
}

/**
 * One tap on a phone is easy to make by accident, and an order that was not
 * meant lands on the bartender's queue and blocks the guest from ordering
 * what they wanted. So ordering asks first, and names the drink it is about
 * to send.
 */
const ConfirmOrderModal: React.FC<ConfirmOrderModalProps> = ({
  drink,
  onConfirm,
  onCancel,
  loading,
  t,
}) => {
  useCloseOnEscape(onCancel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Tapping beside it is a way out, the way a phone leads you to expect,
          and it can only ever cancel. */}
      <button
        type="button"
        aria-label={t("close")}
        onClick={onCancel}
        className="absolute inset-0 bg-overlay cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("confirmOrder")}
        className="relative w-full max-w-sm bg-surface-raised border border-border rounded-lg shadow-float overflow-hidden"
      >
        <div className="px-5 pt-5 pb-4 flex flex-col gap-1.5">
          <span className="font-mono text-caption uppercase text-text-muted">
            {t("confirmOrder")}
          </span>
          <h2 className="text-display break-words">{drink.title}</h2>
          <p className="text-body text-text-muted">{t("confirmOrderHelp")}</p>
        </div>

        {/* Split the same way as the card that was just tapped: the quiet
            way out on the left, going ahead on the right, so the thumb is
            already over the right one. */}
        <div className="flex border-t border-border">
          <button
            onClick={onCancel}
            className="w-33 h-16 shrink-0 border-r border-border text-label text-text transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
          >
            {t("cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 h-16 px-3 transition-colors duration-(--duration-instant) ${
              loading
                ? "bg-disabled-bg text-disabled-fg text-label cursor-not-allowed"
                : "bg-accent text-accent-contrast text-heading hover:bg-accent-hover cursor-pointer"
            }`}
          >
            {loading ? t("loading") : t("confirmOrderYes")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmOrderModal;
