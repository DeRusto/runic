import { parseRegion } from "@runic/shared";
import { describe, expect, it } from "vitest";
import { houseParts } from "./houseParts.ts";

// A 3×2 house with its door on the north wall.
const tiles = parseRegion(".....\n.HDH.\n.HHH.\n.....");
const named = (x: number, y: number, part: string) =>
  houseParts(tiles, x, y).filter((p) => p.part === part);

describe("houseParts", () => {
  it("puts a door facing out of the wall its tile is in", () => {
    expect(named(2, 1, "door")).toEqual([
      { part: "door", angle: Math.PI / 2, height: 0 },
    ]);
    expect(named(2, 1, "window")).toEqual([]);
  });

  it("gives a wall's middle a window and a corner plain walls", () => {
    expect(named(2, 2, "window")).toEqual([
      { part: "window", angle: -Math.PI / 2, height: 0 },
    ]);
    expect(named(1, 1, "wall")).toHaveLength(2);
    expect(named(1, 1, "window")).toEqual([]);
  });

  it("slopes the roof out across a ridge along the longer side", () => {
    for (const x of [1, 2, 3]) {
      expect(named(x, 1, "roof")[0]!.angle).toBe(Math.PI / 2);
      expect(named(x, 2, "roof")[0]!.angle).toBe(-Math.PI / 2);
    }
    const upright = parseRegion(".HH.\n.HD.\n.HH.");
    expect(
      houseParts(upright, 1, 1).find((p) => p.part === "roof")!.angle,
    ).toBe(Math.PI);
  });

  it("sets one ridge piece per ridge tile", () => {
    expect(named(2, 1, "ridge")).toHaveLength(1);
    expect(named(2, 2, "ridge")).toEqual([]);
  });

  it("dresses the house its keeper stands at in that building's look", () => {
    const bank = parseRegion([".....", ".HDH.", ".HHH.", "..$.."].join("\n"));
    const roof = houseParts(bank, 2, 2).find((p) => p.part.endsWith("oof"));
    expect(roof!.part).toBe("bankRoof");
    expect(houseParts(bank, 2, 1).map((p) => p.part)).toContain("ornateDoor");
    expect(
      houseParts(bank, 2, 2).filter((p) => p.part === "bankRoof"),
    ).toHaveLength(1);
  });
});
