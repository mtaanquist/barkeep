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

  it("sends last orders and the per-guest limit", async () => {
    openSettings();

    await userEvent.click(
      await screen.findByRole("checkbox", { name: /Stop taking orders/ })
    );

    const limit = screen.getByLabelText(/Drinks at a time/);
    await userEvent.clear(limit);
    await userEvent.type(limit, "2");

    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(api.calls.some((call) => call.method === "PUT")).toBe(true)
    );
    expect(api.calls.find((call) => call.method === "PUT")?.body).toMatchObject({
      ordersClosed: true,
      maxActiveOrders: 2,
    });
  });

  // Saving the bar's name must never wipe a code that was left blank.
  it("leaves the codes alone unless a new one is typed", async () => {
    openSettings();

    await userEvent.click(
      await screen.findByRole("button", { name: "Save settings" })
    );

    await waitFor(() =>
      expect(api.calls.some((call) => call.method === "PUT")).toBe(true)
    );
    const sent = api.calls.find((call) => call.method === "PUT")?.body as Record<
      string,
      unknown
    >;
    expect(sent).not.toHaveProperty("newGuestPassword");
    expect(sent).not.toHaveProperty("newBartenderPassword");
  });

  it("sends a new guest code when one is typed", async () => {
    openSettings();

    await userEvent.type(
      await screen.findByLabelText("Guest code"),
      "fest2026"
    );
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(api.calls.some((call) => call.method === "PUT")).toBe(true)
    );
    expect(api.calls.find((call) => call.method === "PUT")?.body).toMatchObject({
      newGuestPassword: "fest2026",
    });
  });

  // Everyone still holding the printed code is locked out, so it asks.
  it("asks before making a new guest link, and does nothing if you say no", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    openSettings();

    await userEvent.click(
      await screen.findByRole("button", { name: "Make a new link" })
    );

    expect(confirm).toHaveBeenCalled();
    expect(api.calls.some((c) => c.path.includes("rotate-guest-link"))).toBe(
      false
    );
  });

  it("keeps the language out of the signing-out link", async () => {
    openSettings();

    const signOut = await screen.findAllByRole("button", { name: "Logout" });
    for (const button of signOut) {
      expect(button).not.toHaveTextContent(/English|Dansk/);
    }
  });
});
