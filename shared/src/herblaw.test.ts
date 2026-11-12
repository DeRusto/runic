import { describe, expect, it } from "vitest";
import { BUSHES } from "./herblaw.ts";
import {
  attemptChance,
  gatherRefusal,
  pickIntervalTicks,
} from "./gathering.ts";

describe("attemptChance on bushes", () => {
  it.each([
    ["berryBush", 1, 0.5],
    ["berryBush", 2, 0.52],
    ["berryBush", 26, 1],
    ["berryBush", 99, 1],
    ["herbBush", 10, 0.5],
    ["herbBush", 11, 0.52],
    ["herbBush", 35, 1],
  ] as const)("%s at level %i is %f", (kind, level, chance) => {
    expect(attemptChance(BUSHES[kind].level, level)).toBeCloseTo(chance);
    expect(attemptChance(BUSHES[kind].level, level)).toBeLessThanOrEqual(1);
  });
});

describe("gatherRefusal's order", () => {
  const novice = {
    tools: [],
    herblawXp: 0,
    miningXp: 0,
    inventory: [""],
    inventoryCounts: [0],
  };

  it("names a run-out bush before a level the player lacks", () => {
    expect(gatherRefusal("herblaw", "herbBush", 3, novice)).toBe(
      "You need Herblaw 10 to pick this.",
    );
    expect(gatherRefusal("herblaw", "herbBush", 0, novice)).toBe(
      "This bush has run out.",
    );
  });

  it("names a missing tool, then a level, before a run-out vein", () => {
    expect(gatherRefusal("mining", "iron", 0, novice)).toBe(
      "You need a pickaxe. The Blacksmith will give you one.",
    );
    const miner = { ...novice, tools: ["pickaxe"] };
    expect(gatherRefusal("mining", "iron", 0, miner)).toBe(
      "You need Mining 10 to mine this.",
    );
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
