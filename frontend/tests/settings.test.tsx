import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../src/App";
import {
  aBar,
  fakeApi,
  FakeEventSource,
  signIn,
  type FakeApi,
} from "./helpers";

let api: FakeApi;

const serve = () => {
  api = fakeApi((path, options) => {
    if (path.includes("/analytics"))
      return {
        totalOrders: 0,
        ordersToday: 0,
        recentOrders: 0,
        popularDrinks: [],
        peakHours: [],
        statusDistribution: [],
        averageOrdersPerDay: 0,
        period: "30 days",
      };
    if (path.includes("/categories")) return [];
    if (path.includes("/drinks/bar/")) return [];
    if (path.includes("/orders/bar/")) return [];
    if (options.method === "PUT")
      return aBar({ name: "Hos Astrid", language: "da" });
    return undefined;
  });
};

const openSettings = () => {
  window.history.pushState({}, "", "/bartender/settings");
  return render(<App />);
};

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
  signIn({ as: "bartender" });
  serve();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("the bar's settings", () => {
  // The name and the language were printed as text with no way to change
  // either, and the language sat in the rail next to signing out.
  it("lets the name and the language be changed", async () => {
    openSettings();

    const name = await screen.findByLabelText("Bar name");
    expect(name).toHaveValue("The Spotted Cow");

    await userEvent.clear(name);
    await userEvent.type(name, "Hos Astrid");
    await userEvent.selectOptions(screen.getByLabelText("Language"), "da");
    await userEvent.click(
      screen.getByRole("button", { name: "Save settings" })
    );

    await waitFor(() =>
      expect(api.calls.some((call) => call.method === "PUT")).toBe(true)
    );

    const sent = api.calls.find((call) => call.method === "PUT");
    expect(sent?.body).toMatchObject({ name: "Hos Astrid", language: "da" });
  });

  it("says so once it has saved, in the bar's language", async () => {
    openSettings();

    await userEvent.selectOptions(
      await screen.findByLabelText("Language"),
      "da"
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save settings" })
    );

    // The bar came back as Danish, so the screen reads Danish from here on.
    expect(await screen.findByRole("status")).toHaveTextContent("Gemt.");
  });

  it("keeps the language out of the signing-out link", async () => {
    openSettings();

    const signOut = await screen.findAllByRole("button", { name: "Logout" });
    for (const button of signOut) {
      expect(button).not.toHaveTextContent(/English|Dansk/);
    }
  });
});
