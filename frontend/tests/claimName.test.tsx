import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import LoginForm from "../src/components/LoginForm";
import { AppProvider } from "../src/context/AppContext";
import { aBar } from "./helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function renderGuestLogin() {
  return render(
    <MemoryRouter>
      <AppProvider>
        <LoginForm mode="guest" prefilledBarId="1" onBack={() => {}} />
      </AppProvider>
    </MemoryRouter>
  );
}

describe("claiming a name from the guest login", () => {
  it("asks for the password when the name is already registered", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    let call = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, opts: RequestInit = {}) => {
        const path = String(url);
        if (path.endsWith("/api/auth/guest")) {
          bodies.push(JSON.parse(String(opts.body)));
          call += 1;
          // First try: no name password, and the name is claimed.
          if (call === 1) {
            return {
              ok: false,
              status: 401,
              json: async () => ({ error: "registered", code: "name_claimed" }),
            } as Response;
          }
          // Second try: the right password gets them in as a regular.
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              userType: "guest",
              bar: aBar(),
              customerName: "Ada",
              authenticated: true,
            }),
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      })
    );

    renderGuestLogin();

    // Type the bar's shared password and a name, then try to go in.
    fireEvent.change(await screen.findByPlaceholderText("Enter Password"), {
      target: { value: "gin" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "Ada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    // The name is taken: a password field and an explanation appear.
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Your password")).toBeInTheDocument()
    );
    expect(screen.getByText(/this name is taken here/i)).toBeInTheDocument();

    // Prove it, and the second request carries the name's password.
    fireEvent.change(screen.getByPlaceholderText("Your password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toMatchObject({
      customerName: "Ada",
      accountPassword: "secret",
    });
  });

  it("sends no password on the quick path for an unclaimed name", async () => {
    const bodies: Array<Record<string, unknown>> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, opts: RequestInit = {}) => {
        const path = String(url);
        if (path.endsWith("/api/auth/guest")) {
          bodies.push(JSON.parse(String(opts.body)));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              userType: "guest",
              bar: aBar(),
              customerName: "Bea",
              authenticated: false,
            }),
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      })
    );

    renderGuestLogin();

    fireEvent.change(await screen.findByPlaceholderText("Enter Password"), {
      target: { value: "gin" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "Bea" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    // The quick path carries no name password at all.
    expect(bodies[0]).not.toHaveProperty("accountPassword");
  });
});
