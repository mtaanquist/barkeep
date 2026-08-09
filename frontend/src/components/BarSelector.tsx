import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Plus } from "lucide-react";
import { useApp } from "../hooks/useApp";
import type { Bar } from "../types";
import { useTranslation } from "../utils/translations";

interface BarSelectorProps {
  onSelectBar: (bar: Bar) => void;
  onCreateBar: () => void;
}

const BarSelector: React.FC<BarSelectorProps> = ({
  onSelectBar,
  onCreateBar,
}) => {
  const { language, apiCall } = useApp();
  const t = useTranslation(language);

  const [availableBars, setAvailableBars] = useState<Bar[]>([]);
  const [loadingBars, setLoadingBars] = useState(false);

  const fetchBars = useCallback(async () => {
    setLoadingBars(true);
    try {
      setAvailableBars(await apiCall<Bar[]>("/bars"));
    } catch (err) {
      console.error("Could not load the bars:", err);
      setAvailableBars([]);
    } finally {
      setLoadingBars(false);
    }
  }, [apiCall]);

  useEffect(() => {
    fetchBars();
  }, [fetchBars]);

  return (
    <div className="space-y-4">
      {/* Available Bars */}
      {availableBars.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-700 dark:text-gray-300">Select Existing Bar</h4>
            <button
              onClick={fetchBars}
              disabled={loadingBars}
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              title="Refresh bars list"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingBars ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {availableBars.map((bar) => (
              <button
                key={bar.id}
                onClick={() => onSelectBar(bar)}
                className="bar-selector-item w-full p-3 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:border-purple-300 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
              >
                <div className="font-medium text-gray-800 dark:text-white">{bar.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  ID: {bar.id} • Language: {bar.language.toUpperCase()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="text-center">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">or</span>
          </div>
        </div>
      </div>

      {/* Create New Bar Button */}
      <button
        onClick={onCreateBar}
        className="w-full bg-purple-600 dark:bg-purple-700 text-white py-3 rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors font-medium flex items-center justify-center space-x-2"
      >
        <Plus className="w-4 h-4" />
        <span>{t("createBar")}</span>
      </button>
    </div>
  );
};

export default BarSelector;
