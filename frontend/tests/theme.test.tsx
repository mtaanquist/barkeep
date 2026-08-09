import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import CustomerInterface from "../src/components/CustomerInterface";
import { AppProvider } from "../src/context/AppContext";
import { LiveUpdatesProvider } from "../src/context/LiveUpdatesContext";
import { aDrink, fakeApi, FakeEventSource, signIn } from "./helpers";

const showMenu = async () => {
  render(
    <MemoryRouter>
      <AppProvider>
        <LiveUpdatesProvider>
          <CustomerInterface />
        </LiveUpdatesProvider>
      </AppProvider>
    </MemoryRouter>
  );
  await screen.findAllByRole("heading", { name: "Negroni" });
};

const toggle = () => screen.getByRole("button", { name: /Theme:/i });

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
  signIn();
  fakeApi((path) => {
    if (path.includes("/favourites/")) return [];
    if (path.includes("/drinks/bar/")) return [aDrink({ id: 1 })];
    if (path.includes("/orders/bar/")) return [];
    return undefined;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
});

describe("choosing light or dark", () => {
  it("follows the phone until someone says otherwise", async () => {
    await showMenu();

    expect(toggle()).toHaveAccessibleName("Theme: follow my phone");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  // Round three ways rather than two, so following the phone stays
  // reachable — a room gets darker as the evening goes on, and phones
  // change over on their own.
  it("goes phone, light, dark, and back to phone", async () => {
    await showMenu();

    await userEvent.click(toggle());
    expect(toggle()).toHaveAccessibleName("Theme: light");
    expect(document.documentElement.dataset.theme).toBe("light");

    await userEvent.click(toggle());
    expect(toggle()).toHaveAccessibleName("Theme: dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    await userEvent.click(toggle());
    expect(toggle()).toHaveAccessibleName("Theme: follow my phone");
  });

  it("remembers the choice across a refresh", async () => {
    await showMenu();

    await userEvent.click(toggle());
    await userEvent.click(toggle());

    expect(localStorage.getItem("homeBarSystem_theme")).toBe('"dark"');
  });
});
