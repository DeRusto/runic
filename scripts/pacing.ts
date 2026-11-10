/**
 * Pacing simulation for Mining and Smithing ([Map: Rebalance Mining and Smithing](https://github.com/DeRusto/runic/issues/134)).
 * Plays mine → walk → smelt → smith on the real map with the formulas in shared/src, and prints
 * the hours each player takes to reach Mining and Smithing 10, 20 and 99.
 *
 * Run: node --experimental-strip-types scripts/pacing.ts (the flag is needed before Node 22.18)
 *
 * To test new numbers, change INPUTS below; every other line reads from it.
 */
import {
  INVENTORY_SLOTS,
  MAX_LEVEL,
  RECIPES,
  STACK_SIZE,
  TICK_MS,
  VEINS,
  WALK_TICKS_PER_TILE,
  attemptChance,
  levelFor,
  pickIntervalTicks,
  type Tier,
  type Tile,
} from "@runic/shared";
import { pathNextTo } from "../server/src/pathfinding.ts";
import { loadWorldRegion } from "../server/src/worldRegion.ts";

const INPUTS = {
  /**
   * Per tier, lowest first: the vein, the bar, and the gear item made from it. Every gear item
   * pays the same experience per bar and per tick, so one stands for all. It's dropped as it's
   * made, so it never fills the inventory, and Emberbones are assumed on hand.
   */
  tiers: {
    copper: {
      vein: VEINS.copper,
      bar: RECIPES.copperBar,
      gear: RECIPES.copperSword,
    },
    iron: { vein: VEINS.iron, bar: RECIPES.ironBar, gear: RECIPES.ironSword },
    emberite: {
      vein: VEINS.emberite,
      bar: RECIPES.emberiteBar,
      gear: RECIPES.emberiteSword,
    },
  },
  attemptChance,
  pickIntervalTicks,
  inventorySlots: INVENTORY_SLOTS,
  stackSize: STACK_SIZE,
  walkTicksPerTile: WALK_TICKS_PER_TILE,
  playerCounts: [1, 3],
  seeds: [1, 2, 3, 4, 5],
  milestones: [10, 20, MAX_LEVEL],
  maxHours: 300,
};

type TierRow = (typeof INPUTS.tiers)[Tier];
const TIERS = Object.keys(INPUTS.tiers) as Tier[];
const row = (tier: Tier): TierRow => INPUTS.tiers[tier];
const barsPerGear = (tier: Tier) =>
  (row(tier).gear.costs as Partial<Record<string, number>>)[`${tier}Bar`]!;
const ticksToHours = (ticks: number) => (ticks * TICK_MS) / 3_600_000;

/** Everything one ore is worth once it is smelted and smithed, in both skills. Used to choose a vein. */
const valuePerOre = (tier: Tier) => {
  const { vein, bar, gear } = row(tier);
  return (
    vein.xp +
    bar.xp.miningXp +
    bar.xp.smithingXp +
    gear.xp.smithingXp / barsPerGear(tier)
  );
};

const tiles = loadWorldRegion();
type Vein = { tier: Tier; tile: Tile; left: number; regrowTick: number };
const veinTiles: { tier: Tier; tile: Tile }[] = [];
let furnace: Tile | undefined;
let anvil: Tile | undefined;
tiles.forEach((line, y) =>
  line.forEach((kind, x) => {
    if (kind.vein) veinTiles.push({ tier: kind.vein, tile: { x, y } });
    if (kind.station === "furnace") furnace = { x, y };
    if (kind.station === "anvil") anvil = { x, y };
  }),
);

const pathCache = new Map<string, { steps: number; end: Tile }>();
/** Walking from `from` to stand next to `to`, as the server paths it. */
function walk(from: Tile, to: Tile) {
  const key = `${from.x},${from.y}>${to.x},${to.y}`;
  let found = pathCache.get(key);
  if (!found) {
    const path = pathNextTo(tiles, from, to);
    if (!path) throw new Error(`No path to ${key}`);
    found = { steps: path.length, end: path.at(-1) ?? from };
    pathCache.set(key, found);
  }
  return found;
}

