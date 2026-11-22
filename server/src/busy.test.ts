import { expect, test } from "vitest";
import { BusyPlayers } from "./busy.ts";

test("a player made busy is busy for that many ticks, then free", () => {
  const busy = new BusyPlayers();
  busy.start("a", { tick: 10, ticks: 3, hittable: true });
  expect([10, 11, 12, 13].map((tick) => busy.isBusy("a", tick))).toEqual([
    true,
    true,
    true,
    false,
  ]);
  expect(busy.isBusy("b", 10)).toBe(false);
});

test("busy with hits on, as a stun is, can still be hit", () => {
  const busy = new BusyPlayers();
  busy.start("a", { tick: 10, ticks: 3, hittable: true });
  expect(busy.canBeHit("a", 11)).toBe(true);
});

test("busy with hits off, as Agility's crossing will be, can't be hit until it ends", () => {
  const busy = new BusyPlayers();
  busy.start("a", { tick: 10, ticks: 3, hittable: false });
  expect([10, 12, 13].map((tick) => busy.canBeHit("a", tick))).toEqual([
    false,
    false,
    true,
  ]);
  expect(busy.canBeHit("b", 10)).toBe(true);
});

test("ending it frees the player at once, as death does", () => {
  const busy = new BusyPlayers();
  busy.start("a", { tick: 10, ticks: 3, hittable: false });
  busy.end("a");
  expect(busy.isBusy("a", 11)).toBe(false);
  expect(busy.canBeHit("a", 11)).toBe(true);
});
