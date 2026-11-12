import {
  DELICIOUS_BUFF_TICKS,
  EVENTS,
  POTION_BUFF_TICKS,
  TICK_MS,
  type Virtue,
  type WorldEvent,
} from "@runic/shared";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { showBuffs } from "./delicious.ts";

const buff = {
  hidden: true,
  textContent: "",
};
const potionBuff = {
  hidden: true,
  textContent: "",
};
vi.stubGlobal("document", {
  getElementById: (id: string) =>
    id === "buff" ? buff : id === "potion-buff" ? potionBuff : undefined,
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
} as unknown as Parameters<typeof showBuffs>[0];

const send = (event: WorldEvent) => messages.get(EVENTS)!([event]);
const now = vi.fn();
vi.stubGlobal("Date", { now });
/** The timers showBuffs is running, each drawable and clearable by identity. */
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
  potionBuff.hidden = true;
  potionBuff.textContent = "";
});
afterEach(() => vi.restoreAllMocks());

/** A `delicious` event for our own player, at this many ms on the clock. */
const eat = (at: number, player = "me") => {
  now.mockReturnValue(at);
  showBuffs(room);
  send({ type: "delicious", player, ticks: DELICIOUS_BUFF_TICKS });
};

/** A `potion` event for our own player, at this many ms on the clock. */
const drink = (at: number, virtue: Virtue = "might", player = "me") => {
  now.mockReturnValue(at);
  showBuffs(room);
  send({ type: "potion", player, virtue, ticks: POTION_BUFF_TICKS });
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

test("a drink shows the potion's Virtue and what it does, for its two minutes (#222)", () => {
  drink(0, "might");
  expect(potionBuff.hidden).toBe(false);
  expect(potionBuff.textContent).toBe("Might: +100 to your hit for 120s");
  now.mockReturnValue(60_000);
  fired.at(-1)!.draw();
  expect(potionBuff.textContent).toBe("Might: +100 to your hit for 60s");
});

test.each([
  ["fortitude", "Fortitude: +25% max health"],
  ["avoidance", "Avoidance: +1 to your Avoidance"],
] as const)("a %s potion's line says what it does (#222)", (virtue, does) => {
  drink(0, virtue);
  expect(potionBuff.textContent).toBe(`${does} for 120s`);
});

test("a new drink refreshes the potion's countdown, and someone else's never shows (#222)", () => {
  drink(0);
  drink(1000);
  now.mockReturnValue(1000 + 500);
  fired.at(-1)!.draw();
  expect(potionBuff.textContent).toBe("Might: +100 to your hit for 120s");
  const timers = fired.length;
  send({
    type: "potion",
    player: "other",
    virtue: "might",
    ticks: POTION_BUFF_TICKS,
  });
  expect(fired).toHaveLength(timers);
});

test("a Delicious fish and a potion can run at once, and leaving hides both", () => {
  eat(0);
  drink(0, "fortitude");
  expect(fired).toHaveLength(2);
  leaves.forEach((leave) => leave());
  expect(buff.hidden).toBe(true);
  expect(potionBuff.hidden).toBe(true);
  expect(fired).toEqual([]);
});
