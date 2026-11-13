import { describe, expect, test, vi } from "vitest";
import {
  AUGMENTATIONS,
  burnPercent,
  capeIn,
  capesIn,
  cookedItem,
  countOf,
  doublesAt,
  heldOf,
  levelRefusal,
  make,
  MAKING_SKILLS,
  madeItem,
  makeRefusal,
  materialLines,
  RECIPES,
  stationOf,
  stationRefusal,
  xpLines,
} from "./making.ts";
import { RUNES } from "./runecrafting.ts";
import { VIRTUES } from "./items.ts";
import { SKILLS, xpForLevel } from "./skills.ts";

const holding = (
  held: [string, number][],
  smithingXp = 0,
  miningXp = 0,
  cookingXp = 0,
  craftingXp = 0,
  fletchingXp = 0,
  runecraftingXp = 0,
  leatherworkingXp = 0,
  jewelsmithingXp = 0,
) => ({
  smithingXp,
  miningXp,
  cookingXp,
  craftingXp,
  fletchingXp,
  runecraftingXp,
  leatherworkingXp,
  jewelsmithingXp,
  inventory: held.map(([item]) => item),
  inventoryCounts: held.map(([, count]) => count),
});

test("the recipes are the rebalance spec §3's Making table, #221's range, #225's Crafting and #228's Fletching at the workbench, #232's four elemental runes at the altar, and #238's Leatherworking and Jewelsmithing after it", () => {
  expect(RECIPES).toEqual({
    copperBar: {
      skill: "Mining",
      level: 1,
      costs: { copperOre: 1 },
      ticks: 6,
      xp: 2,
    },
    bronzeBar: {
      skill: "Mining",
      level: 5,
      costs: { copperOre: 1, tin: 1 },
      ticks: 6,
      xp: 4,
    },
    ironBar: {
      skill: "Mining",
      level: 10,
      costs: { ironOre: 1 },
      ticks: 6,
      xp: 6,
    },
    steelBar: {
      skill: "Mining",
      level: 15,
      costs: { ironOre: 1, coal: 1 },
      ticks: 6,
      xp: 9,
    },
    emberiteBar: {
      skill: "Mining",
      level: 20,
      costs: { emberiteOre: 1 },
      ticks: 6,
      xp: 12,
    },
    copperSword: {
      skill: "Smithing",
      level: 1,
      costs: { copperBar: 3 },
      ticks: 12,
      xp: 18,
    },
    copperShield: {
      skill: "Smithing",
      level: 1,
      costs: { copperBar: 4 },
      ticks: 16,
      xp: 24,
    },
    copperHelmet: {
      skill: "Smithing",
      level: 1,
      costs: { copperBar: 2 },
      ticks: 8,
      xp: 12,
    },
    copperChestplate: {
      skill: "Smithing",
      level: 1,
      costs: { copperBar: 5 },
      ticks: 20,
      xp: 30,
    },
    copperLeggings: {
      skill: "Smithing",
      level: 1,
      costs: { copperBar: 3 },
      ticks: 12,
      xp: 18,
    },
    bronzeSword: {
      skill: "Smithing",
      level: 5,
      costs: { bronzeBar: 3 },
      ticks: 12,
      xp: 36,
    },
    bronzeShield: {
      skill: "Smithing",
      level: 5,
      costs: { bronzeBar: 4 },
      ticks: 16,
      xp: 48,
    },
    bronzeHelmet: {
      skill: "Smithing",
      level: 5,
      costs: { bronzeBar: 2 },
      ticks: 8,
      xp: 24,
    },
    bronzeChestplate: {
      skill: "Smithing",
      level: 5,
      costs: { bronzeBar: 5 },
      ticks: 20,
      xp: 60,
    },
    bronzeLeggings: {
      skill: "Smithing",
      level: 5,
      costs: { bronzeBar: 3 },
      ticks: 12,
      xp: 36,
    },
    ironSword: {
      skill: "Smithing",
      level: 10,
      costs: { ironBar: 3 },
      ticks: 12,
      xp: 54,
    },
    ironShield: {
      skill: "Smithing",
      level: 10,
      costs: { ironBar: 4 },
      ticks: 16,
      xp: 72,
    },
    ironHelmet: {
      skill: "Smithing",
      level: 10,
      costs: { ironBar: 2 },
      ticks: 8,
      xp: 36,
    },
    ironChestplate: {
      skill: "Smithing",
      level: 10,
      costs: { ironBar: 5 },
      ticks: 20,
      xp: 90,
    },
    ironLeggings: {
      skill: "Smithing",
      level: 10,
      costs: { ironBar: 3 },
      ticks: 12,
      xp: 54,
    },
    steelSword: {
      skill: "Smithing",
      level: 15,
      costs: { steelBar: 3 },
      ticks: 12,
      xp: 81,
    },
    steelShield: {
      skill: "Smithing",
      level: 15,
      costs: { steelBar: 4 },
      ticks: 16,
      xp: 108,
    },
    steelHelmet: {
      skill: "Smithing",
      level: 15,
      costs: { steelBar: 2 },
      ticks: 8,
      xp: 54,
    },
    steelChestplate: {
      skill: "Smithing",
      level: 15,
      costs: { steelBar: 5 },
      ticks: 20,
      xp: 135,
    },
    steelLeggings: {
      skill: "Smithing",
      level: 15,
      costs: { steelBar: 3 },
      ticks: 12,
      xp: 81,
    },
    emberiteSword: {
      skill: "Smithing",
      level: 20,
      costs: { emberiteBar: 3, emberbone: 2 },
      ticks: 12,
      xp: 108,
    },
    emberiteShield: {
      skill: "Smithing",
      level: 20,
      costs: { emberiteBar: 4, emberbone: 3 },
      ticks: 16,
      xp: 144,
    },
    emberiteHelmet: {
      skill: "Smithing",
      level: 20,
      costs: { emberiteBar: 2, emberbone: 1 },
      ticks: 8,
      xp: 72,
    },
    emberiteChestplate: {
      skill: "Smithing",
      level: 20,
      costs: { emberiteBar: 5, emberbone: 4 },
      ticks: 20,
      xp: 180,
    },
    emberiteLeggings: {
      skill: "Smithing",
      level: 20,
      costs: { emberiteBar: 3, emberbone: 2 },
      ticks: 12,
      xp: 108,
    },
    copperArrowhead: {
      skill: "Smithing",
      level: 1,
      costs: { copperBar: 1 },
      ticks: 6,
      yield: 10,
      xp: 6,
    },
    bronzeArrowhead: {
      skill: "Smithing",
      level: 5,
      costs: { bronzeBar: 1 },
      ticks: 6,
      yield: 10,
      xp: 6,
    },
    ironArrowhead: {
      skill: "Smithing",
      level: 10,
      costs: { ironBar: 1 },
      ticks: 6,
      yield: 10,
      xp: 6,
    },
    steelArrowhead: {
      skill: "Smithing",
      level: 15,
      costs: { steelBar: 1 },
      ticks: 6,
      yield: 10,
      xp: 6,
    },
    emberiteArrowhead: {
      skill: "Smithing",
      level: 20,
      costs: { emberiteBar: 1 },
      ticks: 6,
      yield: 10,
      xp: 6,
    },
    copperThrowingKnife: {
      skill: "Smithing",
      level: 1,
      costs: { copperBar: 1 },
      ticks: 6,
      xp: 6,
    },
    bronzeThrowingKnife: {
      skill: "Smithing",
      level: 5,
      costs: { bronzeBar: 1 },
      ticks: 6,
      xp: 12,
    },
    ironThrowingKnife: {
      skill: "Smithing",
      level: 10,
      costs: { ironBar: 1 },
      ticks: 6,
      xp: 18,
    },
    steelThrowingKnife: {
      skill: "Smithing",
      level: 15,
      costs: { steelBar: 1 },
      ticks: 6,
      xp: 27,
    },
    emberiteThrowingKnife: {
      skill: "Smithing",
      level: 20,
      costs: { emberiteBar: 1, emberbone: 1 },
      ticks: 6,
      xp: 36,
    },
    cookedPerch: {
      skill: "Cooking",
      level: 1,
      costs: { perch: 1 },
      ticks: 6,
      xp: 12,
    },
    berryPerch: {
      skill: "Cooking",
      level: 5,
      costs: { perch: 1, berry: 1 },
      ticks: 6,
      xp: 18,
    },
    herbPerch: {
      skill: "Cooking",
      level: 10,
      costs: { perch: 1, herb: 1 },
      ticks: 6,
      xp: 24,
    },
    cookedTrout: {
      skill: "Cooking",
      level: 10,
      costs: { trout: 1 },
      ticks: 6,
      xp: 30,
    },
    berryTrout: {
      skill: "Cooking",
      level: 15,
      costs: { trout: 1, berry: 1 },
      ticks: 6,
      xp: 45,
    },
    herbTrout: {
      skill: "Cooking",
      level: 20,
      costs: { trout: 1, herb: 1 },
      ticks: 6,
      xp: 60,
    },
    cookedPike: {
      skill: "Cooking",
      level: 20,
      costs: { pike: 1 },
      ticks: 6,
      xp: 50,
    },
    berryPike: {
      skill: "Cooking",
      level: 25,
      costs: { pike: 1, berry: 1 },
      ticks: 6,
      xp: 75,
    },
    herbPike: {
      skill: "Cooking",
      level: 30,
      costs: { pike: 1, herb: 1 },
      ticks: 6,
      xp: 100,
    },
    rope: {
      skill: "Crafting",
      level: 1,
      costs: { spiderSilk: 2 },
      ticks: 6,
      xp: 8,
    },
    torch: {
      skill: "Crafting",
      level: 5,
      costs: { birchLog: 1, rope: 1 },
      ticks: 6,
      xp: 14,
    },
    vial: {
      skill: "Crafting",
      level: 10,
      costs: { cinderglass: 1 },
      ticks: 6,
      xp: 20,
    },
    arrowShaft: {
      skill: "Fletching",
      level: 1,
      costs: { log: 1 },
      ticks: 6,
      yield: 10,
      xp: 2,
    },
    copperArrow: {
      skill: "Fletching",
      level: 1,
      costs: { arrowShaft: 10, copperArrowhead: 10, feather: 10 },
      ticks: 6,
      yield: 10,
      xp: 8,
    },
    bronzeArrow: {
      skill: "Fletching",
      level: 1,
      costs: { arrowShaft: 10, bronzeArrowhead: 10, feather: 10 },
      ticks: 6,
      yield: 10,
      xp: 8,
    },
    ironArrow: {
      skill: "Fletching",
      level: 1,
      costs: { arrowShaft: 10, ironArrowhead: 10, feather: 10 },
      ticks: 6,
      yield: 10,
      xp: 8,
    },
    steelArrow: {
      skill: "Fletching",
      level: 1,
      costs: { arrowShaft: 10, steelArrowhead: 10, feather: 10 },
      ticks: 6,
      yield: 10,
      xp: 8,
    },
    emberiteArrow: {
      skill: "Fletching",
      level: 1,
      costs: { arrowShaft: 10, emberiteArrowhead: 10, feather: 10 },
      ticks: 6,
      yield: 10,
      xp: 8,
    },
    birchBow: {
      skill: "Fletching",
      level: 1,
      costs: { birchLog: 1, rope: 1 },
      ticks: 6,
      xp: 20,
    },
    oakBow: {
      skill: "Fletching",
      level: 10,
      costs: { oakLog: 1, rope: 1 },
      ticks: 6,
      xp: 50,
    },
    charwoodBow: {
      skill: "Fletching",
      level: 20,
      costs: { charwoodLog: 1, rope: 1 },
      ticks: 6,
      xp: 90,
    },
    airRune: {
      skill: "Runecrafting",
      level: 1,
      doublesAt: 2,
      costs: { runeEssence: 1 },
      ticks: 6,
      xp: 5,
    },
    waterRune: {
      skill: "Runecrafting",
      level: 5,
      doublesAt: 10,
      costs: { runeEssence: 1 },
      ticks: 6,
      xp: 8,
    },
    earthRune: {
      skill: "Runecrafting",
      level: 10,
      doublesAt: 20,
      costs: { runeEssence: 1 },
      ticks: 6,
      xp: 12,
    },
    fireRune: {
      skill: "Runecrafting",
      level: 20,
      doublesAt: 40,
      costs: { runeEssence: 1 },
      ticks: 6,
      xp: 20,
    },
    copperGloves: {
      skill: "Leatherworking",
      level: 1,
      costs: { tarnHide: 2 },
      ticks: 8,
      xp: 10,
    },
    copperBoots: {
      skill: "Leatherworking",
      level: 1,
      costs: { tarnHide: 2 },
      ticks: 8,
      xp: 10,
    },
    bronzeGloves: {
      skill: "Leatherworking",
      level: 5,
      costs: { tarnHide: 3 },
      ticks: 8,
      xp: 20,
    },
    bronzeBoots: {
      skill: "Leatherworking",
      level: 5,
      costs: { tarnHide: 3 },
      ticks: 8,
      xp: 20,
    },
    ironGloves: {
      skill: "Leatherworking",
      level: 10,
      costs: { bristleHide: 2 },
      ticks: 8,
      xp: 30,
    },
    ironBoots: {
      skill: "Leatherworking",
      level: 10,
      costs: { bristleHide: 2 },
      ticks: 8,
      xp: 30,
    },
    steelGloves: {
      skill: "Leatherworking",
      level: 15,
      costs: { bristleHide: 3 },
      ticks: 8,
      xp: 40,
    },
    steelBoots: {
      skill: "Leatherworking",
      level: 15,
      costs: { bristleHide: 3 },
      ticks: 8,
      xp: 40,
    },
    emberiteGloves: {
      skill: "Leatherworking",
      level: 20,
      costs: { cinderHide: 2, emberbone: 1 },
      ticks: 8,
      xp: 50,
    },
    emberiteBoots: {
      skill: "Leatherworking",
      level: 20,
      costs: { cinderHide: 2, emberbone: 1 },
      ticks: 8,
      xp: 50,
    },
    copperMightCape: {
      skill: "Leatherworking",
      level: 1,
      costs: { tarnHide: 2, rope: 1 },
      ticks: 12,
      xp: 15,
    },
    copperFortitudeCape: {
      skill: "Leatherworking",
      level: 1,
      costs: { tarnHide: 2, rope: 1 },
      ticks: 12,
      xp: 15,
    },
    copperAvoidanceCape: {
      skill: "Leatherworking",
      level: 1,
      costs: { tarnHide: 2, rope: 1 },
      ticks: 12,
      xp: 15,
    },
    bronzeMightCape: {
      skill: "Leatherworking",
      level: 5,
      costs: { tarnHide: 2, rope: 1 },
      ticks: 12,
      xp: 30,
    },
    bronzeFortitudeCape: {
      skill: "Leatherworking",
      level: 5,
      costs: { tarnHide: 2, rope: 1 },
      ticks: 12,
      xp: 30,
    },
    bronzeAvoidanceCape: {
      skill: "Leatherworking",
      level: 5,
      costs: { tarnHide: 2, rope: 1 },
      ticks: 12,
      xp: 30,
    },
    ironMightCape: {
      skill: "Leatherworking",
      level: 10,
      costs: { bristleHide: 2, rope: 1 },
      ticks: 12,
      xp: 45,
    },
    ironFortitudeCape: {
      skill: "Leatherworking",
      level: 10,
      costs: { bristleHide: 2, rope: 1 },
      ticks: 12,
      xp: 45,
    },
    ironAvoidanceCape: {
      skill: "Leatherworking",
      level: 10,
      costs: { bristleHide: 2, rope: 1 },
      ticks: 12,
      xp: 45,
    },
    steelMightCape: {
      skill: "Leatherworking",
      level: 15,
      costs: { bristleHide: 2, rope: 1 },
      ticks: 12,
      xp: 60,
    },
    steelFortitudeCape: {
      skill: "Leatherworking",
      level: 15,
      costs: { bristleHide: 2, rope: 1 },
      ticks: 12,
      xp: 60,
    },
    steelAvoidanceCape: {
      skill: "Leatherworking",
      level: 15,
      costs: { bristleHide: 2, rope: 1 },
      ticks: 12,
      xp: 60,
    },
    emberiteMightCape: {
      skill: "Leatherworking",
      level: 20,
      costs: { cinderHide: 2, rope: 1 },
      ticks: 12,
      xp: 75,
    },
    emberiteFortitudeCape: {
      skill: "Leatherworking",
      level: 20,
      costs: { cinderHide: 2, rope: 1 },
      ticks: 12,
      xp: 75,
    },
    emberiteAvoidanceCape: {
      skill: "Leatherworking",
      level: 20,
      costs: { cinderHide: 2, rope: 1 },
      ticks: 12,
      xp: 75,
    },
    copperAmulet: {
      skill: "Jewelsmithing",
      level: 1,
      costs: { copperBar: 1 },
      ticks: 6,
      xp: 15,
    },
    copperRing: {
      skill: "Jewelsmithing",
      level: 1,
      costs: { copperBar: 1 },
      ticks: 6,
      xp: 15,
    },
    bronzeAmulet: {
      skill: "Jewelsmithing",
      level: 5,
      costs: { bronzeBar: 1 },
      ticks: 6,
      xp: 30,
    },
    bronzeRing: {
      skill: "Jewelsmithing",
      level: 5,
      costs: { bronzeBar: 1 },
      ticks: 6,
      xp: 30,
    },
    ironAmulet: {
      skill: "Jewelsmithing",
      level: 10,
      costs: { ironBar: 1, ashstone: 1 },
      ticks: 6,
      xp: 45,
    },
    ironRing: {
      skill: "Jewelsmithing",
      level: 10,
      costs: { ironBar: 1, ashstone: 1 },
      ticks: 6,
      xp: 45,
    },
    steelAmulet: {
      skill: "Jewelsmithing",
      level: 15,
      costs: { steelBar: 1, cinderglass: 1 },
      ticks: 6,
      xp: 60,
    },
    steelRing: {
      skill: "Jewelsmithing",
      level: 15,
      costs: { steelBar: 1, cinderglass: 1 },
      ticks: 6,
      xp: 60,
    },
    emberiteAmulet: {
      skill: "Jewelsmithing",
      level: 20,
      costs: { emberiteBar: 1, heartflame: 1 },
      ticks: 6,
      xp: 75,
    },
    emberiteRing: {
      skill: "Jewelsmithing",
      level: 20,
      costs: { emberiteBar: 1, heartflame: 1 },
      ticks: 6,
      xp: 75,
    },
  });
});

