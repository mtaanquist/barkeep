import { describe, it, expect } from "vitest";

import {
  nextTimeOfDay,
  ordersAreClosed,
  timeOfDay,
} from "../src/utils/lastOrders";
import { aBar } from "./helpers";

const at = (iso: string) => new Date(iso).getTime();

describe("when the bar stops taking orders", () => {
  it("is open with neither the switch nor a time set", () => {
    expect(ordersAreClosed(aBar())).toBe(false);
  });

  it("is closed while the switch is on, whatever the clock says", () => {
    expect(ordersAreClosed(aBar({ orders_closed: 1 }))).toBe(true);
  });

  it("stays open until the time comes round, then closes", () => {
    const bar = aBar({ last_orders_at: "2026-08-10T00:00:00.000Z" });

    expect(ordersAreClosed(bar, at("2026-08-09T23:59:00.000Z"))).toBe(false);
    expect(ordersAreClosed(bar, at("2026-08-10T00:00:01.000Z"))).toBe(true);
  });

  it("ignores a time it cannot read rather than shutting the bar", () => {
    expect(ordersAreClosed(aBar({ last_orders_at: "half past" }))).toBe(false);
  });
});

// A party runs past midnight, so "two" typed at ten in the evening means
// two tomorrow morning, not two this afternoon.
describe("reading a time off a clock face", () => {
  it("takes tonight when the time is still to come", () => {
    const when = nextTimeOfDay("23:00", new Date("2026-08-09T22:00:00"));

    expect(when.getDate()).toBe(9);
    expect(when.getHours()).toBe(23);
  });

  it("takes tomorrow morning when it has already gone by", () => {
    const when = nextTimeOfDay("02:00", new Date("2026-08-09T22:00:00"));

    expect(when.getDate()).toBe(10);
    expect(when.getHours()).toBe(2);
  });

  it("puts the same time back in the field it came from", () => {
    const when = nextTimeOfDay("02:00", new Date("2026-08-09T22:00:00"));

    expect(timeOfDay(when.toISOString())).toBe("02:00");
  });

  it("leaves the field empty when nothing is set", () => {
    expect(timeOfDay(null)).toBe("");
  });
});
