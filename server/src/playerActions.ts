import type {
  DialogueAction,
  FireLog,
  GatheringSkill,
  MakeItem,
  PickpocketTarget,
  StallKind,
  StrongboxKind,
  Tile,
  VillagerId,
  Virtue,
} from "@runic/shared";
import type { Busy } from "./busy.ts";

/**
 * What a player is doing, beyond walking. Fighting, gathering, making and lighting are also
 * their synced `PlayerAction`; the rest show as walking while a path remains, and idle after.
 */
export type UnsyncedAction =
  | { kind: "fighting"; enemy: string }
  | { kind: GatheringSkill; site: string }
  | {
      kind: "visiting";
      villager: VillagerId;
      then?: Exclude<DialogueAction, "quest">;
    }
  | { kind: "taking"; groundItem: string }
  | { kind: "following"; player: string }
  /** One attempt on arrival, once the attempt interval allows (#250). */
  | { kind: "pickpocketing"; target: PickpocketTarget }
  /** One theft on arrival, once the attempt interval allows (#252). */
  | { kind: "stealing"; stall: StallKind }
  /** One attempt on arrival, once the attempt interval allows (#253). */
  | { kind: "opening"; strongbox: StrongboxKind }
  /**
   * `item` is a recipe's product or an augmentation (#225), `all` for Make all, and `at` names
   * the fire a range recipe cooks at (#224). `doneTick` stays unset until arrival starts the
   * first wait.
   */
  | {
      kind: "making";
      item: MakeItem;
      all: boolean;
      at?: Tile;
      doneTick?: number;
    }
  /** The log is already burnt: a new click or a death during the lighting loses it (#224). */
  | { kind: "lighting"; log: FireLog; doneTick: number };

/** A click waiting for the next tick, named for the action it starts. */
export type QueuedAction =
  | { kind: "walking"; to: Tile }
  | { kind: "fighting"; enemy: string }
  | { kind: "gathering"; skill: GatheringSkill; site: string }
  | {
      kind: "visiting";
      villager: VillagerId;
      then?: Exclude<DialogueAction, "quest">;
    }
  | { kind: "making"; item: MakeItem; all: boolean; at?: Tile }
  | { kind: "lighting"; slot: number }
  | { kind: "taking"; groundItem: string }
  | { kind: "following"; player: string }
  | { kind: "pickpocketing"; target: PickpocketTarget }
  | { kind: "stealing"; stall: StallKind }
  | { kind: "opening"; strongbox: StrongboxKind };

/** What a player's action and timers need that clients don't. */
export type UnsyncedPlayer = {
  path: Tile[];
  nextStepTick: number;
  nextSwingTick: number;
  action?: UnsyncedAction;
  /** Outlives the action, so clicking again can't beat the attempt interval. */
  nextAttemptTick: number;
  nextEatTick: number;
  /** What each healing tick still to come gives, in eating order. Not saved, so leaving loses it (spec §6). */
  healingPool: number[];
  /** A Delicious fish's buff, or none: its fish's per-tick heal, when it next heals and the tick it runs out on. Not saved (spec §6, #221). */
  delicious?: { perTick: number; nextHealTick: number; endTick: number };
  /**
   * A Virtue potion's buff, or none: its Virtue, the tick it runs out on and the health
   * a Fortitude one added, which the hit and Avoidance read from too. Not saved
   * (spec §6, #222).
   */
  potion?: { virtue: Virtue; endTick: number; bonus: number };
  /** The combat lock runs until this tick. */
  lockEndTick: number;
  /** A stun, or later Agility's crossing (#236). Not saved: leaving ends it. */
  busy?: Busy;
  respawnTick: number;
  /** Each started quest's progress, by quest id, kept for the save (#231). */
  quests: Map<string, { stage: string; turns: number }>;
  dropped?: boolean;
};
