import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

import GuestGreeting from "../src/components/customer/GuestGreeting";
import { withApp, fakeApi, aBar, signIn } from "./helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const CLAIM = "Make this name mine";

describe("the header greeting", () => {
  it("invites an anonymous guest to claim, then welcomes them back", async () => {
    const api = fakeApi((path) => {
      if (path.includes("/auth/me")) {
        return {
          success: true,
          userType: "guest",
          bar: aBar(),
          customerName: "Ada",
          authenticated: false,
        };
      }
      if (path.includes("/auth/guest/claim")) {
        return {
          success: true,
          userType: "guest",
          bar: aBar(),
          customerName: "Ada",
          authenticated: true,
        };
      }
      return undefined;
    });
    signIn({ as: "guest", name: "Ada" });

    render(<GuestGreeting />, { wrapper: withApp });

    // Anonymous: a plain welcome, with an invitation to claim on the 2nd line.
    expect(await screen.findByText(/welcome, ada/i)).toBeInTheDocument();

    // The invitation opens a modal; set a password there.
    fireEvent.click(screen.getByRole("button", { name: CLAIM }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByPlaceholderText("Choose a password"),
      { target: { value: "secret" } }
    );
    fireEvent.click(within(dialog).getByRole("button", { name: CLAIM }));

    await waitFor(() => expect(api.countOf("/auth/guest/claim")).toBe(1));
    // Now a regular: the greeting turns into a welcome back.
    expect(await screen.findByText(/welcome back, ada/i)).toBeInTheDocument();
  });

  it("welcomes a regular back with their last visit", async () => {
    fakeApi((path) => {
      if (path.includes("/auth/me")) {
        return {
          success: true,
          userType: "guest",
          bar: aBar(),
          customerName: "Ada",
          authenticated: true,
        };
      }
      return undefined;
    });
    signIn({ as: "guest", name: "Ada" });
    localStorage.setItem("homeBarSystem_authenticated", JSON.stringify(true));

    render(<GuestGreeting />, { wrapper: withApp });

    expect(await screen.findByText(/welcome back, ada/i)).toBeInTheDocument();
    // No claim invitation for someone who already registered.
    expect(screen.queryByRole("button", { name: CLAIM })).toBeNull();
  });
});
