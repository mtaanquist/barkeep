import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../src/App";
import { aBar, aDrink, fakeApi, FakeEventSource, signIn } from "./helpers";

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

// A Danish bar telling a guest "Drink is currently out of stock" is worse than
// telling them nothing useful — the server writes in English.
describe("what a guest is told when something goes wrong", () => {
  it("says it in the bar's language, not the server's", async () => {
    signIn({ bar: aBar({ language: "da" }) });

    fakeApi((path, options) => {
      if (path.includes("/favourites/")) return [];
      if (path.includes("/drinks/bar/"))
        return [aDrink({ id: 1, title: "Negroni" })];
      if (path.includes("/orders/bar/")) return [];
      if (path === "/api/orders" && options.method === "POST") return undefined;
      return undefined;
    });

    window.history.pushState({}, "", "/customer");
    render(<App />);

    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Bestil" }))[0]
    );

    expect(
      await screen.findByText(/Noget gik galt\. Din bestilling blev ikke lagt/)
    ).toBeInTheDocument();
  });
});
