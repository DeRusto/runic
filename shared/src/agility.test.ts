import { describe, expect, it } from "vitest";
import {
  crossingFrom,
  crossRefusal,
  OBSTACLES,
  SHORTCUTS,
  shortcutFailPercent,
  type ObstacleKind,
} from "./agility.ts";
import { EMPTY_SLOT } from "./index.ts";
import { xpForLevel } from "./skills.ts";

const atLevel = (level: number) => xpForLevel(level);
const holding = (items: string[] = []) => ({
  inventory: [...items, EMPTY_SLOT],
  inventoryCounts: [...items.map(() => 1), 0],
});

describe("shortcuts", () => {
  it("are about five, from level 10 to 60, some rigged from level 20", () => {
    const levels = SHORTCUTS.map((kind) => OBSTACLES[kind].shortcut!.level);
    expect(SHORTCUTS.length).toBe(5);
    expect(Math.min(...levels)).toBe(10);
    expect(Math.max(...levels)).toBe(60);
    const rigged = SHORTCUTS.filter((kind) => OBSTACLES[kind].shortcut!.rope);
    expect(rigged.length).toBeGreaterThan(0);
    for (const kind of rigged)
      expect(OBSTACLES[kind].shortcut!.level).toBeGreaterThanOrEqual(20);
  });
});

describe("shortcutFailPercent", () => {
  const kind: ObstacleKind = "brambleSwing";
  const level = OBSTACLES[kind].shortcut!.level;
  it.each([
    [0, 25],
    [1, 22.5],
    [4, 15],
    [9, 2.5],
    [10, 0],
    [40, 0],
  ])("at %i levels above the requirement is %f%%", (above, percent) => {
    expect(shortcutFailPercent(kind, atLevel(level + above))).toBe(percent);
  });
  it("never fails a course obstacle", () => {
    expect(shortcutFailPercent("balanceBeam", 0)).toBe(0);
  });
});

describe("crossRefusal", () => {
  it("refuses a shortcut below its level", () => {
    expect(
      crossRefusal("ridgeStile", {
        agilityXp: atLevel(9),
        riggedShortcuts: [],
        ...holding(),
      }),
    ).toBe("You need Agility 10 to cross the ridge stile.");
  });
  it("refuses an unrigged shortcut without a rope", () => {
    expect(
      crossRefusal("brambleSwing", {
        agilityXp: atLevel(20),
        riggedShortcuts: [],
        ...holding(),
      }),
    ).toBe("You need a rope to rig the bramble swing.");
  });
  it("lets a player with a rope, or who rigged it before, cross", () => {
    const player = { agilityXp: atLevel(20), riggedShortcuts: [] };
    expect(
      crossRefusal("brambleSwing", { ...player, ...holding(["rope"]) }),
    ).toBeUndefined();
    expect(
      crossRefusal("brambleSwing", {
        ...player,
        riggedShortcuts: ["brambleSwing"],
        ...holding(),
      }),
    ).toBeUndefined();
  });
  it("never refuses a course obstacle", () => {
    expect(
      crossRefusal("balanceBeam", {
        agilityXp: 0,
        riggedShortcuts: [],
        ...holding(),
      }),
    ).toBeUndefined();
  });
});

describe("crossingFrom", () => {
  const grass = { ground: "grass", blocks: false } as const;
  it("crosses from a placed start to its landing", () => {
    expect(
      crossingFrom({ ...grass, obstacle: "ridgeStile" }, { x: 4, y: 4 }),
    ).toEqual({ obstacle: "ridgeStile", landing: { x: 6, y: 4 } });
  });
  it("crosses from a shortcut's far end back to its start", () => {
    expect(
      crossingFrom({ ...grass, obstacleEnd: "ridgeStile" }, { x: 6, y: 4 }),
    ).toEqual({ obstacle: "ridgeStile", landing: { x: 4, y: 4 } });
  });
  it("starts nothing from a tile with no obstacle", () => {
    expect(crossingFrom(grass, { x: 6, y: 4 })).toBeUndefined();
  });
});
