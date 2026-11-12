// Test helpers shared by the gathering skills' tests.
import {
  GATHERING,
  INVENTORY_SLOTS,
  type GatheringSkill,
  type Tile,
  type WorldEvent,
} from "@runic/shared";
import type { Simulation } from "./simulation.ts";

/** A deterministic stream of rolls in [0, 1): Park–Miller. */
export const seededRandom = (seed: number) => () =>
  (seed = (seed * 16807) % 2147483647) / 2147483647;

/** Adds a nearly dead player at (x, y) with `xp` in `skill` and `tools`, named after their id. */
export function addGatherer(
  sim: Simulation,
  skill: GatheringSkill,
  id: string,
  xp: number,
  { x, y }: Tile,
  tools: string[],
) {
  sim.addPlayer(
    id,
    {
      x,
      y,
      combatXp: 0,
      defenseXp: 0,
      herblawXp: 0,
      [GATHERING[skill].xpField]: xp,
      tools,
      hitpointsXp: 4050,
      health: 10,
      inventory: Array<string>(INVENTORY_SLOTS).fill(""),
    },
    id,
  );
}

/**
 * Helpers for one skill's tests. `sim` is a getter so a test can swap in a fresh simulation.
 * `stand` is where `addAt` puts a player by default, and players carry the skill's tool unless told otherwise.
 */
export function gatheringHarness(
  sim: () => Simulation,
  skill: GatheringSkill,
  stand: Tile,
) {
  const { verb, tool } = GATHERING[skill];
  const addAt = (
    id: string,
    xp: number,
    x = stand.x,
    y = stand.y,
    tools: string[] = tool ? [tool] : [],
  ) => addGatherer(sim(), skill, id, xp, { x, y }, tools);
  /** Runs ticks and returns each attempt's event with the tick it came on. */
  const attempts = (count: number) => {
    const seen: { tick: number; event: WorldEvent }[] = [];
    for (let i = 0; i < count; i++) {
      sim().tick();
      for (const event of sim().events.splice(0))
        if (event.type === verb) seen.push({ tick: sim().state.tick, event });
    }
    return seen;
  };
  const attemptTicks = (count: number) =>
    attempts(count).map(({ tick }) => tick);
  /** Clicks `site` and runs long enough for one attempt, however long the wait for it is; returns that attempt's events. */
  const gather = (site: string, id = "a") => {
    sim().queueGather(id, skill, site);
    return attempts(8).map(({ event }) => event);
  };
  return { addAt, attempts, attemptTicks, gather };
}