type Skill = "Mining" | "Smithing";
type Player = {
  at: Tile;
  xp: Record<Skill, number>;
  reached: Record<Skill, Map<number, number>>;
  ore: Record<Tier, number>;
  bars: Record<Tier, number>;
  nextAttemptTick: number;
  busyUntil: number;
  mining?: Vein;
};

function earn(player: Player, skill: Skill, xp: number, tick: number) {
  const before = levelFor(player.xp[skill]);
  player.xp[skill] += xp;
  const after = levelFor(player.xp[skill]);
  for (const level of INPUTS.milestones)
    if (before < level && after >= level)
      player.reached[skill].set(level, tick);
}

const slotsUsed = (player: Player) =>
  TIERS.reduce(
    (slots, tier) =>
      slots +
      Math.ceil(player.ore[tier] / INPUTS.stackSize) +
      Math.ceil(player.bars[tier] / INPUTS.stackSize),
    0,
  );

/** shortcut: full once every slot holds something, though a partial stack has room; count stack room if trip size starts to matter. */
const full = (player: Player) => slotsUsed(player) >= INPUTS.inventorySlots;

const smeltable = (player: Player, tier: Tier) =>
  player.ore[tier] > 0 && levelFor(player.xp.Smithing) >= row(tier).bar.level;
const smithable = (player: Player, tier: Tier) =>
  player.bars[tier] >= barsPerGear(tier) &&
  levelFor(player.xp.Smithing) >= row(tier).gear.level;

/** Walks to the furnace, smelts all it can, walks to the anvil and smiths all it can. Returns when it's done. */
function smithTrip(player: Player, tick: number) {
  const toFurnace = walk(player.at, furnace!);
  tick += toFurnace.steps * INPUTS.walkTicksPerTile;
  // Highest tier first, and again after a level-up unlocks one.
  for (
    let tier;
    (tier = [...TIERS].reverse().find((t) => smeltable(player, t)));
  ) {
    const { bar } = row(tier);
    tick += bar.ticks;
    player.ore[tier]--;
    player.bars[tier]++;
    earn(player, "Smithing", bar.xp.smithingXp, tick);
    earn(player, "Mining", bar.xp.miningXp, tick);
  }
  const toAnvil = walk(toFurnace.end, anvil!);
  tick += toAnvil.steps * INPUTS.walkTicksPerTile;
  for (
    let tier;
    (tier = [...TIERS].reverse().find((t) => smithable(player, t)));
  ) {
    const { gear } = row(tier);
    tick += gear.ticks;
    player.bars[tier] -= barsPerGear(tier);
    earn(player, "Smithing", gear.xp.smithingXp, tick);
  }
  player.at = toAnvil.end;
  return tick;
}

/**
 * Greedy: the open vein with the most experience per tick, counting the walk there.
 * shortcut: myopic and mining-only (one ore ahead, never waits for a better vein to regrow, and leaves out the
 * Smithy trip, whose walk grows with the tier); add lookahead or loop cost if a later ticket needs it.
 */
function chooseVein(player: Player, veins: Vein[]) {
  const level = levelFor(player.xp.Mining);
  let best: { vein: Vein; rate: number } | undefined;
  for (const vein of veins) {
    const { vein: source } = row(vein.tier);
    if (vein.left === 0 || level < source.level) continue;
    const walkTicks =
      walk(player.at, vein.tile).steps * INPUTS.walkTicksPerTile;
    const mineTicks =
      INPUTS.pickIntervalTicks(level) /
      INPUTS.attemptChance(source.level, level);
    const rate = valuePerOre(vein.tier) / (walkTicks + mineTicks);
    if (!best || rate > best.rate) best = { vein, rate };
  }
  return best?.vein;
}

