import { expect, test } from "vitest";
import { tickStepper } from "./tickStepper.ts";

function run(frames: number[]) {
  const stepsPerFrame: number[] = [];
  let steps = 0;
  const advance = tickStepper(() => steps++);
  for (const dt of frames) {
    steps = 0;
    advance(dt);
    stepsPerFrame.push(steps);
  }
  return stepsPerFrame;
}

test("a tick falls due every 300 ms of elapsed time", () => {
  expect(run([100, 100, 100, 100, 100, 100])).toEqual([0, 0, 1, 0, 0, 1]);
});

test("timer drift never runs two ticks in one frame and keeps the average rate", () => {
  const frames = Array.from({ length: 60 }, () => 20.7);
  const steps = run(frames);
  expect(Math.max(...steps)).toBe(1);
  expect(steps.reduce((a, b) => a + b)).toBe(4); // 1242 ms holds 4 whole ticks
});

test("a long stall runs at most one late tick, and drops the rest", () => {
  expect(run([5000, 20, 20, 300])).toEqual([1, 1, 0, 1]);
});
