import React from "react";

/**
 * The pill on its own. It draws nothing interactive, so whatever wraps it
 * has to be the real button or label.
 */
const Switch: React.FC<{ on: boolean }> = ({ on }) => (
  <span
    className={`w-8.5 h-5 shrink-0 rounded-full flex items-center px-0.5 transition-colors duration-(--duration-instant) ${
      on ? "bg-text justify-end" : "bg-disabled-bg border border-disabled-border"
    }`}
  >
    <span
      className={`w-4 h-4 rounded-full ${on ? "bg-text-inverse" : "bg-disabled-fg"}`}
    />
  </span>
);

export default Switch;
