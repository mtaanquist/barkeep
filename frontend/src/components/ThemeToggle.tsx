import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "../hooks/useTheme";
import type { TranslationKeys } from "../utils/translations";

const ICON: Record<Theme, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const LABEL: Record<Theme, TranslationKeys> = {
  system: "themeSystem",
  light: "themeLight",
  dark: "themeDark",
};

/**
 * One button that goes round three ways: follow the phone, light, dark.
 * Following the phone stays reachable because a room gets darker as the
 * evening goes on and phones change over on their own.
 */
const ThemeToggle: React.FC<{ t: (key: TranslationKeys) => string }> = ({
  t,
}) => {
  const { theme, nextTheme } = useTheme();
  const Icon = ICON[theme];
  const label = t(LABEL[theme]);

  return (
    <button
      type="button"
      onClick={nextTheme}
      aria-label={label}
      title={label}
      className="w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-text-muted transition-colors duration-(--duration-instant) hover:text-text hover:bg-surface-sunken cursor-pointer"
    >
      <Icon className="w-5 h-5" />
    </button>
  );
};

export default ThemeToggle;
