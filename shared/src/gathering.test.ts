import { describe, expect, test } from "vitest";
import { BUSHES } from "./herblaw.ts";
import { gatheringSource, rollFinds } from "./gathering.ts";
import { VEINS } from "./mining.ts";

/** Rolls from a fixed list, in order, then 1s (nothing more hits). */
const rolls = (...values: number[]) => {
  let i = 0;
  return () => values[i++] ?? 1;
};

describe("rollFinds", () => {
  test("a bush has no finds, so a pick finds nothing", () => {
    expect(rollFinds(gatheringSource("herblaw", "berryBush"), () => 0)).toEqual(
      [],
    );
    expect(BUSHES.berryBush).not.toHaveProperty("finds");
  });

  test("copper's tin hits below 1 in 3 and misses above it", () => {
    const copper = gatheringSource("mining", "copper");
    expect(rollFinds(copper, () => 0)).toEqual(["tin"]);
    expect(rollFinds(copper, () => 0.34)).toEqual([]);
  });

  test("iron's tin and coal roll on their own, so one mine can give both", () => {
    const iron = gatheringSource("mining", "iron");
    expect(rollFinds(iron, rolls(0.1, 0.4))).toEqual(["tin", "coal"]);
    expect(rollFinds(iron, rolls(0.1, 0.6))).toEqual(["tin"]);
    expect(rollFinds(iron, rolls(0.2, 0.4))).toEqual(["coal"]);
    expect(rollFinds(iron, rolls(0.2, 0.6))).toEqual([]);
  });

  test("emberite's gem roll gives exactly one gem, by its split", () => {
    const emberite = gatheringSource("mining", "emberite");
    // The first roll hits the 1-in-20; the second picks within the split.
    expect(rollFinds(emberite, rolls(0.01, 0))).toEqual(["ashstone"]);
    expect(rollFinds(emberite, rolls(0.01, 0.69))).toEqual(["ashstone"]);
    expect(rollFinds(emberite, rolls(0.01, 0.7))).toEqual(["cinderglass"]);
    expect(rollFinds(emberite, rolls(0.01, 0.94))).toEqual(["cinderglass"]);
    expect(rollFinds(emberite, rolls(0.01, 0.95))).toEqual(["heartflame"]);
    expect(rollFinds(emberite, rolls(0.01, 0.999))).toEqual(["heartflame"]);
    expect(rollFinds(emberite, rolls(0.06))).toEqual([]);
  });

  test("the veins carry the finds the spec's §3 table gives them", () => {
    expect(VEINS.copper.finds).toHaveLength(1);
    expect(VEINS.iron.finds).toHaveLength(2);
    expect(VEINS.emberite.finds).toHaveLength(1);
  });
});
