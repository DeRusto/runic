/**
 * Pacing simulation for Mining and Smithing ([Map: Rebalance Mining and Smithing](https://github.com/DeRusto/runic/issues/134)).
 * Plays mine → walk → smelt → smith on the real map with the formulas in shared/src, and prints
 * the hours each player takes to reach Mining and Smithing 10, 20 and 99.
 *
 * It plays the rules the map decided, ahead of the code: five metal tiers, a chance of 2 ore per
 * successful mine, finds (tin and coal), smelting gated on and paying Mining only, and the anvil
 * paying all of Smithing.
 *
 * Run: node --experimental-strip-types scripts/pacing.ts (the flag is needed before Node 22.18)
 *
 * To test new numbers, change INPUTS below; every other line reads from it.
 */
import {
  INVENTORY_SLOTS,
  MAX_LEVEL,
  STACK_SIZE,
  TICK_MS,
  VEINS,
  WALK_TICKS_PER_TILE,
  attemptChance,
  levelFor,
  pickIntervalTicks,
  type Tier,
  type VeinTier,
  type Tile,
} from "@runic/shared";
import { pathNextTo } from "../server/src/pathfinding.ts";
import { loadWorldRegion } from "../server/src/worldRegion.ts";

type Find = "tin" | "coal";

const INPUTS = {
  /**
   * Per vein: `xp` per successful mine, `double` the chance it gives 2 ore, and the chance of each
   * find. Level, holds and regrow come from VEINS. Gems are left out: nothing uses them yet, and
   * the player is assumed to drop them.
   */
  veins: {
    copper: { xp: 6, double: 0.3, finds: { tin: 1 / 3 } },
    iron: { xp: 18, double: 0.25, finds: { tin: 1 / 6, coal: 1 / 2 } },
    emberite: { xp: 30, double: 0.2, finds: {} },
  } as Record<
    VeinTier,
    { xp: number; double: number; finds: Partial<Record<Find, number>> }
  >,
  /**
   * Per metal, lowest first: the ore and find a bar takes, the Mining level to smelt it, and the
   * Mining experience smelting pays. Every bar takes 6 ticks.
   */
  bars: {
    copper: { ore: "copper", level: 1, xp: 2 },
    bronze: { ore: "copper", find: "tin", level: 5, xp: 4 },
    iron: { ore: "iron", level: 10, xp: 6 },
    steel: { ore: "iron", find: "coal", level: 15, xp: 9 },
    emberite: { ore: "emberite", level: 20, xp: 12 },
  } as Record<Tier, { ore: VeinTier; find?: Find; level: number; xp: number }>,
  barTicks: 6,
  /**
   * Smithing experience per bar at the anvil, by metal. Every metal's gear has the same costs and
   * times, and every item pays the same per bar and per tick, so a sword (3 bars, 12 ticks) stands
   * for all. It's dropped as it's made, and Emberbones are assumed on hand.
   */
  anvilXpPerBar: {
    copper: 6,
    bronze: 12,
    iron: 18,
    steel: 27,
    emberite: 36,
  } as Record<Tier, number>,
  /** The Smithing level each metal's gear needs: the same as its bar's Mining level. */
  gear: { bars: 3, ticks: 12 },
  attemptChance,
  pickIntervalTicks,
  inventorySlots: INVENTORY_SLOTS,
  stackSize: STACK_SIZE,
  walkTicksPerTile: WALK_TICKS_PER_TILE,
  playerCounts: [1, 3],
  seeds: [1, 2, 3, 4, 5],
  milestones: [5, 10, 15, 20, MAX_LEVEL],
  maxHours: 300,
};

const TIERS = Object.keys(INPUTS.veins) as VeinTier[];
const METALS = Object.keys(INPUTS.bars) as Tier[];
const FINDS: Find[] = ["tin", "coal"];
const ticksToHours = (ticks: number) => (ticks * TICK_MS) / 3_600_000;
const level = (tier: VeinTier) => VEINS[tier].level;

const tiles = loadWorldRegion();
type Vein = { tier: VeinTier; tile: Tile; left: number; regrowTick: number };
const veinTiles: { tier: VeinTier; tile: Tile }[] = [];
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
  ore: Record<VeinTier, number>;
  finds: Record<Find, number>;
  bars: Record<Tier, number>;
  /** Tin held when Mining 5 was reached, and coal when Mining 15 was. */
  stockAtUnlock: Partial<Record<Find, number>>;
  /** Bars smelted without a find although its metal was open, because the find ran out. */
  starved: Record<Find, { short: number; all: number }>;
  /** Successful mines per vein from Mining 20 on, to show which vein the top levels are trained on. */
  minedFrom20: Record<VeinTier, number>;
  nextAttemptTick: number;
  busyUntil: number;
  mining?: Vein;
};

