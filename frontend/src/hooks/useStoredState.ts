import { useCallback, useState } from "react";

// Everything this app saves in the browser starts with this, so signing out
// can clear its own things without touching anything else on the site.
//
// Deliberately still the old name. Changing it would sign everyone out on
// upgrade and leave their old settings behind, which nobody would thank us
// for mid-party. Nobody sees it.
export const STORAGE_PREFIX = "homeBarSystem_";

/** Blank values are removed rather than saved, so nothing is left behind. */
const isBlank = (value: unknown): boolean => value === null || value === "";

function read<T>(key: string, fallback: T): T {
  const saved = localStorage.getItem(key);
  if (saved === null) return fallback;

  try {
    return JSON.parse(saved) as T;
  } catch {
    // Something else wrote here, or it was cut short. Start fresh rather
    // than leave the page blank.
    return fallback;
  }
}

/**
 * State that survives a refresh. Behaves like useState, and writes to the
 * browser's own storage as it goes.
 */
export function useStoredState<T>(
  name: string,
  fallback: T
): [T, (value: T) => void] {
  const key = `${STORAGE_PREFIX}${name}`;
  const [value, setValue] = useState<T>(() => read(key, fallback));

  const save = useCallback(
    (next: T) => {
      setValue(next);
      try {
        if (isBlank(next)) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(next));
      } catch (error) {
        console.error(`Could not save ${key}`, error);
      }
    },
    [key]
  );

  return [value, save];
}

/** Forgets everything this app saved, and nothing else. */
export function clearStoredState(): void {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(STORAGE_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
}
