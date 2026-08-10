import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type React from "react";

import { AppProvider } from "../src/context/AppContext";
import { useApp } from "../src/hooks/useApp";
import { signIn, aBar } from "./helpers";

/** Shows who the app thinks is signed in, after it has checked with the server. */
const Probe: React.FC = () => {
  const { userType, currentBar } = useApp();
  return (
    <span data-testid="who">
      {userType ?? "nobody"}
      {currentBar ? `:${currentBar.name}` : ""}
    </span>
  );
};

const show = () =>
  render(
    <AppProvider>
      <Probe />
    </AppProvider>
  );

/** Answers only the session check, with a chosen status and body. */
function stubMe(status: number, body: unknown = {}) {
  const fetchMock = vi.fn(
    async () =>
      ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      }) as Response
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

// The whole point of the change: a remembered sign-in is only as good as the
// cookie behind it. The app asks the server on load and believes the answer.
describe("checking the sign-in on load", () => {
  it("forgets a session the server no longer knows", async () => {
    signIn({ as: "bartender", bar: aBar() });
    stubMe(401);

    show();

    await waitFor(() =>
      expect(screen.getByTestId("who").textContent).toBe("nobody")
    );
    // And nothing is left behind to look signed in on the next load.
    expect(localStorage.getItem("homeBarSystem_userType")).toBeNull();
  });

  it("keeps a session the server confirms, with the bar it sends back", async () => {
    signIn({ as: "bartender", bar: aBar({ name: "Yesterday's Name" }) });
    stubMe(200, {
      success: true,
      userType: "bartender",
      bar: aBar({ name: "Today's Name" }),
    });

    show();

    await waitFor(() =>
      expect(screen.getByTestId("who").textContent).toBe(
        "bartender:Today's Name"
      )
    );
  });

  it("does not sign out on a network blip", async () => {
    signIn({ as: "bartender", bar: aBar() });
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchMock);

    show();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // The check failed to reach the server, so the remembered sign-in stands.
    expect(screen.getByTestId("who").textContent).toBe(
      "bartender:The Spotted Cow"
    );
  });

  it("leaves a never-signed-in visitor alone, without even asking", async () => {
    const fetchMock = stubMe(401);

    show();

    expect(screen.getByTestId("who").textContent).toBe("nobody");
    // No session to check, so no round trip to make.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
