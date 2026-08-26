import React from "react";
import Switch from "./Switch";

/** The stock column: the pill, with what it currently means beside it. */
const StockSwitch: React.FC<{
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}> = ({ on, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className="inline-flex items-center gap-2 text-label disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
  >
    <Switch on={on} />
    <span className={on ? "text-text" : "text-text-muted"}>{label}</span>
  </button>
);

export default StockSwitch;
