import React from "react";
import { translations } from "../../utils/translations";

interface OrderPlacedModalProps {
  onClose: () => void;
  t: (key: keyof typeof translations.en) => string;
}

const OrderPlacedModal: React.FC<OrderPlacedModalProps> = ({ onClose, t }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay">
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("orderPlaced")}
      className="w-full max-w-sm bg-surface-raised border border-border rounded-lg shadow-float overflow-hidden"
    >
      <div className="p-5">
        <h2 className="text-display">{t("orderPlaced")}</h2>
      </div>
      <div className="px-5 pb-4 pt-0 border-t border-border flex justify-end">
        <button
          onClick={onClose}
          className="mt-4 h-14 px-5 rounded-md bg-text text-text-inverse text-label transition-colors duration-(--duration-instant) hover:bg-neutral-800 cursor-pointer"
        >
          {t("close")}
        </button>
      </div>
    </div>
  </div>
);

export default OrderPlacedModal;