test("only the runes double, one essence making two once the making skill reaches twice the rune's gate", () => {
  // Each rune's doubling level is twice its gate (#232): air at 2, water at 10, earth at 20, fire at 40.
  expect(doublesAt("airRune", 1)).toBe(false);
  expect(doublesAt("airRune", 2)).toBe(true);
  expect(doublesAt("waterRune", 9)).toBe(false);
  expect(doublesAt("waterRune", 10)).toBe(true);
  expect(doublesAt("earthRune", 19)).toBe(false);
  expect(doublesAt("earthRune", 20)).toBe(true);
  expect(doublesAt("fireRune", 39)).toBe(false);
  expect(doublesAt("fireRune", 40)).toBe(true);
  for (const item of Object.keys(RECIPES))
    if (!RUNES.includes(item as never))
      expect(doublesAt(item as never, 99)).toBe(false);
});

test("Emberite gear needs its Emberbones as well as its bars and level", () => {
  const level20 = xpForLevel(20);
  expect(
    makeRefusal("emberiteSword", holding([["emberiteBar", 3]], level20)),
  ).toBe("Not enough materials");
  expect(
    makeRefusal(
      "emberiteSword",
      holding(
        [
          ["emberiteBar", 3],
          ["emberbone", 2],
        ],
        xpForLevel(19),
      ),
    ),
  ).toBe("Needs Smithing 20");
  expect(
    makeRefusal(
      "emberiteShield",
      holding(
        [
          ["emberiteBar", 4],
          ["emberbone", 3],
        ],
        level20,
      ),
    ),
  ).toBeUndefined();
});

