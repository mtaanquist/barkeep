import { useEffect, useRef } from "react";

/**
 * Escape closes it, the same as the labelled way out.
 *
 * Pass `isOpen` for something that is always on screen while mounted and
 * hidden otherwise; leave it out when the thing only exists while open.
 */
export function useCloseOnEscape(onClose: () => void, isOpen = true): void {
  // Held in a box so a fresh handler each render does not mean tearing the
  // listener down and putting it back.
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") latest.current();
    };

    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [isOpen]);
}
