import { expect, test } from "vitest";
import {
  isKnightColor,
  isSkinTone,
  KNIGHT_COLORS,
  SKIN_TONES,
  STARTING_KNIGHT_COLOR,
  STARTING_SKIN_TONE,
} from "./appearance.ts";

test("the Knight comes in seven colors, and a new player starts Crimson, as the model was made", () => {
  expect(Object.values(KNIGHT_COLORS)).toEqual([
    "Crimson",
    "Azure",
    "Emerald",
    "Gold",
    "Violet",
    "Onyx",
    "Ivory",
  ]);
  expect(STARTING_KNIGHT_COLOR).toBe("crimson");
});

test("there are six skin tones, and a new player starts Fair, as the model was made", () => {
  expect(Object.values(SKIN_TONES)).toEqual([
    "Porcelain",
    "Fair",
    "Tan",
    "Olive",
    "Brown",
    "Deep",
  ]);
  expect(STARTING_SKIN_TONE).toBe("fair");
});

test("no id is both a color and a skin tone, so one message can carry either", () => {
  expect(Object.keys(KNIGHT_COLORS).filter(isSkinTone)).toEqual([]);
});

test("only a color's or a skin tone's id names one", () => {
  expect(isKnightColor("azure")).toBe(true);
  expect(isSkinTone("olive")).toBe(true);
  for (const junk of ["Azure", "Olive", "toString", 3]) {
    expect(isKnightColor(junk)).toBe(false);
    expect(isSkinTone(junk)).toBe(false);
  }
});