test("Bronze and Steel bars need their find as well as ore", () => {
  const level15 = xpForLevel(15);
  expect(
    makeRefusal("bronzeBar", holding([["copperOre", 1]], 0, level15)),
  ).toBe("Not enough materials");
  expect(
    makeRefusal(
      "bronzeBar",
      holding(
        [
          ["copperOre", 1],
          ["tin", 1],
        ],
        0,
        xpForLevel(4),
      ),
    ),
  ).toBe("Needs Mining 5");
  expect(
    makeRefusal(
      "steelBar",
      holding(
        [
          ["ironOre", 1],
          ["coal", 1],
        ],
        0,
        level15,
      ),
    ),
  ).toBeUndefined();
  expect(makeRefusal("steelBar", holding([["ironOre", 1]], 0, level15))).toBe(
    "Not enough materials",
  );
});

test("countOf adds up every stack of an item", () => {
  const player = holding([
    ["copperOre", 20],
    ["", 0],
    ["herb", 3],
    ["copperOre", 2],
  ]);
  expect(countOf("copperOre", player)).toBe(22);
  expect(countOf("ironOre", player)).toBe(0);
});

test("materials across stacks are enough to make an item", () => {
  const player = holding([
    ["copperBar", 1],
    ["copperBar", 2],
  ]);
  expect(makeRefusal("copperSword", player)).toBeUndefined();
});

