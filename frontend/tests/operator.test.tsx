import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import { AppProvider } from "../src/context/AppContext";
import LandingPage from "../src/components/LandingPage";
import OperatorPanel from "../src/components/operator/OperatorPanel";
import { fakeApi, type FakeApi } from "./helpers";
import type { OperatorBar } from "../src/types";

const aBarRow = (extra: Partial<OperatorBar> = {}): OperatorBar => ({
  id: 1,
  name: "Downstairs",
  created_at: "2025-07-13 14:23:32",
  lastUsed: "2025-07-14 20:10:00",
  deletedAt: null,
  drinkCount: 4,
  orderCount: 12,
  ...extra,
});

/** What the download endpoint hands back. Set to undefined to make it fail. */
let exportReply: () => unknown = () => new Blob(["a zip, honestly"]);

/** Answers the operator endpoints, and the landing page's bar list. */
function operatorApi(bars: OperatorBar[] = [aBarRow()]): FakeApi {
  return fakeApi((path, options) => {
    if (path.includes("/operator/me")) return undefined; // no cookie → 401
    if (path.includes("/operator/login")) return { success: true };
    if (path.includes("/operator/logout")) return { success: true };
    if (path.includes("/operator/export")) return exportReply();
    if (path.includes("/operator/bars")) {
      return options.method === "DELETE" || options.method === "POST"
        ? { success: true }
        : bars;
    }
    if (path.includes("/bars")) return []; // the landing bar picker
    return undefined;
  });
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/operator" element={<OperatorPanel />} />
        </Routes>
      </AppProvider>
    </MemoryRouter>
  );

/** The links the panel clicks on your behalf to save a file. */
const saved: HTMLAnchorElement[] = [];

// jsdom cannot hand a file to a person, so stand in for the bits of the
// browser that would: the blob address, and the click that saves it.
beforeEach(() => {
  saved.length = 0;
  exportReply = () => new Blob(["a zip, honestly"]);
  URL.createObjectURL = vi.fn(() => "blob:pretend");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    saved.push(this);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the hidden way in", () => {
  it("opens the operator door after seven taps on the sign", async () => {
    operatorApi();
    renderAt("/");

    const sign = screen.getByText("Barkeep");
    for (let i = 0; i < 7; i++) fireEvent.click(sign);

    // The operator sign-in appears — its own screen, reached with no link.
    expect(
      await screen.findByPlaceholderText("Operator password")
    ).toBeInTheDocument();
  });

  it("stays shut on only six taps", () => {
    operatorApi();
    renderAt("/");

    const sign = screen.getByText("Barkeep");
    for (let i = 0; i < 6; i++) fireEvent.click(sign);

    expect(screen.queryByPlaceholderText("Operator password")).toBeNull();
  });
});

describe("the operator panel", () => {
  it("signs in and lists the bars", async () => {
    operatorApi([aBarRow({ name: "The Cellar" })]);
    renderAt("/operator");

    fireEvent.change(await screen.findByPlaceholderText("Operator password"), {
      target: { value: "back-of-house" },
    });
    fireEvent.click(screen.getByText("Sign in"));

    expect(await screen.findByText("The Cellar")).toBeInTheDocument();
  });

  it("won't retire a bar until its exact name is typed", async () => {
    const api = operatorApi([aBarRow({ name: "The Cellar" })]);
    renderAt("/operator");

    fireEvent.change(await screen.findByPlaceholderText("Operator password"), {
      target: { value: "back-of-house" },
    });
    fireEvent.click(screen.getByText("Sign in"));
    await screen.findByText("The Cellar");

    // Open the type-the-name confirmation.
    fireEvent.click(screen.getByLabelText("Remove The Cellar"));

    const confirm = await screen.findByText("Remove bar");
    expect(confirm).toBeDisabled();

    // The wrong name keeps it disabled.
    fireEvent.change(screen.getByPlaceholderText("The Cellar"), {
      target: { value: "the cellar" },
    });
    expect(confirm).toBeDisabled();

    // The exact name arms it, and firing sends the delete with the name.
    fireEvent.change(screen.getByPlaceholderText("The Cellar"), {
      target: { value: "The Cellar" },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => {
      const del = api.calls.find((c) => c.method === "DELETE");
      expect(del?.body).toEqual({ confirmationName: "The Cellar" });
    });
  });
});

describe("downloading a copy", () => {
  /** Signs in and waits for the panel proper. */
  async function signedIn(api: FakeApi): Promise<FakeApi> {
    renderAt("/operator");
    fireEvent.change(await screen.findByPlaceholderText("Operator password"), {
      target: { value: "back-of-house" },
    });
    fireEvent.click(screen.getByText("Sign in"));
    await screen.findByText("Downstairs");
    return api;
  }

  it("asks for the database alone by default", async () => {
    const api = await signedIn(operatorApi());

    fireEvent.click(screen.getByText("Download"));

    await waitFor(() => {
      const asked = api.calls.find((c) => c.path.includes("/operator/export"));
      expect(asked?.path).toContain("/operator/export");
      expect(asked?.path).not.toContain("uploads=1");
    });

    // And the file is actually offered, under a name someone can find again.
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.download).toBe("barkeep-export.zip");
  });

  it("asks for the photos too once the box is ticked", async () => {
    const api = await signedIn(operatorApi());

    fireEvent.click(screen.getByLabelText("Include the drink photos"));
    fireEvent.click(screen.getByText("Download"));

    await waitFor(() => {
      expect(api.countOf("/operator/export?uploads=1")).toBe(1);
    });
  });

  it("says so when the copy cannot be made, and lets you try again", async () => {
    await signedIn(operatorApi());
    exportReply = () => undefined; // the server refuses

    fireEvent.click(screen.getByText("Download"));

    expect(
      await screen.findByText("The copy could not be made. Please try again.")
    ).toBeInTheDocument();
    expect(screen.getByText("Download")).toBeEnabled();
  });
});
