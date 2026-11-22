import { expect, test } from "vitest";
import { canBeHit, isBusy, type Busy } from "./busy.ts";

const STUN: Busy = { endTick: 13, hittable: true };
const CROSSING: Busy = { endTick: 13, hittable: false };

test("a player made busy is busy until its end tick, then free", () => {
  expect([10, 11, 12, 13].map((tick) => isBusy(STUN, tick))).toEqual([
    true,
    true,
    true,
    false,
  ]);
  expect(isBusy(undefined, 10)).toBe(false);
});

test("busy with hits on, as a stun is, can still be hit", () => {
  expect(canBeHit(STUN, 11)).toBe(true);
});

test("busy with hits off, as Agility's crossing will be, can't be hit until it ends", () => {
  expect([10, 12, 13].map((tick) => canBeHit(CROSSING, tick))).toEqual([
    false,
    false,
    true,
  ]);
  expect(canBeHit(undefined, 10)).toBe(true);
});