test("too low a Smithing level is refused with the level, whatever is held", () => {
  const player = holding([["ironBar", 20]], xpForLevel(9));
  expect(makeRefusal("ironSword", player)).toBe("Needs Smithing 10");
  expect(
    makeRefusal("ironSword", { ...player, smithingXp: xpForLevel(10) }),
  ).toBeUndefined();
});

test("a furnace row is refused on Mining, whatever the Smithing level", () => {
  const player = holding([["ironOre", 1]], xpForLevel(50), xpForLevel(9));
  expect(makeRefusal("ironBar", player)).toBe("Needs Mining 10");
  expect(
    makeRefusal("ironBar", { ...player, miningXp: xpForLevel(10) }),
  ).toBeUndefined();
  expect(
    makeRefusal("ironBar", holding([["ironOre", 1]], 0, xpForLevel(10))),
  ).toBeUndefined();
});

test("the level refusal looks only at the level, never the materials", () => {
  expect(levelRefusal("steelSword", holding([], xpForLevel(14)))).toBe(
    "Needs Smithing 15",
  );
  expect(
    levelRefusal("steelSword", holding([], xpForLevel(15))),
  ).toBeUndefined();
  expect(levelRefusal("steelBar", holding([], xpForLevel(50)))).toBe(
    "Needs Mining 15",
  );
});

