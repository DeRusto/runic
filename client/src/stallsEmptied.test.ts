import {
  EVENTS,
  TICK_MS,
  type StallKind,
  type WorldEvent,
} from "@runic/shared";
import { beforeEach, expect, test, vi } from "vitest";
import { showStallsEmptied } from "./stallsEmptied.ts";

let messages: Map<string, (events: WorldEvent[]) => void>;
let leaves: (() => void)[];
const room = {
  sessionId: "me",
  onMessage(type: string, handler: (events: WorldEvent[]) => void) {
    messages.set(type, handler);
  },
  onLeave(handler: () => void) {
    leaves.push(handler);
  },
} as unknown as Parameters<typeof showStallsEmptied>[0];

let wares: Map<StallKind, { visible: boolean }>;
const send = (...events: WorldEvent[]) => messages.get(EVENTS)!(events);
const emptied = (player: string, stall: StallKind, ticks: number) =>
  ({ type: "stallEmptied", player, stall, ticks }) as const;

beforeEach(() => {
  vi.useFakeTimers();
  messages = new Map();
  leaves = [];
  wares = new Map([
    ["food", { visible: true }],
    ["fish", { visible: true }],
  ]);
  showStallsEmptied(room, wares);
});

test("a stall this player emptied shows bare until its timer runs out", () => {
  send(emptied("me", "fish", 20));
  expect(wares.get("fish")!.visible).toBe(false);
  expect(wares.get("food")!.visible).toBe(true);

  vi.advanceTimersByTime(20 * TICK_MS - 1);
  expect(wares.get("fish")!.visible).toBe(false);
  vi.advanceTimersByTime(1);
  expect(wares.get("fish")!.visible).toBe(true);
});

test("a stall another player emptied stays stocked for this one", () => {
  send(emptied("someone", "fish", 20));
  expect(wares.get("fish")!.visible).toBe(true);
});

test("emptying it again restarts the wait", () => {
  send(emptied("me", "food", 10));
  vi.advanceTimersByTime(5 * TICK_MS);
  send(emptied("me", "food", 10));
  vi.advanceTimersByTime(6 * TICK_MS);
  expect(wares.get("food")!.visible).toBe(false);
  vi.advanceTimersByTime(4 * TICK_MS);
  expect(wares.get("food")!.visible).toBe(true);
});

test("leaving the room puts every stall's wares back", () => {
  send(emptied("me", "fish", 20));
  for (const leave of leaves) leave();
  expect(wares.get("fish")!.visible).toBe(true);
});
