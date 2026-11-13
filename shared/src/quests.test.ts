import {
  ITEMS,
  nodesOf,
  openingNodeOf,
  QUESTS,
  QUEST_DONE,
  questDoneOf,
  questOfVillager,
  questStageOf,
  stageOf,
  stationRefusal,
  type Quest,
} from "@runic/shared";
import { describe, expect, test } from "vitest";

describe("the quest engine", () => {
  test("every quest's villager exists, its stages name real nodes, and its turn-ins name real items", () => {
    for (const quest of Object.values(QUESTS)) {
      expect(questOfVillager(quest.villager)?.id).toBe(quest.id);
      const nodes = nodesOf(quest.villager);
      expect(nodes[quest.doneNode]).toBeDefined();
      if (quest.repeat) expect(nodes[quest.repeat.node]).toBeDefined();
      for (const stage of quest.stages) {
        expect(stageOf(quest, stage.id)).toBe(stage);
        expect(nodes[stage.node]).toBeDefined();
        if (stage.turnIn) expect(ITEMS[stage.turnIn.item]).toBeDefined();
      }
      if (quest.repeat) expect(ITEMS[quest.repeat.turnIn.item]).toBeDefined();
    }
  });

  test("a stage without a turn-in, and one with, both come off the tables", () => {
    const quest: Quest = {
      id: "test",
      title: "Test",
      villager: "odo",
      points: 1,
      stages: [
        { id: "asked", node: "greet", journal: "Asked." },
        {
          id: "brought",
          node: "quest",
          journal: "Brought.",
          turnIn: { item: "copperOre", count: 1 },
        },
      ],
      doneNode: "forge",
    };
    expect(stageOf(quest, "asked")?.turnIn).toBeUndefined();
    expect(stageOf(quest, "brought")?.turnIn).toEqual({
      item: "copperOre",
      count: 1,
    });
  });

  test("how far along a quest a player is comes off their quest ids and parallel stages", () => {
    const helped = {
      quests: ["odoCopper"],
      questStages: [QUEST_DONE],
    };
    expect(questStageOf(helped, "odoCopper")).toBe(QUEST_DONE);
    expect(questDoneOf(helped, "odoCopper")).toBe(true);
    expect(questDoneOf({ quests: [], questStages: [] }, "odoCopper")).toBe(
      false,
    );
    // A player without either field, as the old refusals' plain test objects are.
    expect(questDoneOf({}, "odoCopper")).toBe(false);
  });
});

describe("the villager's conversation opens by the player's progress", () => {
  test("not started, it opens with the villager's own start", () => {
    expect(openingNodeOf("odo", undefined)).toBe("greet");
    expect(openingNodeOf("marta", undefined)).toBe("greet");
    expect(openingNodeOf("marta", { stage: "fetch", turns: 0 })).toBe("greet");
  });

  test("on a stage, it opens with that stage's node", () => {
    expect(openingNodeOf("odo", { stage: "fetch", turns: 0 })).toBe("quest");
  });

  test("done, it opens with the repeats' node while turn-ins are left, and the forge's after", () => {
    const repeat = QUESTS.odoCopper.repeat!;
    expect(openingNodeOf("odo", { stage: QUEST_DONE, turns: 0 })).toBe(
      repeat.node,
    );
    expect(
      openingNodeOf("odo", { stage: QUEST_DONE, turns: repeat.turns }),
    ).toBe(QUESTS.odoCopper.doneNode);
  });
});

describe("the smithy's stations are Odo's to open", () => {
  /** Odo's quest done, as a player's quest ids and parallel stages hold it. */
  const helped = {
    tools: ["pickaxe", "hammer"],
    quests: ["odoCopper"],
    questStages: [QUEST_DONE],
  };
  const unhelped = { tools: ["pickaxe", "hammer"] };

  test("the furnace and anvil refuse a player who hasn't helped Odo first", () => {
    expect(stationRefusal("furnace", unhelped)).toBe(
      "You need to help Odo first.",
    );
    expect(stationRefusal("anvil", unhelped)).toBe(
      "You need to help Odo first.",
    );
    expect(stationRefusal("furnace", helped)).toBeUndefined();
    expect(stationRefusal("anvil", helped)).toBeUndefined();
  });

  test("the anvil's hammer is asked for before the quest, as it always was", () => {
    expect(stationRefusal("anvil", { tools: ["pickaxe"] })).toBe(
      "You need a hammer. The Blacksmith will give you one.",
    );
  });

  test("the range, fire and workbench need neither", () => {
    for (const station of ["range", "fire", "workbench"] as const)
      expect(stationRefusal(station, unhelped)).toBeUndefined();
  });
});