function earn(player: Player, skill: Skill, xp: number, tick: number) {
  const before = levelFor(player.xp[skill]);
  player.xp[skill] += xp;
  const after = levelFor(player.xp[skill]);
  for (const milestone of INPUTS.milestones)
    if (before < milestone && after >= milestone)
      player.reached[skill].set(milestone, tick);
  if (skill === "Mining")
    for (const { find, level } of Object.values(INPUTS.bars))
      if (find && before < level && after >= level)
        player.stockAtUnlock[find] = player.finds[find];
}

const stacks = (counts: Record<string, number>) =>
  Object.values(counts).reduce(
    (s, n) => s + Math.ceil(n / INPUTS.stackSize),
    0,
  );
/** shortcut: full once every slot holds something, though a partial stack has room; count stack room if trip size starts to matter. */
const full = (player: Player) =>
  stacks(player.ore) + stacks(player.finds) + stacks(player.bars) >=
  INPUTS.inventorySlots;

/** Metals the player can both smelt and smith, so no bar is smelted that would sit unused. */
const canMake = (player: Player, metal: Tier) =>
  levelFor(player.xp.Mining) >= INPUTS.bars[metal].level &&
  levelFor(player.xp.Smithing) >= INPUTS.bars[metal].level;
const smeltable = (player: Player, metal: Tier) => {
  const { ore, find } = INPUTS.bars[metal];
  return (
    canMake(player, metal) &&
    player.ore[ore] > 0 &&
    (!find || player.finds[find] > 0)
  );
};
const smithable = (player: Player, metal: Tier) =>
  player.bars[metal] >= INPUTS.gear.bars && canMake(player, metal);

/** Everything one ore of this vein is worth once smelted and smithed into the best metal the player can make with the finds they hold. */
function valuePerOre(player: Player, tier: VeinTier) {
  const best = [...METALS].reverse().find((m) => {
    const { ore, find } = INPUTS.bars[m];
    return (
      ore === tier && canMake(player, m) && (!find || player.finds[find] > 0)
    );
  });
  return best ? INPUTS.bars[best].xp + INPUTS.anvilXpPerBar[best] : 0;
}

/** Walks to the furnace, smelts all it can, walks to the anvil and smiths all it can. Returns when it's done. */
function smithTrip(player: Player, tick: number) {
  const toFurnace = walk(player.at, furnace!);
  tick += toFurnace.steps * INPUTS.walkTicksPerTile;
  // Highest metal first, and again after a level-up unlocks one.
  for (
    let metal;
    (metal = [...METALS].reverse().find((m) => smeltable(player, m)));
  ) {
    const { ore, find, xp } = INPUTS.bars[metal];
    tick += INPUTS.barTicks;
    player.ore[ore]--;
    if (find) player.finds[find]--;
    player.bars[metal]++;
    // Counted before earn(), so a metal this bar unlocks isn't counted as open for it.
    for (const better of METALS) {
      const { ore: betterOre, find: betterFind } = INPUTS.bars[better];
      if (!betterFind || betterOre !== ore || !canMake(player, better))
        continue;
      player.starved[betterFind].all++;
      if (metal !== better) player.starved[betterFind].short++;
    }
    earn(player, "Mining", xp, tick);
  }
  const toAnvil = walk(toFurnace.end, anvil!);
  tick += toAnvil.steps * INPUTS.walkTicksPerTile;
  for (
    let metal;
    (metal = [...METALS].reverse().find((m) => smithable(player, m)));
  ) {
    tick += INPUTS.gear.ticks;
    player.bars[metal] -= INPUTS.gear.bars;
    earn(
      player,
      "Smithing",
      INPUTS.anvilXpPerBar[metal] * INPUTS.gear.bars,
      tick,
    );
  }
  player.at = toAnvil.end;
  return tick;
}

/**
 * Greedy: the open vein with the most experience per tick, counting the walk there.
 * shortcut: myopic and mining-only (one success ahead, never waits for a better vein to regrow, leaves out the
 * Smithy trip and the worth of finds); add lookahead or loop cost if a later ticket needs it.
 */