test("too few materials are refused", () => {
  const player = holding([["copperBar", 2]]);
  expect(makeRefusal("copperSword", player)).toBe("Not enough materials");
});

test("the anvil needs a hammer and the furnace and range need nothing", () => {
  // Helped Odo, as the quest tests own the gate on the smithy's stations.
  const helped = { quests: ["odoCopper"], questStages: ["done"] };
  expect(stationRefusal("anvil", { tools: ["pickaxe"], ...helped })).toBe(
    "You need a hammer. The Blacksmith will give you one.",
  );
  expect(
    stationRefusal("anvil", { tools: ["hammer"], ...helped }),
  ).toBeUndefined();
  expect(stationRefusal("furnace", { tools: [], ...helped })).toBeUndefined();
  expect(stationRefusal("range", { tools: [], ...helped })).toBeUndefined();
});

describe("cooking at the range (#221)", () => {
  test("the base fish are gated on Cooking at 1, 10 and 20, the dishes 5 above them, the herb dishes 10", () => {
    const player = holding([["perch", 1]]);
    expect(makeRefusal("cookedPerch", player)).toBeUndefined();
    expect(
      makeRefusal("cookedTrout", holding([["trout", 1]], 0, 0, xpForLevel(9))),
    ).toBe("Needs Cooking 10");
    expect(
      makeRefusal(
        "herbPike",
        holding(
          [
            ["pike", 1],
            ["herb", 1],
          ],
          0,
          0,
          xpForLevel(29),
        ),
      ),
    ).toBe("Needs Cooking 30");
    expect(
      makeRefusal("berryPike", holding([["pike", 1]], 0, 0, xpForLevel(25))),
    ).toBe("Not enough materials");
  });

  test("food rolls Delicious by the improved-item formula, at the fish's gate and 0.2% a level to its 20% cap", () => {
    expect(cookedItem("cookedPerch", 1, rolling(0.0399))).toBe(
      "cookedPerch:delicious",
    );
    expect(cookedItem("cookedPerch", 1, rolling(0.04))).toBe("cookedPerch");
    expect(cookedItem("cookedTrout", 20, rolling(0.0599))).toBe(
      "cookedTrout:delicious",
    );
    // Cooked perch's gate is 1, so the cap arrives: 40 + 2 × 98 over it.
    expect(cookedItem("cookedPerch", 99, rolling(0.1999))).toBe(
      "cookedPerch:delicious",
    );
    expect(cookedItem("cookedPerch", 99, rolling(0.2))).toBe("cookedPerch");
  });

  test("a burn is 25% at the fish's gate, a percent less per level, floored at 0", () => {
    expect(burnPercent("cookedPerch", 1)).toBe(25);
    expect(burnPercent("cookedPerch", 30)).toBe(0);
    expect(burnPercent("cookedTrout", 10)).toBe(25);
    expect(burnPercent("cookedTrout", 11)).toBe(24);
    expect(burnPercent("berryPike", 30)).toBe(20);
  });
});

describe("crafting at the workbench (#225)", () => {
  test("rope, torch and vial are gated on Crafting at 1, 5 and 10", () => {
    expect(makeRefusal("rope", holding([["spiderSilk", 2]]))).toBeUndefined();
    expect(makeRefusal("rope", holding([["spiderSilk", 1]]))).toBe(
      "Not enough materials",
    );
    expect(
      makeRefusal(
        "torch",
        holding(
          [
            ["birchLog", 1],
            ["rope", 1],
          ],
          0,
          0,
          0,
          xpForLevel(4),
        ),
      ),
    ).toBe("Needs Crafting 5");
    expect(
      makeRefusal(
        "torch",
        holding(
          [
            ["birchLog", 1],
            ["rope", 1],
          ],
          0,
          0,
          0,
          xpForLevel(5),
        ),
      ),
    ).toBeUndefined();
    expect(
      makeRefusal(
        "vial",
        holding([["cinderglass", 1]], 0, 0, 0, xpForLevel(9)),
      ),
    ).toBe("Needs Crafting 10");
    expect(
      makeRefusal(
        "vial",
        holding([["cinderglass", 1]], 0, 0, 0, xpForLevel(10)),
      ),
    ).toBeUndefined();
  });

  test("the workbench needs no tool, like the furnace and range", () => {
    expect(stationRefusal("workbench", { tools: [] })).toBeUndefined();
  });
});

describe("smithing arrowheads and throwing knives (#228)", () => {
  test("a tier's arrowheads come from one bar, ten to the batch, gated at the bar's tier", () => {
    expect(
      makeRefusal("copperArrowhead", holding([["copperBar", 1]])),
    ).toBeUndefined();
    expect(
      makeRefusal("ironArrowhead", holding([["ironBar", 1]], xpForLevel(9))),
    ).toBe("Needs Smithing 10");
    expect(
      makeRefusal("steelArrowhead", holding([["steelBar", 1]], xpForLevel(14))),
    ).toBe("Needs Smithing 15");
    expect(
      makeRefusal("emberiteArrowhead", holding([["emberiteBar", 1]])),
    ).toBe("Needs Smithing 20");
    expect(
      makeRefusal(
        "emberiteArrowhead",
        holding([["emberiteBar", 1]], xpForLevel(20)),
      ),
    ).toBeUndefined();
  });

  test("a throwing knife costs one bar, and an Emberbone too at Emberite, mirroring the gear", () => {
    expect(
      makeRefusal("copperThrowingKnife", holding([["copperBar", 1]])),
    ).toBeUndefined();
    expect(
      makeRefusal(
        "emberiteThrowingKnife",
        holding([["emberiteBar", 1]], xpForLevel(20)),
      ),
    ).toBe("Not enough materials");
    expect(
      makeRefusal(
        "emberiteThrowingKnife",
        holding(
          [
            ["emberiteBar", 1],
            ["emberbone", 1],
          ],
          xpForLevel(20),
        ),
      ),
    ).toBeUndefined();
  });
});

