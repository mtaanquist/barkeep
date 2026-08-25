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
    <div className="fixed inset-0 z-50 bg-overlay flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("confirmOrder")}
        className="w-full max-w-sm bg-surface-raised border border-border rounded-lg shadow-float overflow-hidden"
      >
        <div className="px-5 pt-5 pb-4 flex flex-col gap-1.5">
          <span className="font-mono text-caption uppercase text-text-muted">
            {t("confirmOrder")}
          </span>
          <h2 className="text-display break-words">{drink.title}</h2>
          <p className="text-body text-text-muted">{t("confirmOrderHelp")}</p>
        </div>

        {/* Saying yes sits lowest, where the thumb already is, and backing
            out is the wider target of the two. */}
        <div className="px-5 pb-5 flex flex-col gap-2.5">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full h-16 px-4 rounded-md bg-accent text-accent-contrast text-heading transition-colors duration-(--duration-instant) hover:bg-accent-hover disabled:bg-disabled-bg disabled:text-disabled-fg disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? t("loading") : t("confirmOrderYes")}
          </button>

          <button
            onClick={onCancel}
            className="w-full h-14 rounded-md border border-border-strong bg-surface-raised text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmOrderModal;
