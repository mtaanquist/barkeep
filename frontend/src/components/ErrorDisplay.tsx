import React from "react";
import { useApp } from "../hooks/useApp";
import { useTranslation } from "../utils/translations";

interface ErrorDisplayProps {
  error: string;
  onRetry: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry }) => {
  const { language } = useApp();
  const t = useTranslation(language);

  return (
    /* Sits over whatever the person was doing, so going back is losing
       nothing. It used to replace the whole app. */
    <div className="fixed inset-0 z-50 bg-overlay flex items-center justify-center p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={t("error")}
        className="bg-surface-raised border border-border rounded-lg shadow-float p-6 max-w-md w-full text-center"
      >
        <div className="text-danger mb-6">
          <div className="w-16 h-16 bg-status-rejected-bg rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-danger"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">{t("error")}</h2>
          <p className="text-text mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={onRetry}
              className="w-full bg-danger text-danger-contrast px-4 py-2 rounded-md hover:bg-danger-hover transition-colors font-medium"
            >
              {t("retry")}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-disabled-bg text-text px-4 py-2 rounded-md hover:bg-border transition-colors font-medium"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;
