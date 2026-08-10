import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import RegularsTab from "../src/components/bartender/RegularsTab";
import { withApp, fakeApi, aBar, signIn } from "./helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

type Row = { id: number; name: string; created_at: string };

/** Serves a mutable list of regulars and applies a rename to it. */
function fakeRegulars(initial: Row[]) {
  let list = initial;
  return fakeApi((path, options) => {
    if (path.includes("/auth/me")) {
      return { success: true, userType: "bartender", bar: aBar() };
    }
    if (path.endsWith("/password") && options.method === "PUT") {
      return { success: true };
    }
    if (path.includes("/regulars/") && options.method === "PUT") {
      const { name } = JSON.parse(String(options.body));
      list = list.map((r) => (path.endsWith(`/${r.id}`) ? { ...r, name } : r));
      return { id: 1, name, created_at: initial[0].created_at };
    }
    if (path.includes("/regulars")) return list;
    return undefined;
  });
}

describe("the bartender's regulars tab", () => {
  it("lists the regulars who claimed a name", async () => {
    fakeRegulars([
      { id: 1, name: "Ada", created_at: "2026-08-01" },
      { id: 2, name: "Bea", created_at: "2026-08-02" },
    ]);
    signIn({ as: "bartender" });

    render(<RegularsTab />, { wrapper: withApp });

    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Bea")).toBeInTheDocument();
  });

  it("renames a regular and shows the new name", async () => {
    fakeRegulars([{ id: 1, name: "Ada", created_at: "2026-08-01" }]);
    signIn({ as: "bartender" });

    render(<RegularsTab />, { wrapper: withApp });

    fireEvent.click(await screen.findByRole("button", { name: "Rename" }));

    const input = screen.getByDisplayValue("Ada");
    fireEvent.change(input, { target: { value: "Ada Lovelace" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("resets a regular's password on the bartender's say-so", async () => {
    const api = fakeRegulars([{ id: 1, name: "Ada", created_at: "2026-08-01" }]);
    signIn({ as: "bartender" });

    render(<RegularsTab />, { wrapper: withApp });

    fireEvent.click(await screen.findByRole("button", { name: "Set password" }));

    // The bartender (or the guest they hand the tablet to) types a new one.
    const input = screen.getByPlaceholderText("New password");
    fireEvent.change(input, { target: { value: "simple" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // It went to the password endpoint, and the row confirms it.
    await waitFor(() => expect(api.countOf("/password")).toBe(1));
    expect(await screen.findByText("Password set.")).toBeInTheDocument();
  });
});