describe("fletching at the workbench (#228)", () => {
  test("shafts come from any tier's log, ten to the batch, at Fletching 1", () => {
    expect(
      makeRefusal("arrowShaft", holding([["birchLog", 1]])),
    ).toBeUndefined();
    expect(makeRefusal("arrowShaft", holding([["oakLog", 1]]))).toBeUndefined();
    expect(
      makeRefusal("arrowShaft", holding([["charwoodLog", 1]])),
    ).toBeUndefined();
    expect(makeRefusal("arrowShaft", holding([["rope", 5]]))).toBe(
      "Not enough materials",
    );
    // Any log counts, so held amounts add up across the tiers.
    expect(
      heldOf(
        "log",
        holding([
          ["birchLog", 20],
          ["oakLog", 3],
        ]),
      ),
    ).toBe(23);
  });

  test("an arrow costs ten shafts, ten heads of its own tier and ten feathers, at Fletching 1", () => {
    expect(
      makeRefusal(
        "copperArrow",
        holding([
          ["arrowShaft", 10],
          ["copperArrowhead", 10],
          ["feather", 10],
        ]),
      ),
    ).toBeUndefined();
    // The head's tier is the arrow's, so a copper head doesn't fit an iron arrow.
    expect(
      makeRefusal(
        "ironArrow",
        holding([
          ["arrowShaft", 10],
          ["copperArrowhead", 10],
          ["feather", 10],
        ]),
      ),
    ).toBe("Not enough materials");
    expect(
      makeRefusal(
        "emberiteArrow",
        holding([
          ["arrowShaft", 10],
          ["emberiteArrowhead", 10],
        ]),
      ),
    ).toBe("Not enough materials");
  });

  test("bows cost their own wood and a rope, gated on Fletching at 1, 10 and 20", () => {
    expect(
      makeRefusal(
        "birchBow",
        holding([
          ["birchLog", 1],
          ["rope", 1],
        ]),
      ),
    ).toBeUndefined();
    expect(
      makeRefusal(
        "oakBow",
        holding(
          [
            ["oakLog", 1],
            ["rope", 1],
          ],
          0,
          0,
          0,
          0,
          xpForLevel(9),
        ),
      ),
    ).toBe("Needs Fletching 10");
    expect(
      makeRefusal(
        "charwoodBow",
        holding(
          [
            ["charwoodLog", 1],
            ["rope", 1],
          ],
          0,
          0,
          0,
          0,
          xpForLevel(19),
        ),
      ),
    ).toBe("Needs Fletching 20");
    expect(
      makeRefusal(
        "charwoodBow",
        holding(
          [
            ["charwoodLog", 1],
            ["rope", 1],
          ],
          0,
          0,
          0,
          0,
          xpForLevel(20),
        ),
      ),
    ).toBeUndefined();
    // The oak's rope isn't enough for the charwood bow.
    expect(
      makeRefusal(
        "charwoodBow",
        holding(
          [
            ["oakLog", 1],
            ["rope", 1],
          ],
          0,
          0,
          0,
          0,
          xpForLevel(20),
        ),
      ),
    ).toBe("Not enough materials");
  });

  test("a shaft's materials read as one log of any tier", () => {
    expect(materialLines("arrowShaft")).toEqual([["log", 1]]);
    expect(xpLines("arrowShaft")).toEqual([["fletchingXp", 2]]);
  });
});

describe("the gossamer cloak's augmentation (#217, #225)", () => {
  test("it is gated on Crafting 15, and needs the silk and a cape of any tier", () => {
    const crafting15 = xpForLevel(15);
    expect(
      makeRefusal("gossamerCloak", holding([["copperMightCape", 1]])),
    ).toBe("Needs Crafting 15");
    expect(makeRefusal("gossamerCloak", holding([], 0, 0, 0, crafting15))).toBe(
      "Not enough materials",
    );
    expect(
      makeRefusal(
        "gossamerCloak",
        holding([["spiderSilk", 1]], 0, 0, 0, crafting15),
      ),
    ).toBe("Not enough materials");
    expect(
      makeRefusal(
        "gossamerCloak",
        holding(
          [
            ["spiderSilk", 1],
            ["emberiteAvoidanceCape", 1],
          ],
          0,
          0,
          0,
          crafting15,
        ),
      ),
    ).toBeUndefined();
  });

  test("the first cape held is the one it works on, and an augmented one is no longer an input", () => {
    const player = holding(
      [
        ["copperMightCape:uncommon:fortitude", 1],
        ["bronzeFortitudeCape", 1],
        ["copperMightCape:rare:avoidance:gossamer", 1],
      ],
      0,
      0,
      0,
      xpForLevel(15),
    );
    expect(capeIn(player)).toBe("copperMightCape:uncommon:fortitude");
    expect(capesIn(player)).toBe(2);
    expect(
      capeIn(holding([["copperMightCape:rare:avoidance:gossamer", 1]])),
    ).toBeUndefined();
    expect(capesIn(holding([["copperSword", 1]]))).toBe(0);
  });

  test("a cloak's materials read as the silk and one cape of any tier", () => {
    expect(materialLines("gossamerCloak")).toEqual([
      ["spiderSilk", 1],
      ["cape", 1],
    ]);
    expect(xpLines("gossamerCloak")).toEqual([["craftingXp", 25]]);
    expect(materialLines("torch")).toEqual([
      ["birchLog", 1],
      ["rope", 1],
    ]);
  });

  test("the augmentation keeps #217's decided gate, wait and experience", () => {
    expect(AUGMENTATIONS.gossamerCloak).toEqual({
      skill: "Crafting",
      level: 15,
      reagent: "spiderSilk",
      ticks: 6,
      xp: 25,
    });
  });
});

