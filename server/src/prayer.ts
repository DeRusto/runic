import {
  BURY_TICKS,
  burialXp,
  EMPTY_SLOT,
  isShrine,
  maxPrayerPoints,
  nextOffering,
  OFFER_TICKS,
  offeringRefusal,
  shrinePrayerPoints,
  type Tile,
  regeneratePrayerPoints,
} from "@runic/shared";
import { tilesNextTo } from "./pathfinding.ts";
import type {
  OfferingAction,
  QueuedAction,
  ShrineAction,
} from "./playerActions.ts";
import { isInventorySlot, type World } from "./worldContext.ts";

/** Starts a burial on the player's own tile, replacing their current action. */
export function startBurial(
  world: World,
  id: string,
  slot: number,
  item: string,
) {
  const player = world.player(id);
  if (player.inventory[slot] !== item || !player.inventoryCounts[slot]) return;
  world.clearAction(id);
  world.unsynced(id).action = {
    kind: "burying",
    slot,
    item,
    doneTick: world.state.tick + BURY_TICKS,
  };
}

/** A burial intent, only for an inventory slot that holds a bone. */
export function buryIntent(
  world: World,
  id: string,
  slot: number,
): QueuedAction | undefined {
  if (!isInventorySlot(slot)) return;
  const item = world.player(id).inventory[slot];
  if (item && burialXp(item) !== undefined)
    return { kind: "burying", slot, item };
}

/** A pray or offer intent at the shrine a client named, if it is one; offering with no bones is refused with a line. */
export function shrineIntent(
  world: World,
  id: string,
  kind: ShrineAction["kind"],
  at: Tile,
): ShrineAction | undefined {
  if (!Number.isInteger(at?.x) || !Number.isInteger(at?.y)) return;
  if (!isShrine(world.tiles[at.y]?.[at.x]?.station)) return;
  const refusal = kind === "offering" && offeringRefusal(world.player(id));
  if (refusal) return void world.tell(id, refusal);
  return { kind, shrine: { x: at.x, y: at.y } };
}

/** Whether the player has finished walking to the shrine their action names. */
function atShrine(world: World, id: string, shrine: Tile) {
  const player = world.player(id);
  return (
    !world.unsynced(id).path.length &&
    tilesNextTo(world.tiles, shrine).some(
      ({ x, y }) => x === player.x && y === player.y,
    )
  );
}

/** Takes one bone every `OFFER_TICKS` after arrival, in bag order, until none are left. */
function offerNextBone(world: World, id: string, action: OfferingAction) {
  const { tick } = world.state;
  action.nextOfferTick ??= tick + OFFER_TICKS;
  if (tick < action.nextOfferTick) return;
  const player = world.player(id);
  const offering = nextOffering(player.inventory, player.inventoryCounts);
  if (offering) {
    takeOne(player, offering.slot);
    world.earnXp(player, "prayerXp", offering.xp);
  }
  if (nextOffering(player.inventory, player.inventoryCounts))
    action.nextOfferTick = tick + OFFER_TICKS;
  else world.clearAction(id);
}

function takeOne(player: ReturnType<World["player"]>, slot: number) {
  if (--player.inventoryCounts[slot]! === 0)
    player.inventory[slot] = EMPTY_SLOT;
}

/** Refills a praying player, steps a living player's offering, or recovers points and completes a burial whose bone is still there. */
export function advancePrayer(world: World, id: string) {
  const player = world.player(id);
  const { tick } = world.state;
  const { action } = world.unsynced(id);
  const shrineAction =
    !player.dead &&
    (action?.kind === "praying" || action?.kind === "offering") &&
    atShrine(world, id, action.shrine);
  if (shrineAction && action.kind === "praying") {
    player.prayerPoints = shrinePrayerPoints(
      player.prayerPoints,
      player.prayerXp,
    );
    if (player.prayerPoints === maxPrayerPoints(player.prayerXp))
      world.clearAction(id);
    return;
  }
  player.prayerPoints = regeneratePrayerPoints(
    player.prayerPoints,
    player.prayerXp,
    tick,
  );
  if (shrineAction && action.kind === "offering")
    return offerNextBone(world, id, action);
  if (player.dead) return;
  if (action?.kind !== "burying" || tick < action.doneTick) return;

  world.clearAction(id);
  const { slot, item } = action;
  const xp = burialXp(item);
  if (
    xp === undefined ||
    player.inventory[slot] !== item ||
    !player.inventoryCounts[slot]
  )
    return;
  takeOne(player, slot);
  world.earnXp(player, "prayerXp", xp);
}
