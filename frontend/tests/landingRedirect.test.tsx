import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../src/App";
import { aBar, aDrink, fakeApi, FakeEventSource, signIn } from "./helpers";

const OTHER_BAR = aBar({ id: 2, name: "The Anchor" });

const serve = () =>
  fakeApi((path) => {
    if (path.includes("/favourites/")) return [];
    if (path.includes("/drinks/bar/")) return [aDrink({ id: 1 })];
    if (path.includes("/orders/bar/")) return [];
    if (path.includes("/bars/1")) return aBar();
    if (path === "/api/bars") return [aBar(), OTHER_BAR];
    return undefined;
  });

const openFrontDoor = () => {
  window.history.pushState({}, "", "/");
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

// Closing the tab or trimming "/customer" off the address drops the guest back
// on the front door. Their session is still good, so tapping the bar they are
// already in should take them straight back — not ask for a name again. But the
// front door still stands, so they can pick a different bar if they meant to.
describe("a signed-in guest back at the front door", () => {
  it("walks straight into the bar they are already in", async () => {
    signIn(); // guest "Ada" at The Spotted Cow (id 1)

    openFrontDoor();

    // The picker is shown, as always — no auto-redirect.
    const theirBar = await screen.findByRole("button", {
      name: /The Spotted Cow/,
    });
    await userEvent.click(theirBar);

    // Into the menu, without being asked for a name or password again.
    await screen.findAllByRole("heading", { name: "Negroni", level: 3 });
    expect(window.location.pathname).toBe("/customer");
  });

  it("still asks at the door when they pick a different bar", async () => {
    signIn(); // signed in at The Spotted Cow, not The Anchor

    openFrontDoor();

    const otherBar = await screen.findByRole("button", { name: /The Anchor/ });
    await userEvent.click(otherBar);

    // Swapping bars goes through the login, as before.
    await screen.findByText("Login to The Anchor");
    expect(window.location.pathname).toBe("/");
  });
});
