import { useEffect, useRef } from "react";

/**
 * Focus moves into a panel when it opens and goes back to whatever opened it
 * when it closes, so the keyboard never gets dropped on the page behind.
 *
 * Attach the returned ref to the panel and give it `tabIndex={-1}` so it can
 * take focus itself. If something inside has already taken focus — a field
 * that opens with the keyboard up — it is left alone.
 *
 * Pass `isOpen` for a panel that is rendered all the time; leave it out when
 * the panel only exists while open.
 */
export function useDialogFocus<T extends HTMLElement>(isOpen = true) {
  const panel = useRef<T>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  // Noted while rendering, before the panel is on screen: a field inside it
  // can take focus the moment it appears, and then it is too late to see who
  // opened it.
  if (isOpen && !wasOpen.current) {
    opener.current = document.activeElement as HTMLElement | null;
  }
  wasOpen.current = isOpen;

  useEffect(() => {
    if (!isOpen) return;

    const panelNode = panel.current;
    if (panelNode && !panelNode.contains(document.activeElement)) {
      panelNode.focus();
    }

    return () => {
      const back = opener.current;
      // Whatever opened this can be gone by now — a search result that closed
      // with it. Then there is nothing to go back to.
      if (back && back.isConnected) back.focus();
    };
  }, [isOpen]);

  return panel;
}
