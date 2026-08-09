import React from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { useApp } from "../hooks/useApp";
import { translations } from "../utils/translations";

interface ConnectionLostProps {
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * Shown when order updates have been missing for a while. The browser keeps
 * trying by itself, so this is only here to explain the quiet.
 */
export const ConnectionLost: React.FC<ConnectionLostProps> = ({
  onRetry,
  onDismiss,
}) => {
  const { language } = useApp();
  const t = translations[language];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-surface-raised border border-border rounded-lg shadow-float p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center text-center">
          <div className="bg-amber-100 rounded-full p-4 mb-4">
            <WifiOff className="w-12 h-12 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-text">
            {t.connectionLostTitle}
          </h2>
          <p className="text-text-muted mb-6">
            {t.connectionLostBody}
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onRetry}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-text text-text-inverse rounded-md hover:bg-neutral-800 transition-colors font-medium"
            >
              <RefreshCw className="w-5 h-5" />
              {t.connectionLostRetry}
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 px-6 py-3 bg-surface-sunken text-text rounded-md hover:bg-disabled-bg transition-colors font-medium"
            >
              {t.connectionLostDismiss}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