/** Hours to each milestone, per player; undefined where it wasn't reached within maxHours. */
function simulate(playerCount: number, seed: number) {
  let state = seed;
  // mulberry32: a seeded random, so a run repeats exactly.
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const veins: Vein[] = veinTiles.map(({ tier, tile }) => ({
    tier,
    tile,
    left: row(tier).vein.holds,
    regrowTick: 0,
  }));
  const zero = () =>
    Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<Tier, number>;
  const players: Player[] = Array.from({ length: playerCount }, () => ({
    at: furnace!,
    xp: { Mining: 0, Smithing: 0 },
    reached: { Mining: new Map(), Smithing: new Map() },
    ore: zero(),
    bars: zero(),
    nextAttemptTick: 0,
    busyUntil: 0,
  }));
  const done = (player: Player) =>
    player.reached.Mining.has(MAX_LEVEL) &&
    player.reached.Smithing.has(MAX_LEVEL);
  const maxTicks = (INPUTS.maxHours * 3_600_000) / TICK_MS;

  for (let tick = 0; tick < maxTicks && !players.every(done); tick++) {
    for (const vein of veins)
      if (vein.left === 0 && tick >= vein.regrowTick)
        vein.left = row(vein.tier).vein.holds;

    for (const player of players) {
      if (tick < player.busyUntil) continue;
      const vein = player.mining;
      if (vein && vein.left > 0 && !full(player)) {
        if (tick < player.nextAttemptTick) continue;
        const level = levelFor(player.xp.Mining);
        const { vein: source } = row(vein.tier);
        player.nextAttemptTick = tick + INPUTS.pickIntervalTicks(level);
        if (random() >= INPUTS.attemptChance(source.level, level)) continue;
        player.ore[vein.tier]++;
        earn(player, "Mining", source.xp, tick);
        if (--vein.left === 0) vein.regrowTick = tick + source.regrowTicks;
        continue;
      }
      player.mining = undefined;

      const next = full(player) ? undefined : chooseVein(player, veins);
      if (next) {
        const path = walk(player.at, next.tile);
        player.at = path.end;
        player.busyUntil = tick + path.steps * INPUTS.walkTicksPerTile;
        player.mining = next;
      } else if (
        TIERS.some((t) => smeltable(player, t) || smithable(player, t))
      ) {
        player.busyUntil = smithTrip(player, tick);
      } else {
        player.busyUntil = tick + 1;
      }
    }
  }
  return players.map((player) => player.reached);
}

const fmt = (hours: number | undefined) =>
  hours === undefined ? `>${INPUTS.maxHours}` : hours.toFixed(1);
const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;

console.log("Walk from the furnace to the nearest vein of each tier:");
for (const tier of TIERS) {
  const seconds = Math.min(
    ...veinTiles
      .filter((v) => v.tier === tier)
      .map(
        (v) =>
          (walk(furnace!, v.tile).steps * INPUTS.walkTicksPerTile * TICK_MS) /
          1000,
      ),
  );
  console.log(`  ${tier}: ${seconds.toFixed(1)} s`);
}
console.log(
  `\nMean hours over ${INPUTS.seeds.length} seeds, and over every player:\n`,
);
console.log(
  `| Players | Skill | ${INPUTS.milestones.map((l) => `Level ${l}`).join(" | ")} |`,
);
console.log(`|---|---|${INPUTS.milestones.map(() => "---").join("|")}|`);
for (const count of INPUTS.playerCounts) {
  const runs = INPUTS.seeds.flatMap((seed) => simulate(count, seed));
  for (const skill of ["Mining", "Smithing"] as const) {
    const cells = INPUTS.milestones.map((level) => {
      const ticks = runs.map((reached) => reached[skill].get(level));
      return ticks.includes(undefined)
        ? fmt(undefined)
        : fmt(ticksToHours(mean(ticks as number[])));
    });
    console.log(`| ${count} | ${skill} | ${cells.join(" | ")} |`);
  }
}
