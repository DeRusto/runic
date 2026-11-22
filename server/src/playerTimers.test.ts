import { expect, test } from "vitest";
import { PlayerTimers } from "./playerTimers.ts";

test("a timer runs for its player and thing from the tick it starts until its length is up", () => {
  const timers = new PlayerTimers();
  timers.start("ada", "fish", 10, 5);
  expect(
    [10, 14, 15].map((tick) => timers.running("ada", "fish", tick)),
  ).toEqual([true, true, false]);
});

test("a timer holds for its own player and thing only", () => {
  const timers = new PlayerTimers();
  timers.start("ada", "fish", 10, 5);
  expect(timers.running("bo", "fish", 11)).toBe(false);
  expect(timers.running("ada", "gem", 11)).toBe(false);
});

test("starting a timer again restarts it from that tick", () => {
  const timers = new PlayerTimers();
  timers.start("ada", "fish", 10, 5);
  timers.start("ada", "fish", 14, 5);
  expect(timers.running("ada", "fish", 18)).toBe(true);
  expect(timers.running("ada", "fish", 19)).toBe(false);
});

test("a timer that has run out is forgotten, so the map doesn't grow without end", () => {
  const timers = new PlayerTimers();
  timers.start("ada", "fish", 10, 5);
  timers.start("bo", "gem", 10, 50);
  timers.forgetEnded(15);
  expect(timers.size).toBe(1);
});
