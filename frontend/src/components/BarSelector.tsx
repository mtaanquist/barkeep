import React, { useCallback, useEffect, useState } from "react";
import { ChevronRight, RefreshCw, Plus } from "lucide-react";
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
            <h4 className="font-semibold text-text">Select Existing Bar</h4>
            <button
              onClick={fetchBars}
              disabled={loadingBars}
              className="p-1 text-text-muted hover:text-text"
              title="Refresh bars list"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingBars ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {availableBars.map((bar) => (
              /* Just the name. The row used to carry the database id and the
                 language code, neither of which means anything to a guest —
                 and picking a bar switches the language anyway. */
              <button
                key={bar.id}
                onClick={() => onSelectBar(bar)}
                className="w-full h-19 px-4 flex items-center gap-3.5 text-left border border-border rounded-md transition-colors duration-(--duration-instant) hover:border-border-strong cursor-pointer"
              >
                <span className="flex-1 min-w-0 text-heading truncate">
                  {bar.name}
                </span>
                <ChevronRight className="w-5 h-5 shrink-0 text-text-muted" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="text-center">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-surface-raised text-text-muted">or</span>
          </div>
        </div>
      </div>

      {/* Create New Bar Button */}
      <button
        onClick={onCreateBar}
        className="w-full bg-text text-text-inverse py-3 rounded-md hover:bg-neutral-800 transition-colors font-medium flex items-center justify-center space-x-2"
      >
        <Plus className="w-4 h-4" />
        <span>{t("createBar")}</span>
      </button>
    </div>
  );
};

export default BarSelector;
