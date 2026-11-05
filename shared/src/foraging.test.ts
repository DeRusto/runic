import { describe, expect, it } from "vitest";
import { pickChance, pickIntervalTicks } from "./foraging.ts";

describe("pickChance", () => {
  it.each([
    ["berryBush", 1, 0.5],
    ["berryBush", 2, 0.52],
    ["berryBush", 26, 1],
    ["berryBush", 99, 1],
    ["herbBush", 10, 0.5],
    ["herbBush", 11, 0.52],
    ["herbBush", 35, 1],
  ] as const)("%s at level %i is %f", (kind, level, chance) => {
    expect(pickChance(kind, level)).toBeCloseTo(chance);
    expect(pickChance(kind, level)).toBeLessThanOrEqual(1);
  });
});

describe("pickIntervalTicks", () => {
  it.each([
    [1, 8],
    [14, 8],
    [15, 7],
    [29, 7],
    [30, 6],
    [44, 6],
    [45, 5],
    [59, 5],
    [60, 4],
    [99, 4],
  ])("at level %i is %i ticks", (level, ticks) => {
    expect(pickIntervalTicks(level)).toBe(ticks);
  });
});