/** A random source that returns `rolls` in order. */
const rolling =
  (...rolls: number[]) =>
  () =>
    rolls.shift()!;

describe("making improved gear (spec §2, §3)", () => {
  test("at the gate, 4% of pieces are improved", () => {
    expect(madeItem("ironSword", 10, rolling(0.0399, 0.5, 0))).toBe(
      "ironSword:uncommon:fortitude",
    );
    expect(madeItem("ironSword", 10, rolling(0.04))).toBe("ironSword");
  });

  test("each Smithing level above the gate adds 0.2%: Copper gear at 20 is 7.8%", () => {
    expect(madeItem("copperHelmet", 20, rolling(0.0779, 0.5, 0))).toBe(
      "copperHelmet:uncommon:fortitude",
    );
    expect(madeItem("copperHelmet", 20, rolling(0.078))).toBe("copperHelmet");
  });

  test("the chance stops at 20%", () => {
    expect(madeItem("copperSword", 99, rolling(0.1999, 0.5, 0))).toBe(
      "copperSword:uncommon:fortitude",
    );
    expect(madeItem("copperSword", 99, rolling(0.2))).toBe("copperSword");
  });

  test("one improved piece in five is rare", () => {
    expect(madeItem("copperShield", 1, rolling(0, 0.1999, 0))).toBe(
      "copperShield:rare:fortitude",
    );
    expect(madeItem("copperShield", 1, rolling(0, 0.2, 0))).toBe(
      "copperShield:uncommon:fortitude",
    );
  });

  test("each Virtue is a third of improved pieces, whatever the slot", () => {
    expect(madeItem("copperLeggings", 1, rolling(0, 0.5, 0.3333))).toBe(
      "copperLeggings:uncommon:fortitude",
    );
    expect(madeItem("copperLeggings", 1, rolling(0, 0.5, 0.3334))).toBe(
      "copperLeggings:uncommon:might",
    );
    expect(madeItem("copperLeggings", 1, rolling(0, 0.5, 0.6667))).toBe(
      "copperLeggings:uncommon:avoidance",
    );
    expect(madeItem("copperLeggings", 1, rolling(0, 0.5, 0.9999))).toBe(
      "copperLeggings:uncommon:avoidance",
    );
  });

  test("bars are never improved, and roll nothing", () => {
    const random = vi.fn(() => 0);
    expect(madeItem("copperBar", 1, random)).toBe("copperBar");
    expect(random).not.toHaveBeenCalled();
  });
});

describe("#238's Leatherworking and Jewelsmithing", () => {
  /** A player with the two skills' experience fields, holding `held`. */
  const learner = (held: [string, number][], leather = 0, jewels = 0) =>
    holding(held, 0, 0, 0, 0, 0, 0, leather, jewels);

  test("the hands and feet take their band's hides, the extra one at Bronze and Steel and an Emberbone at Emberite", () => {
    expect(materialLines("copperGloves")).toEqual([["tarnHide", 2]]);
    expect(materialLines("bronzeBoots")).toEqual([["tarnHide", 3]]);
    expect(materialLines("ironGloves")).toEqual([["bristleHide", 2]]);
    expect(materialLines("steelBoots")).toEqual([["bristleHide", 3]]);
    expect(materialLines("emberiteGloves")).toEqual([
      ["cinderHide", 2],
      ["emberbone", 1],
    ]);
    expect(
      makeRefusal(
        "emberiteBoots",
        learner([["cinderHide", 2]], xpForLevel(20)),
      ),
    ).toBe("Not enough materials");
    expect(
      makeRefusal(
        "emberiteBoots",
        learner(
          [
            ["cinderHide", 2],
            ["emberbone", 1],
          ],
          xpForLevel(19),
        ),
      ),
    ).toBe("Needs Leatherworking 20");
    expect(
      makeRefusal(
        "emberiteBoots",
        learner(
          [
            ["cinderHide", 2],
            ["emberbone", 1],
          ],
          xpForLevel(20),
        ),
      ),
    ).toBeUndefined();
  });

  test("the capes take two of the band's hides and a rope, at the piece's tier, for 15–75", () => {
    expect(materialLines("copperMightCape")).toEqual([
      ["tarnHide", 2],
      ["rope", 1],
    ]);
    expect(materialLines("emberiteAvoidanceCape")).toEqual([
      ["cinderHide", 2],
      ["rope", 1],
    ]);
    expect(xpLines("copperMightCape")).toEqual([["leatherworkingXp", 15]]);
    expect(xpLines("emberiteAvoidanceCape")).toEqual([
      ["leatherworkingXp", 75],
    ]);
    expect(
      makeRefusal("bronzeMightCape", learner([["tarnHide", 3]], xpForLevel(5))),
    ).toBe("Not enough materials");
    expect(
      makeRefusal(
        "bronzeMightCape",
        learner(
          [
            ["tarnHide", 2],
            ["rope", 1],
          ],
          xpForLevel(4),
        ),
      ),
    ).toBe("Needs Leatherworking 5");
    expect(
      makeRefusal(
        "bronzeMightCape",
        learner(
          [
            ["tarnHide", 2],
            ["rope", 1],
          ],
          xpForLevel(5),
        ),
      ),
    ).toBeUndefined();
  });

  test("the necks and rings take a bar, and a tier-matched gem from Iron up", () => {
    expect(materialLines("copperAmulet")).toEqual([["copperBar", 1]]);
    expect(materialLines("bronzeRing")).toEqual([["bronzeBar", 1]]);
    expect(materialLines("ironAmulet")).toEqual([
      ["ironBar", 1],
      ["ashstone", 1],
    ]);
    expect(materialLines("steelRing")).toEqual([
      ["steelBar", 1],
      ["cinderglass", 1],
    ]);
    expect(materialLines("emberiteAmulet")).toEqual([
      ["emberiteBar", 1],
      ["heartflame", 1],
    ]);
    expect(
      makeRefusal(
        "steelRing",
        learner(
          [
            ["steelBar", 1],
            ["cinderglass", 1],
          ],
          0,
          xpForLevel(14),
        ),
      ),
    ).toBe("Needs Jewelsmithing 15");
    expect(
      makeRefusal(
        "steelRing",
        learner(
          [
            ["steelBar", 1],
            ["cinderglass", 1],
          ],
          0,
          xpForLevel(15),
        ),
      ),
    ).toBeUndefined();
  });
});

