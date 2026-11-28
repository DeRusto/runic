import { playerStyleOf } from "@runic/shared";
import type {
  DialogueAction,
  FireLog,
  GatheringSkill,
  MakeItem,
  ObstacleKind,
  PickpocketTarget,
  StallKind,
  StrongboxKind,
  Style,
  Tile,
  VillagerId,
  Virtue,
} from "@runic/shared";
import type { Busy } from "./busy.ts";

/** A click on an obstacle, to walk to whichever end of it is nearer once it applies. */
type CrossObstacle = { kind: "approachingObstacle"; obstacle: ObstacleKind };

/** Walking to `from`, the end of the obstacle the crossing starts at. */
type ApproachObstacle = CrossObstacle & { from: Tile };

/** A crossing under way: it lands on `landing`, or back on `from` if it fails. */
export type Crossing = { obstacle: ObstacleKind; from: Tile; landing: Tile };

/** Praying or offering bones at the shrine on `shrine`, which the player walks next to first. */
export type ShrineAction = { kind: "praying" | "offering"; shrine: Tile };
/** An offering under way: the next bone goes on `nextOfferTick`, set on arrival. */
export type OfferingAction = ShrineAction & {
  kind: "offering";
  nextOfferTick?: number;
};

/**
 * What a player is doing, beyond walking. Fighting, gathering, making and lighting are also
 * their synced `PlayerAction`; the rest show as walking while a path remains, and idle after.
 */
export type UnsyncedAction =
  | { kind: "praying"; shrine: Tile }
  | OfferingAction
  | ApproachObstacle
  | { kind: "burying"; slot: number; item: string; doneTick: number }
  /** `style` is the weapon in hand's when it began, so taking a bow or staff off ends it rather than turning it to melee (#277). */
  | { kind: "fighting"; enemy: string; style: Style }
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

/** Whether the bow or staff an attack began with has left the hand, which ends the attack rather than turning it to melee (#277). */
export const lostWeaponFor = (
  { style }: { style: Style },
  player: Parameters<typeof playerStyleOf>[0],
) => style !== "melee" && playerStyleOf(player) !== style;

/** A click waiting for the next tick, named for the action it starts. */
export type QueuedAction =
  | ShrineAction
  | CrossObstacle
  | { kind: "burying"; slot: number; item: string }
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
  /** Drain carried between ticks, in points per `PRAYER_DRAIN_TICKS`, so drain is exact over time. Session only (Prayer spec §5). */
  prayerDrainCarried?: number;
  /** The combat lock runs until this tick. */
  lockEndTick: number;
  /** A stun or an Agility crossing (#236). Not saved: leaving ends it. */
  busy?: Busy;
  /** The crossing in progress until the busy state ends. Session only. */
  crossing?: Crossing;
  /** Number of obstacles crossed in order in the current lap. Session only. */
  courseProgress?: number;
  respawnTick: number;
  /** The enemy the player's last throwing knife was thrown at, which they don't punch back until their next order (#279). Session only. */
  ranDryAgainst?: string;
  /** Each started quest's progress, by quest id, kept for the save (#231). */
  quests: Map<string, { stage: string; turns: number }>;
  dropped?: boolean;
};
