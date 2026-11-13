import { VILLAGERS } from "./dialogue.ts";
import { QUESTS, questDoneOf, type QuestId } from "./quests.ts";
import { toolRefusal, type Tool } from "./tools.ts";

/** What a fixed station needs before it opens: a tool held, and a quest done. */
type StationRow = { tool?: Tool; quest?: QuestId };

/**
 * Every station a map places on its tiles: a furnace smelts ore, an anvil makes gear, a range
 * cooks food (#221), a workbench crafts utilities (#225) and an altar makes runes (#232). The
 * smithy's furnace and anvil open only once Odo's quest is done (#231), and the anvil needs a hammer.
 */
export const STATIONS = {
  furnace: { quest: "odoCopper" },
  anvil: { tool: "hammer", quest: "odoCopper" },
  range: {},
  workbench: {},
  altar: {},
} as const satisfies Record<string, StationRow>;
export type FixedStation = keyof typeof STATIONS;
/** A fixed station, or a fire, which a player places and which burns out, so no tile is one (#224). */
export type StationKind = FixedStation | "fire";

/** Why a click on this station is refused, or undefined if it isn't. The client shows it, and the server ignores the pick. A fire is never refused here. */
export function stationRefusal(
  station: StationKind,
  player: {
    tools: Iterable<string>;
    quests?: Iterable<unknown>;
    questStages?: Iterable<unknown>;
  },
) {
  if (station === "fire") return undefined;
  const { tool, quest }: StationRow = STATIONS[station];
  const noTool = tool && toolRefusal(tool, player);
  if (noTool) return noTool;
  if (quest && !questDoneOf(player, quest))
    return `You need to help ${VILLAGERS[QUESTS[quest].villager].name} first.`;
  return undefined;
}
