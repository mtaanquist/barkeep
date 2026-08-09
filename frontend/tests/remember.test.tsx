import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../src/App";
import { ACTIVITY_KEY, REMEMBER_KEY } from "../src/hooks/useSessionManager";
import { aBar, aDrink, fakeApi, FakeEventSource, signIn } from "./helpers";

const A_DAY = 24 * 60 * 60 * 1000;

const serve = () =>
  fakeApi((path) => {
    if (path.includes("/favourites/")) return [];
    if (path.includes("/drinks/bar/")) return [aDrink({ id: 1 })];
    if (path.includes("/orders/bar/")) return [];
    if (path.includes("/bars/1")) return aBar();
    if (path === "/api/bars") return [aBar()];
    return undefined;
  });

/** A guest who was here, and has not been back since. */
const cameBackAfter = (days: number) => {
  signIn();
  localStorage.setItem(ACTIVITY_KEY, String(Date.now() - days * A_DAY));
};

const openMenu = () => {
  window.history.pushState({}, "", "/customer");
  return render(<App />);
};

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
  serve();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("being remembered on a phone", () => {
  it("forgets a guest who was not remembered, after a day", async () => {
    cameBackAfter(2);
    openMenu();

    await waitFor(() => expect(window.location.pathname).toBe("/"));
  });

  it("still knows a remembered guest two months on", async () => {
    cameBackAfter(59);
    localStorage.setItem(REMEMBER_KEY, "true");

    openMenu();

    await screen.findAllByRole("heading", { name: "Negroni", level: 3 });
    expect(window.location.pathname).toBe("/customer");
  });

  // Two months, not forever.
  it("forgets a remembered guest once the two months are up", async () => {
    cameBackAfter(61);
    localStorage.setItem(REMEMBER_KEY, "true");

    openMenu();

    await waitFor(() => expect(window.location.pathname).toBe("/"));
  });

  // Signing out is a guest saying it is not them, so it cannot leave the
  // name behind for whoever picks the phone up next.
  it("forgets them when they sign out", async () => {
    signIn();
    localStorage.setItem(REMEMBER_KEY, "true");

    openMenu();
    await screen.findAllByRole("heading", { name: "Negroni", level: 3 });

    await userEvent.click(screen.getAllByRole("button", { name: "Logout" })[0]);

    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(localStorage.getItem(REMEMBER_KEY)).toBeNull();
  });
});
