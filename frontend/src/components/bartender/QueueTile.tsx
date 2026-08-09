import React from "react";
import { translations } from "../../utils/translations";

interface QueueTileProps {
  count: number;
  /** True when orders landed while the bartender was on another screen. */
  arrived: boolean;
  onClick: () => void;
  t: (key: keyof typeof translations.en) => string;
}

// The queue is the job, so it gets a filled tile and the biggest number in
// the navigation. Everything else in here is a quiet row.
const QueueTile: React.FC<QueueTileProps> = ({ count, arrived, onClick, t }) => (
  <button
    onClick={onClick}
    className={`w-full h-22 px-3.5 flex items-center gap-3 rounded-md bg-text text-text-inverse text-left transition-colors duration-(--duration-instant) hover:bg-neutral-800 cursor-pointer ${
      // The only yellow in the navigation, and only for this one reason.
      arrived ? "border-l-4 border-accent" : ""
    }`}
  >
    <span className="flex-1 min-w-0 font-bold text-[1.0625rem] leading-tight">
      {t("pendingOrders")}
    </span>
    <span
      className={`font-mono text-3xl leading-none tracking-tight ${
        arrived ? "text-accent" : ""
      }`}
    >
      {count}
    </span>
  </button>
);

export default QueueTile;
