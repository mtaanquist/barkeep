import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";

import {
  clearStoredState,
  useStoredState,
  STORAGE_PREFIX,
} from "../src/hooks/useStoredState";

describe("settings that survive a refresh", () => {
  it("remembers a value and reads it back on the next visit", () => {
    const first = renderHook(() => useStoredState("language", "en"));
    act(() => first.result.current[1]("da"));

    const later = renderHook(() => useStoredState("language", "en"));

    expect(later.result.current[0]).toBe("da");
  });

  it("removes rather than saves a blank, so nothing is left behind", () => {
    const { result } = renderHook(() =>
      useStoredState<string | null>("currentBar", null)
    );

    act(() => result.current[1]("something"));
    expect(localStorage.getItem(`${STORAGE_PREFIX}currentBar`)).not.toBeNull();

    act(() => result.current[1](null));
    expect(localStorage.getItem(`${STORAGE_PREFIX}currentBar`)).toBeNull();
  });

  // A half-written value used to throw during render, which showed the guest
  // a blank page with no way back.
  it("falls back to the default when the saved value is unreadable", () => {
    localStorage.setItem(`${STORAGE_PREFIX}currentBar`, "{not json");

    const { result } = renderHook(() => useStoredState("currentBar", null));

    expect(result.current[0]).toBeNull();
  });

  it("keeps the setter stable, so effects listing it do not re-run", () => {
    const { result, rerender } = renderHook(() =>
      useStoredState("language", "en")
    );
    const first = result.current[1];

    rerender();

    expect(result.current[1]).toBe(first);
  });
});

describe("signing out", () => {
  // Logout used to call localStorage.clear(), which wiped anything else the
  // same site had saved.
  it("forgets this app's settings and leaves everything else alone", () => {
    localStorage.setItem(`${STORAGE_PREFIX}userType`, '"guest"');
    localStorage.setItem(`${STORAGE_PREFIX}customerName`, '"Ada"');
    localStorage.setItem("somethingElse", "keep me");

    clearStoredState();

    expect(localStorage.getItem(`${STORAGE_PREFIX}userType`)).toBeNull();
    expect(localStorage.getItem(`${STORAGE_PREFIX}customerName`)).toBeNull();
    expect(localStorage.getItem("somethingElse")).toBe("keep me");
  });
});
