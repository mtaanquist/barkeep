import React from "react";
import { Coffee } from "lucide-react";
import { translations } from "../utils/translations";

interface HelpTextProps {
  onSurprise: () => void;
  canSurprise: boolean;
  disabled: boolean;
  t: (key: keyof typeof translations.en) => string;
}

const HelpText: React.FC<HelpTextProps> = ({
  onSurprise,
  canSurprise,
  disabled,
  t,
}) => (
  <div className="max-w-4xl mx-auto px-4 mt-6">
    <div className="bg-surface-sunken border border-border rounded-md p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <Coffee className="h-5 w-5 text-text-muted" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-text">
            {t("howToOrder")}
          </h3>
          <div className="mt-2 text-sm text-text">
            <p>{t("howToOrderInstructions")}</p>
          </div>
        </div>
      </div>
    </div>
    <button
      onClick={onSurprise}
      disabled={!canSurprise || disabled}
      className="w-full md:w-auto px-6 py-3 bg-text text-text-inverse rounded-md font-bold text-lg shadow hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
    >
      🎲 {t("surpriseMe")}
    </button>
  </div>
);

export default HelpText;
