import { beforeEach, expect, test, vi } from "vitest";
import { cameraTurner, quartersForKey } from "./cameraTurn.ts";

class FakeInput {}
vi.stubGlobal("HTMLInputElement", FakeInput);

const QUARTER = Math.PI / 2;
let time = 0;
const turner = () => cameraTurner(300, () => time);
const press = (key: string, more: Partial<KeyboardEvent> = {}) =>
  quartersForKey({ key, target: {}, ...more } as KeyboardEvent);

beforeEach(() => {
  time = 0;
});

test("a turn eases from one angle to the next", () => {
  const view = turner();
  view.turn(1);
  expect(view.angle()).toBe(0);
  time = 150;
  expect(view.angle()).toBeCloseTo(QUARTER / 2);
  time = 300;
  expect(view.angle()).toBeCloseTo(QUARTER);
});

test("a press mid-turn still settles on one of the 4 angles", () => {
  const view = turner();
  view.turn(1);
  time = 100;
  view.turn(1);
  time = 400;
  expect(view.angle()).toBeCloseTo(2 * QUARTER);
});

test("no turn time jumps straight to the angle", () => {
  const view = cameraTurner(0, () => time);
  view.turn(-1);
  expect(view.angle()).toBeCloseTo(-QUARTER);
});

test("Q and E turn opposite ways, in either case", () => {
  expect(press("q")).toBe(-1);
  expect(press("E")).toBe(1);
  expect(press("w")).toBe(0);
});

test("typing, held keys and shortcuts don't turn the view", () => {
  expect(press("q", { target: new FakeInput() as EventTarget })).toBe(0);
  expect(press("q", { repeat: true })).toBe(0);
  expect(press("e", { ctrlKey: true })).toBe(0);
});
