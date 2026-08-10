import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../src/App";
import { aBar, fakeApi, FakeEventSource } from "./helpers";

const LANGUAGE_KEY = "homeBarSystem_language";

/** Serves the bar list a guest sees on the landing page. */
const serve = (bar = aBar()) =>
  fakeApi((path) => {
    if (path === "/api/bars") return [bar];
    if (path.includes("/bars/1")) return bar;
    return undefined;
  });

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
  window.history.pushState({}, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("choosing a language on the landing page", () => {
  // The bug: picking a bar used to overwrite the guest's choice with the bar's
  // own language (usually English), so Dansk was lost the moment they moved on.
  it("keeps the guest's Dansk choice when they pick an English bar", async () => {
    serve(aBar({ language: "en" }));
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Dansk" }));
    await userEvent.click(
      await screen.findByRole("button", { name: /The Spotted Cow/ })
    );

    // The login screen is now in Danish, and stays that way.
    expect(
      await screen.findByRole("button", { name: "Gæst login" })
    ).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(LANGUAGE_KEY) ?? '""')).toBe("da");
  });

  // A guest who never touches the toggle still gets the bar's own language.
  it("falls back to the bar's language when the guest has not chosen", async () => {
    serve(aBar({ language: "da" }));
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: /The Spotted Cow/ })
    );

    expect(
      await screen.findByRole("button", { name: "Gæst login" })
    ).toBeTruthy();
  });
});
