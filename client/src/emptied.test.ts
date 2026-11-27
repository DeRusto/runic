import {
  EVENTS,
  TICK_MS,
  type StallKind,
  type StrongboxKind,
  type WorldEvent,
} from "@runic/shared";
import { beforeEach, expect, test, vi } from "vitest";
import { showEmptied } from "./emptied.ts";

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
} as unknown as Parameters<typeof showEmptied>[0];

let wares: Map<StallKind, { visible: boolean }>;
let lids: Map<StrongboxKind, { visible: boolean }>;
const send = (...events: WorldEvent[]) => messages.get(EVENTS)!(events);
const emptied = (player: string, stall: StallKind, ticks: number) =>
  ({ type: "stallEmptied", player, stall, ticks }) as const;
const opened = (player: string, strongbox: StrongboxKind, ticks: number) =>
  ({ type: "strongboxEmptied", player, strongbox, ticks }) as const;

beforeEach(() => {
  vi.useFakeTimers();
  messages = new Map();
  leaves = [];
  wares = new Map([
    ["food", { visible: true }],
    ["fish", { visible: true }],
    ["gem", { visible: true }],
  ]);
  lids = new Map([
    ["boneyard", { visible: true }],
    ["hollow", { visible: true }],
  ]);
  showEmptied(room, { stall: wares, strongbox: lids });
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

test("a strongbox this player emptied loses its closed look until its timer runs out, and only that one", () => {
  send(opened("me", "hollow", 2000));
  expect(lids.get("hollow")!.visible).toBe(false);
  expect(lids.get("boneyard")!.visible).toBe(true);
  expect([...wares.values()].every(({ visible }) => visible)).toBe(true);

  vi.advanceTimersByTime(2000 * TICK_MS - 1);
  expect(lids.get("hollow")!.visible).toBe(false);
  vi.advanceTimersByTime(1);
  expect(lids.get("hollow")!.visible).toBe(true);
});

test("a strongbox another player emptied stays closed for this one", () => {
  send(opened("someone", "boneyard", 1000));
  expect(lids.get("boneyard")!.visible).toBe(true);
});

test("leaving the room puts every stall's wares and strongbox's lid back", () => {
  send(
    emptied("me", "food", 10),
    emptied("me", "fish", 20),
    emptied("me", "gem", 50),
    opened("me", "boneyard", 1000),
  );
  for (const leave of leaves) leave();
  expect([...wares.values()].every(({ visible }) => visible)).toBe(true);
  expect([...lids.values()].every(({ visible }) => visible)).toBe(true);
});
