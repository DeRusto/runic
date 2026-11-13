import { VILLAGERS, type VillagerId } from "./dialogue.ts";
import type { ItemId } from "./items.ts";
import type { XpField } from "./skills.ts";
import type { Tool } from "./tools.ts";

/** What a stage's turn-in asks the player to hand over: the item and how many of it. */
export type QuestTurnIn = { item: ItemId; count: number };

/** One step of a quest: the node its villager's conversation opens with, what the journal shows while it is current, and the turn-in that finishes it. */
export type QuestStage = {
  id: string;
  /** The villager node whose choices this stage's conversation opens with. */
  node: string;
  /** What the journal shows while the player is on this stage. */
  journal: string;
  /** What the player hands over to finish the stage; a stage without one finishes when its choice is picked. */
  turnIn?: QuestTurnIn;
};

/** The turn-ins a villager still takes after their quest is done, each paying experience (#75's repeatable reward). */
export type QuestRepeat = {
  /** The node the conversation opens with while turn-ins are left. */
  node: string;
  /** How many turn-ins the villager takes in all, beyond the quest's own. */
  turns: number;
  turnIn: QuestTurnIn;
  /** The experience each turn-in pays, and the skill it pays. */
  xp: number;
  xpField: XpField;
};

/** A quest, as data: its stages, its points, and the nodes its villager opens with on the way through. */
export type Quest = {
  /** The id saves and state key progress by, as the table's key names. */
  id: string;
  /** The title the journal shows. */
  title: string;
  /** The villager who gives the quest and takes its turn-ins. */
  villager: VillagerId;
  /** The quest points finishing it awards. */
  points: number;
  /** The tools the villager hands over when the quest starts, for the work it asks. */
  gives?: readonly Tool[];
  stages: QuestStage[];
  repeat?: QuestRepeat;
  /** The node the conversation opens with once the quest and its turn-ins are all done. */
  doneNode: string;
};

/** Every quest, by id. Add one by adding a row (#231). */
export const QUESTS = {
  // The Blacksmith's quest, wired from the owner's prototype lines (#195, #231). Odo asks for
  // a copper ore, hands over a pickaxe for the work, and his forge opens for the quest done;
  // three more ores after that pay Mining, for what he teaches about the veins (#75).
  odoCopper: {
    id: "odoCopper",
    title: "Ore for the forge",
    villager: "odo",
    points: 1,
    gives: ["pickaxe"],
    stages: [
      {
        id: "fetch",
        node: "quest",
        journal: "Odo wants one copper ore from the vein past the east road.",
        turnIn: { item: "copperOre", count: 1 },
      },
    ],
    repeat: {
      node: "repeat",
      turns: 3,
      turnIn: { item: "copperOre", count: 1 },
      // Twice what mining the ore itself pays (spec §3), for Odo's teaching.
      xp: 12,
      xpField: "miningXp",
    },
    doneNode: "forge",
  },
} as const satisfies Record<string, Quest>;
export type QuestId = keyof typeof QUESTS;

/** A quest's stage string once it is finished. */
export const QUEST_DONE = "done";

/** One quest's per-player progress: the stage's id, or "done", and the repeat turn-ins done. */
export type QuestProgress = { stage: string; turns: number };

/** The quest this villager gives, or undefined when they give none. */
export const questOfVillager = (villager: VillagerId): Quest | undefined =>
  Object.values(QUESTS).find((quest) => quest.villager === villager);

/** The stage of `quest` this progress names, or undefined when the quest is done or the stage isn't one of its stages. */
export const stageOf = (quest: Quest, stage?: string) =>
  quest.stages.find((entry) => entry.id === stage);

/**
 * How far along `quest` this player is, read from their quest ids and the parallel stages,
 * or undefined when they haven't started it. A player without either field has none.
 */
export function questStageOf(
  player: { quests?: Iterable<unknown>; questStages?: Iterable<unknown> },
  quest: QuestId,
) {
  const at = [...(player.quests ?? [])].indexOf(quest);
  return at < 0
    ? undefined
    : ([...(player.questStages ?? [])][at] as string | undefined);
}

/** Whether this player has finished `quest`. */
export const questDoneOf = (
  player: Parameters<typeof questStageOf>[0],
  quest: QuestId,
) => questStageOf(player, quest) === QUEST_DONE;

/** The node `villager`'s conversation opens with for a player at `progress`, or their own start when they give no quest or it isn't started (#231). */
export function openingNodeOf(
  villager: VillagerId,
  progress?: QuestProgress,
): string {
  const quest = questOfVillager(villager);
  if (!quest || !progress) return VILLAGERS[villager].start;
  if (progress.stage === QUEST_DONE)
    return progress.turns < (quest.repeat?.turns ?? 0)
      ? quest.repeat!.node
      : quest.doneNode;
  return stageOf(quest, progress.stage)?.node ?? VILLAGERS[villager].start;
}