describe("the Making skills table", () => {
  test("each Making skill's field is its own in SKILLS, and every recipe names one", () => {
    for (const [skill, { xpField }] of Object.entries(MAKING_SKILLS))
      expect(SKILLS).toContainEqual([skill, xpField]);
    for (const { skill } of Object.values(RECIPES))
      expect(MAKING_SKILLS).toHaveProperty(skill);
  });

  test("Cooking is made at the range or a fire, and its make walks to the range (#224)", () => {
    expect(MAKING_SKILLS.Cooking.places).toEqual(["range", "fire"]);
    expect(stationOf("cookedPerch")).toBe("range");
    expect(stationOf("gossamerCloak")).toBe("workbench");
  });
});

describe("make", () => {
  /** Hands out these rolls in order, then fails the test if asked for more. */
  const rolls = (...values: number[]) =>
    vi.fn(() => {
      if (!values.length) throw new Error("rolled too often");
      return values.shift()!;
    });

  test("swaps the materials for the product and its experience, leaving the player as it was", () => {
    const player = holding([
      ["copperOre", 2],
      ["", 0],
    ]);
    expect(make("copperBar", player, rolls())).toEqual({
      inventory: ["copperOre", "copperBar"],
      inventoryCounts: [1, 1],
      xp: [["miningXp", 2]],
      made: "copperBar",
    });
    expect(player.inventoryCounts).toEqual([2, 0]);
  });

  test("refuses what can't be made right now, rolling nothing", () => {
    const random = rolls();
    expect(make("copperBar", holding([["", 0]]), random)).toEqual({
      refused: "Not enough materials",
    });
    expect(random).not.toHaveBeenCalled();
  });

  test("a log cost takes the first log held, of any tier, and makes the whole batch (#228)", () => {
    const outcome = make(
      "arrowShaft",
      holding([
        ["oakLog", 1],
        ["birchLog", 1],
        ["", 0],
      ]),
      rolls(),
    );
    expect(outcome).toMatchObject({
      inventory: ["arrowShaft", "birchLog", ""],
      inventoryCounts: [10, 1, 0],
      xp: [["fletchingXp", 2]],
    });
  });

  test("at a rune's doubling level one essence makes two runes, each paying (#232)", () => {
    const player = holding([
      ["runeEssence", 1],
      ["", 0],
    ]);
    player.runecraftingXp = xpForLevel(2);
    expect(make("airRune", player, rolls())).toMatchObject({
      inventory: ["airRune", ""],
      inventoryCounts: [2, 0],
      xp: [["runecraftingXp", RECIPES.airRune.xp * 2]],
    });
  });

  test("a burn eats the fish and pays nothing, and Make all goes on (#221)", () => {
    expect(make("cookedPerch", holding([["perch", 2]]), rolls(0))).toEqual({
      inventory: ["perch"],
      inventoryCounts: [1],
      xp: [],
      told: { line: "You burn the [Cooked perch].", items: ["cookedPerch"] },
    });
  });

  test("a fire's burn points add to the burn chance (#224)", () => {
    // At Cooking 26 a perch never burns at the range.
    const player = holding([["perch", 1]], 0, 0, xpForLevel(26));
    expect(make("cookedPerch", player, rolls(0.1, 0.99), 0)).toMatchObject({
      made: "cookedPerch",
    });
    expect(make("cookedPerch", player, rolls(0.1), 20)).toMatchObject({
      told: { line: "You burn the [Cooked perch].", items: ["cookedPerch"] },
    });
  });

  test("cooked food rolls Delicious after the burn, never improved (#221)", () => {
    expect(
      make(
        "cookedPerch",
        holding([
          ["perch", 1],
          ["", 0],
        ]),
        rolls(0.99, 0),
      ),
    ).toMatchObject({ made: "cookedPerch:delicious" });
  });

  test("gear rolls improved, then rare, then its Virtue (spec §2)", () => {
    expect(
      make("copperChestplate", holding([["copperBar", 5]]), rolls(0, 0, 0)),
    ).toMatchObject({ made: `copperChestplate:rare:${VIRTUES[0]}` });
  });

  test("no room for the product refuses after the burn roll and before any other", () => {
    const random = rolls(0.99);
    expect(
      make(
        "cookedPerch",
        holding([
          ["perch", 2],
          ["tin", 1],
        ]),
        random,
      ),
    ).toEqual({ refused: "Your inventory is full." });
    expect(random).toHaveBeenCalledTimes(1);
  });

  test("an augmentation turns the first cape into its gossamer variant with no roll (#217, #225)", () => {
    const player = holding(
      [
        ["spiderSilk", 1],
        ["copperMightCape:uncommon:fortitude", 1],
      ],
      0,
      0,
      0,
      xpForLevel(15),
    );
    expect(make("gossamerCloak", player, rolls())).toEqual({
      inventory: ["copperMightCape:uncommon:fortitude:gossamer", ""],
      inventoryCounts: [1, 0],
      xp: [["craftingXp", 25]],
      made: "copperMightCape:uncommon:fortitude:gossamer",
    });
  });
});
