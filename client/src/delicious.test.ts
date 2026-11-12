import {
  DELICIOUS_BUFF_TICKS,
  EVENTS,
  TICK_MS,
  type WorldEvent,
} from "@runic/shared";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { showDelicious } from "./delicious.ts";

const buff = {
  hidden: true,
  textContent: "",
};
vi.stubGlobal("document", {
  getElementById: (id: string) => (id === "buff" ? buff : undefined),
});
vi.stubGlobal("Date", {
  now: () => Date.now(),
});

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
} as unknown as Parameters<typeof showDelicious>[0];

const send = (event: WorldEvent) => messages.get(EVENTS)!([event]);
const now = vi.fn();
vi.stubGlobal("Date", { now });
/** The timers showDelicious is running, each drawable and clearable by identity. */
let fired: { draw: () => void; ms: number }[];
vi.stubGlobal("setInterval", (draw: () => void, ms: number) => {
  const timer = { draw, ms };
  fired.push(timer);
  return timer;
});
vi.stubGlobal("clearInterval", (timer: unknown) => {
  fired = fired.filter((other) => other !== timer);
});

beforeEach(() => {
  messages = new Map();
  leaves = [];
  fired = [];
  buff.hidden = true;
  buff.textContent = "";
});
afterEach(() => vi.restoreAllMocks());

/** A `delicious` event for our own player, at this many ms on the clock. */
const eat = (at: number, player = "me") => {
  now.mockReturnValue(at);
  showDelicious(room);
  send({ type: "delicious", player, ticks: DELICIOUS_BUFF_TICKS });
};

test("an eat shows the buff's countdown, running down one second at a time", () => {
  eat(0);
  expect(buff.hidden).toBe(false);
  expect(buff.textContent).toBe("Delicious: extra healing for 60s");
  now.mockReturnValue(30_000);
  fired[0]!.draw();
  expect(buff.textContent).toBe("Delicious: extra healing for 30s");
  now.mockReturnValue(TICK_MS * DELICIOUS_BUFF_TICKS);
  fired[0]!.draw();
  expect(buff.hidden).toBe(true);
  expect(fired).toEqual([]);
});

test("a second delicious fish refreshes it, and someone else's never shows", () => {
  eat(0);
  eat(1000);
  now.mockReturnValue(1000 + 500);
  fired.at(-1)!.draw();
  expect(buff.textContent).toBe("Delicious: extra healing for 60s");
  const timers = fired.length;
  send({ type: "delicious", player: "other", ticks: DELICIOUS_BUFF_TICKS });
  expect(fired).toHaveLength(timers);
});

test("leaving hides it", () => {
  eat(0);
  leaves.forEach((leave) => leave());
  expect(buff.hidden).toBe(true);
  expect(fired).toEqual([]);
});
