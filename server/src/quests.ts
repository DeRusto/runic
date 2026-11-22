import { ArraySchema } from "@colyseus/schema";
import {
  addXp,
  aTool,
  countOf,
  currentQuestOf,
  identifyEssence,
  itemTag,
  openingNodeOf,
  QUEST_DONE,
  QUESTS,
  removeItems,
  stageOf,
  turnInsOf,
  VILLAGERS,
  type ItemId,
  type Quest,
  type QuestId,
  type QuestTurnIn,
  type Tool,
  type Villager,
  type VillagerId,
} from "@runic/shared";
import type { SyncedPlayer, World } from "./worldContext.ts";

/** Villagers' quests and the tools they hand over: starting, turning in and finishing (#231, #232). Each player's progress lives on their unsynced side, and the synced arrays copy it. */
export class Quests {
  constructor(private readonly world: World) {}

  giveTools(id: string, villager: VillagerId, given?: readonly Tool[]) {
    const player = this.world.state.players.get(id)!;
    const { name, tools = [] }: Villager = VILLAGERS[villager];
    const lacking = (given ?? tools).filter(
      (tool) => !player.tools.includes(tool),
    );
    if (!lacking.length) return;
    player.tools.push(...lacking);
    const line = `${name} gives you ${lacking.map(aTool).join(" and ")}.`;
    this.world.events.push({ type: "told", player: id, line });
  }

  /** Each quest's stage and repeat turn-ins done, for the save beside the xp columns (#231). */
  progressOf(id: string) {
    const player = this.world.player(id);
    return Object.fromEntries(
      [...player.quests].map((quest, at) => [
        quest,
        {
          stage: player.questStages[at]!,
          turns:
            this.world.unsyncedPlayers.get(id)?.quests.get(quest)?.turns ?? 0,
        },
      ]),
    );
  }

  /** Rewrites the player's synced quest arrays from their unsynced progress (#231). */
  private syncQuests(id: string) {
    const player = this.world.state.players.get(id)!;
    const quests = this.world.unsyncedPlayers.get(id)!.quests;
    player.quests = new ArraySchema(...quests.keys());
    player.questStages = new ArraySchema(
      ...[...quests.values()].map(({ stage }) => stage),
    );
  }

  /**
   * Runs the quest of this villager's chain that the player is on, for the choice picked:
   * starting it, or turning in the stage's or a repeat's items. False when what it asks for
   * isn't there yet, so the talk stays on the node (#231, #232).
   */
  advanceQuest(id: string, villager: VillagerId) {
    const quest = currentQuestOf(
      villager,
      this.world.unsyncedPlayers.get(id)!.quests,
    );
    if (!quest) return false;
    const player = this.world.state.players.get(id)!;
    const progress = this.world.unsyncedPlayers.get(id)!.quests.get(quest.id);
    return progress
      ? this.advanceStage(id, player, quest, progress)
      : this.startQuest(id, player, quest);
  }

  /** Sets the first stage, and hands over the work's tools. It fails only while a quest it needs isn't done. */
  private startQuest(id: string, player: SyncedPlayer, quest: Quest) {
    const { needs } = quest;
    if (
      needs &&
      this.world.unsyncedPlayers.get(id)!.quests.get(needs.quest)?.stage !==
        QUEST_DONE
    ) {
      this.world.events.push({ type: "told", player: id, line: needs.line });
      return false;
    }
    this.world.unsyncedPlayers
      .get(id)!
      .quests.set(quest.id, { stage: quest.stages[0]!.id, turns: 0 });
    if (quest.gives) this.giveTools(id, quest.villager, quest.gives);
    this.syncQuests(id);
    return true;
  }

  /** Moves a started quest on one stage, taking its turn-in or a repeat's, and finishes it with its points. */
  private advanceStage(
    id: string,
    player: SyncedPlayer,
    quest: Quest,
    progress: { stage: string; turns: number },
  ) {
    if (progress.stage === QUEST_DONE) {
      const repeat = quest.repeat;
      if (!repeat || progress.turns >= repeat.turns) return false;
      if (!this.takeTurnIn(id, player, repeat.turnIn)) return false;
      progress.turns++;
      // Quest experience earns no Mastery share (glossary: Mastery).
      player[repeat.xpField] = addXp(player[repeat.xpField], repeat.xp);
      return true;
    }
    const stage = stageOf(quest, progress.stage)!;
    if (!this.takeTurnIn(id, player, ...turnInsOf(stage))) return false;
    const next = quest.stages[quest.stages.indexOf(stage) + 1];
    if (next) progress.stage = next.id;
    else {
      progress.stage = QUEST_DONE;
      player.questPoints += quest.points;
      // Odo's teaching sets the flag at once, and every strange material the player holds,
      // bank included, turns with it (#232).
      if (quest.teaches === "essence") {
        player.identifiesEssence = true;
        identifyEssence(player);
      }
      this.world.events.push({
        type: "told",
        player: id,
        line: `You finish ${quest.title}. You earn ${quest.points} quest point${quest.points === 1 ? "" : "s"}.`,
      });
    }
    this.syncQuests(id);
    return true;
  }

  /** Takes every turn-in out of the inventory together, or none and says the first that's missing. */
  private takeTurnIn(
    id: string,
    player: SyncedPlayer,
    ...turnIns: QuestTurnIn[]
  ) {
    const missing = turnIns.find(
      ({ item, count }) => countOf(item, player) < count,
    );
    if (missing) {
      this.world.events.push({
        type: "told",
        player: id,
        line: `You have no ${itemTag(missing.item)} to hand over.`,
        items: [missing.item],
      });
      return false;
    }
    for (const { item, count } of turnIns)
      removeItems(player.inventory, player.inventoryCounts, item, count);
    return true;
  }

  /** The quest stages this player is on now. */
  private currentStages(id: string) {
    return [...this.world.unsyncedPlayers.get(id)!.quests].flatMap(
      ([questId, { stage }]) =>
        stageOf(QUESTS[questId as QuestId], stage) ?? [],
    );
  }

  /** Whether a stage this player is on still asks for more of `item` than they hold: its turn-in's count, or 1 for an item it only finds. */
  questWants(id: string, item: ItemId) {
    const held = countOf(item, this.world.state.players.get(id)!);
    return this.currentStages(id).some((stage) => {
      const asked = turnInsOf(stage).find((turnIn) => turnIn.item === item);
      const finds = stage.veinFinds?.some((roll) => roll.item === item);
      return (asked || finds) && held < (asked?.count ?? 1);
    });
  }

  /** The quest items a successful mine on a vein of `vein` gives this player, from the stages they're on, while each still wants more (Runestone Hollow spec §4). */
  questVeinFinds(id: string, vein: string) {
    return this.currentStages(id).flatMap((stage) =>
      (stage.veinFinds ?? []).flatMap((roll) =>
        roll.vein === vein &&
        this.questWants(id, roll.item) &&
        this.world.random() < roll.chance
          ? [roll.item]
          : [],
      ),
    );
  }

  /** The node this villager's conversation opens with: the chain's current quest's stage-appropriate one, or their own start (#231, #232). */
  openingNode(id: string, villager: VillagerId) {
    return openingNodeOf(villager, this.world.unsyncedPlayers.get(id)!.quests);
  }
}
