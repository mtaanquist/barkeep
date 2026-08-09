import React from "react";
import { translations } from "../../utils/translations";

interface OrderPlacedModalProps {
  onClose: () => void;
  t: (key: keyof typeof translations.en) => string;
}

const OrderPlacedModal: React.FC<OrderPlacedModalProps> = ({ onClose, t }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
      <div className="text-3xl mb-2">🎉</div>
      <h2 className="text-lg font-bold mb-2">{t("orderPlaced")}</h2>
      <p className="mb-4 text-gray-600">Your order has been placed!</p>
      <button
        onClick={onClose}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        OK
      </button>
    </div>
  </div>
);

export default OrderPlacedModal;
