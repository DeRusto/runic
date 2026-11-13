import { BANK_SLOTS, EMPTY_SLOT, SKILLS } from "@runic/shared";
import { describe, expect, it } from "vitest";
import { newSave, saveOf, syncedOf } from "./playerSave.ts";
import type { PlayerSave } from "./saves.ts";
import { Player } from "./simulation.ts";

/** A player built from `save`, as the room builds one at login. */
const playerFrom = (save: PlayerSave) =>
  Object.assign(new Player(), syncedOf(save));

describe("player save", () => {
  it("brings back every skill's experience and everything else a save holds", () => {
    const save: PlayerSave = {
      x: 12,
      y: 34,
      // A distinct amount per skill, so two fields swapped would show.
      ...(Object.fromEntries(
        SKILLS.map(([, field], i) => [field, 1000 + i]),
      ) as Record<(typeof SKILLS)[number][1], number>),
      masteryHundredths: 42,
      health: 1500,
      inventory: ["copperOre", EMPTY_SLOT, "cookedPerch"],
      inventoryCounts: [3, 0, 2],
      tools: ["pickaxe", "tinderbox"],
      pinnedSkills: ["Cooking", "Mining"],
      bank: Array.from({ length: BANK_SLOTS }, (_, slot) =>
        slot === 5 ? "coins" : EMPTY_SLOT,
      ),
      bankCounts: Array.from({ length: BANK_SLOTS }, (_, slot) =>
        slot === 5 ? 250 : 0,
      ),
      weapon: "copperSword:uncommon:fortitude",
      shield: "copperShield",
      head: "copperHelm",
      body: "copperChestplate",
      legs: "copperPlatelegs",
      hands: "copperGauntlets",
      feet: "copperBoots",
      cape: "",
      neck: "",
      ring: "",
      // The quest columns' defaults: a save from before quests holds no progress (#231).
      quests: {},
      questPoints: 0,
      identifiesEssence: false,
    };
    expect(saveOf(playerFrom(save))).toEqual(save);
  });

  it("gives a save from before stacks, tools, pins and the bank what it lacks", () => {
    const save = saveOf(
      playerFrom({ ...newSave({ x: 1, y: 2 }), inventory: ["perch", ""] }),
    );
    expect(save.inventoryCounts).toEqual([1, 0]);
    expect(save.tools).toEqual([]);
    expect(save.bank).toHaveLength(BANK_SLOTS);
    expect(save.bankCounts).toHaveLength(BANK_SLOTS);
    expect(save.pinnedSkills).not.toHaveLength(0);
  });

  it("starts a new account with no experience but its starting Hitpoints", () => {
    const save = saveOf(playerFrom(newSave({ x: 1, y: 2 })));
    for (const [skill, field] of SKILLS)
      if (skill !== "Hitpoints") expect(save[field], skill).toBe(0);
    expect(save.hitpointsXp).toBeGreaterThan(0);
  });
});
