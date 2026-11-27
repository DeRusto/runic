import { parseRegion } from "@runic/shared";
import { expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

const TILES = parseRegion(["TTT", "TRT", "TTT"].join("\n"));

function oneKnight() {
  const sim = new Simulation(TILES, () => 0);
  sim.addPlayer("a");
  return sim;
}
const me = (sim: Simulation) => sim.state.players.get("a")!;

test("a new player's Knight is Crimson and Fair", () => {
  expect(me(oneKnight())).toMatchObject({
    knightColor: "crimson",
    skinTone: "fair",
  });
});

test("picking a color or a skin tone sets it at once, and both are saved", () => {
  const sim = oneKnight();
  sim.setAppearance("a", "azure");
  sim.setAppearance("a", "deep");
  expect(me(sim)).toMatchObject({ knightColor: "azure", skinTone: "deep" });
  expect(sim.saveOf("a")).toMatchObject({
    knightColor: "azure",
    skinTone: "deep",
  });
});

test("anything but a color's or skin tone's id is ignored", () => {
  const sim = oneKnight();
  for (const junk of ["Azure", "toString", 7, undefined])
    sim.setAppearance("a", junk as string);
  sim.setAppearance("nobody", "azure");
  expect(me(sim)).toMatchObject({ knightColor: "crimson", skinTone: "fair" });
});
