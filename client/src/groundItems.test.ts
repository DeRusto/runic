import { expect, test } from "vitest";
import { groundItemsLabel } from "./groundItems.ts";

const ore = { item: "copperOre", count: 12, owner: "" };
const sword = { item: "copperSword", count: 1, owner: "" };

test("one ground item reads as its name and count, with no count for a single one", () => {
  expect(groundItemsLabel([ore], "alice")).toBe("Copper ore (12)");
  expect(groundItemsLabel([sword], "alice")).toBe("Copper sword (1)");
});

test("a pile reads as how many, then one line per ground item", () => {
  expect(groundItemsLabel([ore, sword], "alice")).toBe(
    "Pile: 2 items\nCopper ore (12)\nCopper sword (1)",
  );
});

test("your own items in their owner minute read as yours for now", () => {
  const mine = { ...ore, owner: "alice" };
  expect(groundItemsLabel([mine], "alice")).toBe(
    "Copper ore (12) · yours for now",
  );
  expect(groundItemsLabel([sword, mine], "alice")).toBe(
    "Pile: 2 items\nCopper sword (1)\nCopper ore (12) · yours for now",
  );
});
