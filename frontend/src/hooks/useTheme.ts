import { useCallback, useEffect } from "react";
import { useStoredState } from "./useStoredState";

/** Follow the phone, or override it one way or the other. */
export type Theme = "system" | "light" | "dark";

const ORDER: Theme[] = ["system", "light", "dark"];

const prefersDark = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Writes the choice where the stylesheet can see it. */
const apply = (theme: Theme) => {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  const root = document.documentElement;

  root.dataset.theme = dark ? "dark" : "light";
  // Tells the browser which way to draw scrollbars and native controls.
  root.style.colorScheme = dark ? "dark" : "light";
  // The markdown viewer brings its own light and dark, and follows this
  // rather than the phone — otherwise a recipe ignores the choice.
  root.dataset.colorMode = dark ? "dark" : "light";
};

/**
 * The same choice the short script in index.html reads on the way in. It
 * runs first so there is no flash; this keeps the two in step afterwards.
 */
export function useTheme(): { theme: Theme; nextTheme: () => void } {
  const [theme, setTheme] = useStoredState<Theme>("theme", "system");

  useEffect(() => {
    apply(theme);

    // Someone on "follow the phone" whose phone switches over at sunset
    // should switch with it, without reloading.
    if (theme !== "system") return;

    const watch = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => apply("system");

    watch.addEventListener("change", update);
    return () => watch.removeEventListener("change", update);
  }, [theme]);

  const nextTheme = useCallback(
    () => setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]),
    [theme, setTheme]
  );

  return { theme, nextTheme };
}
