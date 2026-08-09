import React from "react";
import Switch from "./bartender/Switch";

/** A switch with what it does written next to it. */
const ToggleRow: React.FC<{
  on: boolean;
  onChange: (on: boolean) => void;
  title: string;
  help: string;
}> = ({ on, onChange, title, help }) => (
  <label className="flex items-center gap-3 p-3 rounded-md border border-border cursor-pointer">
    <input
      type="checkbox"
      checked={on}
      onChange={(e) => onChange(e.target.checked)}
      className="sr-only"
    />
    <Switch on={on} />
    <span className="flex-1 flex flex-col gap-0.5">
      <span className="text-label">{title}</span>
      <span className="text-body text-text-muted">{help}</span>
    </span>
  </label>
);

export default ToggleRow;
