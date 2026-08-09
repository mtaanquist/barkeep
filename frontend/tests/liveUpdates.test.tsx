import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import type React from "react";

import { LiveUpdatesProvider } from "../src/context/LiveUpdatesContext";
import { useApp } from "../src/hooks/useApp";
import { useLiveUpdates } from "../src/hooks/useLiveUpdates";
import { AppProvider } from "../src/context/AppContext";
import {
  anOrder,
  fakeApi,
  FakeEventSource,
  signIn,
  type FakeApi,
} from "./helpers";

let api: FakeApi;
let served: ReturnType<typeof anOrder>[];

/** Shows just enough to see what the live connection did. */
const Probe: React.FC = () => {
  const { orders } = useApp();
  const { isConnected, connectionError, reconnect } = useLiveUpdates();

  return (
    <div>
      <span data-testid="orders">{orders.map((o) => o.id).join(",")}</span>
      <span data-testid="connected">{String(isConnected)}</span>
      {connectionError && <span data-testid="notice">lost</span>}
      <button onClick={reconnect}>try again</button>
    </div>
  );
};

const show = () =>
  render(
    <AppProvider>
      <LiveUpdatesProvider>
        <Probe />
      </LiveUpdatesProvider>
    </AppProvider>
  );

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
  signIn();
  served = [anOrder({ id: 7 }), anOrder({ id: 8 })];
  api = fakeApi((path) => (path.includes("/orders/bar/") ? served : undefined));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("live updates", () => {
  it("watches the bar the guest is in", async () => {
    show();

    await waitFor(() => expect(FakeEventSource.live).toHaveLength(1));
    expect(FakeEventSource.live[0].url).toBe("/api/events?barId=1");
  });

  it("fetches the orders again when one arrives or changes", async () => {
    show();
    await waitFor(() => expect(FakeEventSource.live).toHaveLength(1));

    // Nothing is fetched until something happens; the page loads the first
    // list itself.
    expect(api.countOf("/orders/bar/1")).toBe(0);

    act(() =>
      FakeEventSource.live[0].send({
        type: "new_order",
        order: anOrder({ id: 8 }),
      })
    );

    await screen.findByText("7,8");
    expect(api.countOf("/orders/bar/1")).toBe(1);
  });

  it("takes an order off the list when it is cancelled", async () => {
    show();
    await waitFor(() => expect(FakeEventSource.live).toHaveLength(1));

    act(() =>
      FakeEventSource.live[0].send({
        type: "new_order",
        order: anOrder({ id: 8 }),
      })
    );
    await screen.findByText("7,8");

    act(() =>
      FakeEventSource.live[0].send({ type: "order_deleted", orderId: 7 })
    );

    expect(screen.getByTestId("orders")).toHaveTextContent("8");
  });

  // The connection used to be torn down and reopened every time an order came
  // in, because apiCall was rebuilt on every render.
  it("keeps the same connection while orders come and go", async () => {
    show();
    await waitFor(() => expect(FakeEventSource.live).toHaveLength(1));
    const first = FakeEventSource.live[0];

    for (const id of [9, 10, 11]) {
      served = [...served, anOrder({ id })];
      act(() => first.send({ type: "new_order", order: anOrder({ id }) }));
      await screen.findByText(served.map((o) => o.id).join(","));
    }

    expect(FakeEventSource.opened).toHaveLength(1);
    expect(first.closed).toBe(false);
  });

  it("stays quiet about a blip, and speaks up if it lasts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    show();

    await waitFor(() => expect(FakeEventSource.live).toHaveLength(1));
    act(() => FakeEventSource.live[0].connect());
    expect(screen.getByTestId("connected")).toHaveTextContent("true");

    act(() => FakeEventSource.live[0].drop());
    act(() => void vi.advanceTimersByTime(10_000));
    expect(screen.queryByTestId("notice")).toBeNull();

    act(() => void vi.advanceTimersByTime(6_000));
    expect(screen.getByTestId("notice")).toBeInTheDocument();
  });

  it("says nothing if it comes back before anyone would notice", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    show();

    await waitFor(() => expect(FakeEventSource.live).toHaveLength(1));
    act(() => FakeEventSource.live[0].drop());
    act(() => void vi.advanceTimersByTime(5_000));
    act(() => FakeEventSource.live[0].connect());
    act(() => void vi.advanceTimersByTime(30_000));

    expect(screen.queryByTestId("notice")).toBeNull();
  });

  it("hangs up when the page goes away", async () => {
    const { unmount } = show();
    await waitFor(() => expect(FakeEventSource.live).toHaveLength(1));

    unmount();

    expect(FakeEventSource.live).toHaveLength(0);
  });

  it("does not connect at all until someone is signed in", async () => {
    localStorage.clear();
    show();

    await new Promise((r) => setTimeout(r, 50));

    expect(FakeEventSource.opened).toHaveLength(0);
  });
});
