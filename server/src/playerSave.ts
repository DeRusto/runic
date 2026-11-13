import { ArraySchema } from "@colyseus/schema";
import {
  BANK_SLOTS,
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  QUEST_DONE,
  STARTING_HEALTH,
  STARTING_HITPOINTS_XP,
  SKILLS,
  STARTING_PINNED_SKILLS,
  type Tile,
} from "@runic/shared";
import { getTableColumns } from "drizzle-orm";
import { players } from "./schema.ts";
import type { PlayerSave } from "./saves.ts";
import type { Player } from "./simulation.ts";

/** Every column of the save, so a new column is saved without touching this file. */
const SAVED_FIELDS = Object.keys(getTableColumns(players)).filter(
  (field) => field !== "accountId",
) as (keyof PlayerSave)[];

/** Every skill at 0 experience. */
export const NO_EXPERIENCE = Object.fromEntries(
  SKILLS.map(([, field]) => [field, 0]),
) as Record<(typeof SKILLS)[number][1], number>;

/** A new account's save, standing on `tile`. */
export const newSave = (tile: Tile): PlayerSave => ({
  ...tile,
  ...NO_EXPERIENCE,
  hitpointsXp: STARTING_HITPOINTS_XP,
  health: STARTING_HEALTH,
  inventory: Array<string>(INVENTORY_SLOTS).fill(EMPTY_SLOT),
});

/** A save's fields as the synced player holds them, filling in what older saves lack.
 * The quest record is excluded: it isn't a synced field — the player holds the quest ids
 * with the stages parallel (#231), and whoever builds the player reads it from the save. */
export function syncedOf(save: PlayerSave) {
  const {
    inventory,
    inventoryCounts = [],
    pinnedSkills = STARTING_PINNED_SKILLS,
    tools = [],
    bank = [],
    bankCounts = [],
    quests: questProgress = {},
    ...fields
  } = save;
  void questProgress;
  return {
    ...fields,
    pinnedSkills: new ArraySchema(...pinnedSkills),
    tools: new ArraySchema(...tools),
    inventory: new ArraySchema(...inventory),
    // A filled slot with no count is a stack of 1: every existing save's food (spec §6).
    inventoryCounts: new ArraySchema(
      ...inventory.map((item, slot) =>
        item === EMPTY_SLOT ? 0 : inventoryCounts[slot] || 1,
      ),
    ),
    // A save from before the bank has none, so it starts empty (village spec §6).
    bank: new ArraySchema(
      ...Array.from(
        { length: BANK_SLOTS },
        (_, slot) => bank[slot] ?? EMPTY_SLOT,
      ),
    ),
    bankCounts: new ArraySchema(
      ...Array.from({ length: BANK_SLOTS }, (_, slot) => bankCounts[slot] ?? 0),
    ),
  };
}

/** What to write to the database for this player: every column, read from the synced player.
 * A quest's synced ids and stages become the progress record the save holds (#231); the caller
 * that knows the unsynced state adds each quest's repeat turn-ins. */
export function saveOf(player: InstanceType<typeof Player>): PlayerSave {
  const saved = Object.fromEntries(
    SAVED_FIELDS.map((field) => {
      const value = player[field];
      return [field, value instanceof ArraySchema ? [...value] : value];
    }),
  ) as Record<string, unknown>;
  if (Array.isArray(saved.quests)) {
    saved.quests = Object.fromEntries(
      (saved.quests as string[]).map((quest, at) => [
        quest,
        { stage: (player.questStages[at] as string) ?? QUEST_DONE },
      ]),
    );
  }
  return saved as unknown as PlayerSave;
}