function chooseVein(player: Player, veins: Vein[]) {
  const mining = levelFor(player.xp.Mining);
  let best: { vein: Vein; rate: number } | undefined;
  for (const vein of veins) {
    if (vein.left === 0 || mining < level(vein.tier)) continue;
    const source = INPUTS.veins[vein.tier];
    const walkTicks =
      walk(player.at, vein.tile).steps * INPUTS.walkTicksPerTile;
    const mineTicks =
      INPUTS.pickIntervalTicks(mining) /
      INPUTS.attemptChance(level(vein.tier), mining);
    const perSuccess =
      source.xp + (1 + source.double) * valuePerOre(player, vein.tier);
    const rate = perSuccess / (walkTicks + mineTicks);
    if (!best || rate > best.rate) best = { vein, rate };
  }
  return best?.vein;
}

type Run = Pick<
  Player,
  "reached" | "stockAtUnlock" | "starved" | "minedFrom20"
>;

function simulate(playerCount: number, seed: number): Run[] {
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
    left: VEINS[tier].holds,
    regrowTick: 0,
  }));
  const zero = <K extends string>(keys: K[]) =>
    Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  const players: Player[] = Array.from({ length: playerCount }, () => ({
    at: furnace!,
    xp: { Mining: 0, Smithing: 0 },
    reached: { Mining: new Map(), Smithing: new Map() },
    ore: zero(TIERS),
    finds: zero(FINDS),
    bars: zero(METALS),
    stockAtUnlock: {},
    starved: { tin: { short: 0, all: 0 }, coal: { short: 0, all: 0 } },
    minedFrom20: zero(TIERS),
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
        vein.left = VEINS[vein.tier].holds;

    for (const player of players) {
      if (tick < player.busyUntil) continue;
      const vein = player.mining;
      if (vein && vein.left > 0 && !full(player)) {
        if (tick < player.nextAttemptTick) continue;
        const mining = levelFor(player.xp.Mining);
        const source = INPUTS.veins[vein.tier];
        player.nextAttemptTick = tick + INPUTS.pickIntervalTicks(mining);
        if (random() >= INPUTS.attemptChance(level(vein.tier), mining))
          continue;
        // shortcut: a second ore or find with no room is kept rather than left on the ground; full() stops the next mine anyway.
        player.ore[vein.tier] += random() < source.double ? 2 : 1;
        for (const find of FINDS)
          if (random() < (source.finds[find] ?? 0)) player.finds[find]++;
        if (mining >= 20) player.minedFrom20[vein.tier]++;
        earn(player, "Mining", source.xp, tick);
        if (--vein.left === 0)
          vein.regrowTick = tick + VEINS[vein.tier].regrowTicks;
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
        METALS.some((m) => smeltable(player, m) || smithable(player, m))
      ) {
        player.busyUntil = smithTrip(player, tick);
      } else {
        player.busyUntil = tick + 1;
      }
    }
  }
  return players;
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
const finds: string[] = [];
for (const count of INPUTS.playerCounts) {
  const runs = INPUTS.seeds.flatMap((seed) => simulate(count, seed));
  for (const skill of ["Mining", "Smithing"] as const) {
    const cells = INPUTS.milestones.map((milestone) => {
      const ticks = runs.map((run) => run.reached[skill].get(milestone));
      return ticks.includes(undefined)
        ? fmt(undefined)
        : fmt(ticksToHours(mean(ticks as number[])));
    });
    console.log(`| ${count} | ${skill} | ${cells.join(" | ")} |`);
  }
  for (const find of FINDS) {
    const stock = mean(runs.map((run) => run.stockAtUnlock[find] ?? 0));
    const short = runs.reduce((s, run) => s + run.starved[find].short, 0);
    const all = runs.reduce((s, run) => s + run.starved[find].all, 0);
    finds.push(
      `${count} player(s): ${stock.toFixed(0)} ${find} held at unlock; ` +
        `${((100 * short) / Math.max(all, 1)).toFixed(0)}% of bars that could have used ${find} went without`,
    );
  }
  const mined = TIERS.map((tier) =>
    runs.reduce((s, run) => s + run.minedFrom20[tier], 0),
  );
  const total = mined.reduce((a, b) => a + b, 0);
  finds.push(
    `${count} player(s), mines from Mining 20 on: ` +
      TIERS.map(
        (tier, i) =>
          `${tier} ${((100 * mined[i]) / Math.max(total, 1)).toFixed(0)}%`,
      ).join(", "),
  );
}
console.log(`\n${finds.join("\n")}`);
