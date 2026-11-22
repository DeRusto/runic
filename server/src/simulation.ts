import { ArraySchema } from "@colyseus/schema";
import {
  GATHERING_SKILLS,
  logoutRefusal,
  MAX_PINNED_SKILLS,
  respawnTile,
  siteId,
  SKILLS,
  type Deal,
  type GatheringSkill,
  type GearSlot,
  type SitePool,
  type Tile,
  type TileKind,
  type WorldEvent,
} from "@runic/shared";
import { Bank } from "./banking.ts";
import { Eating } from "./eating.ts";
import { Enemies } from "./enemies.ts";
import { Fighting } from "./fighting.ts";
import { Firemaking } from "./firemaking.ts";
import { Gathering } from "./gathering.ts";
import { GatheringSites } from "./gatheringSites.ts";
import { Gear } from "./gear.ts";
import { GeneralStore } from "./generalStore.ts";
import { Inventory } from "./inventory.ts";
import { Making } from "./making.ts";
import type { QueuedAction } from "./playerActions.ts";
import { newSave, saveOf, syncedOf } from "./playerSave.ts";
import { Quests } from "./quests.ts";
import type { PlayerSave } from "./saves.ts";
import { ThievingTargets } from "./thievingTargets.ts";
import { VillagerWindows } from "./villagerWindows.ts";
import { Walking } from "./walking.ts";
import {
  isAmount,
  isInventorySlot,
  maxHealthTotal,
  World,
} from "./worldContext.ts";
import { Player } from "./worldState.ts";

/** The whole game: rules and state, with no network. Tests and the room both drive it through tick(). */
export class Simulation {
  private readonly world: World;
  readonly state: World["state"];
  /** This tick's one-shot moments, for the room to broadcast after the patch and empty. */
  readonly events: WorldEvent[];
  /** Only the latest click per player counts, so a flood of them costs one path per tick. */
  private queuedActions = new Map<string, QueuedAction>();
  /** By username, so joining again can't beat the attempt or eat interval. */
  private timersOfLeavers = new Map<
    string,
    { nextAttemptTick: number; nextEatTick: number }
  >();
  /** Every enemy, which fights on its own and tells the world its swings and loot. */
  private enemies: Enemies;
  private readonly sites: GatheringSites;
  private readonly gathering: Gathering;
  private readonly firemaking: Firemaking;
  private readonly making: Making;
  private readonly quests: Quests;
  private readonly windows: VillagerWindows;
  private readonly bank: Bank;
  private readonly store: GeneralStore;
  private readonly gear: Gear;
  private readonly eating: Eating;
  private readonly fighting: Fighting;
  private readonly thieving: ThievingTargets;
  private readonly walking: Walking;
  private readonly inventory: Inventory;
  private queuedLogouts = new Set<string>();
  /** Players whose log out intent was accepted, for the room to disconnect. */
  readonly loggedOut: string[] = [];

  constructor(
    tiles: TileKind[][],
    readonly random: () => number,
    pools: SitePool[] = [],
  ) {
    // Through `this.random` at each roll, so a test can stub it after construction.
    this.world = new World(tiles, () => this.random());
    this.state = this.world.state;
    this.events = this.world.events;
    this.quests = new Quests(this.world);
    this.windows = new VillagerWindows(this.world, this.quests);
    this.bank = new Bank(this.world, this.windows);
    this.store = new GeneralStore(this.world, this.windows);
    this.gear = new Gear(this.world);
    this.eating = new Eating(this.world);
    this.inventory = new Inventory(this.world);
    this.sites = new GatheringSites(this.world);
    this.firemaking = new Firemaking(this.world);
    this.making = new Making(this.world);
    this.gathering = new Gathering(this.world, this.sites, this.quests);
    this.enemies = new Enemies(
      this.world.tiles,
      this.state.enemies,
      this.random,
    );
    this.fighting = new Fighting(
      this.world,
      this.enemies,
      this.windows,
      this.quests,
    );
    this.thieving = new ThievingTargets(this.world, this.fighting);
    this.walking = new Walking(
      this.world,
      this.sites,
      this.thieving,
      this.firemaking,
    );
    this.sites.placePools(pools);
  }

  /** `saved` is the account's last save; without one, this is a new account. */
  addPlayer(id: string, saved?: PlayerSave, username = "") {
    const login = this.loginSave(saved);
    const fields = syncedOf(login);
    const maxHealth = maxHealthTotal(fields);
    const player = Object.assign(new Player(), fields, {
      username,
      maxHealth,
      // Health saved under a Fortitude potion can be above the maximum it logs back in to.
      health: Math.min(fields.health, maxHealth),
    });
    // A save from before the quests has none, so nobody starts with progress (#231). The
    // record isn't a synced field — syncedOf excludes it; the player holds the quest ids
    // with the stages parallel, and the unsynced side keeps the repeat turn-ins.
    const questProgress = login.quests ?? {};
    player.quests = new ArraySchema(...Object.keys(questProgress));
    player.questStages = new ArraySchema(
      ...Object.values(questProgress).map(({ stage }) => stage),
    );
    this.state.players.set(id, player);
    this.world.unsyncedPlayers.set(id, {
      path: [],
      nextStepTick: 0,
      nextSwingTick: 0,
      nextAttemptTick: 0,
      nextEatTick: 0,
      healingPool: [],
      lockEndTick: 0,
      respawnTick: 0,
      quests: new Map(Object.entries(questProgress)),
      ...this.timersOfLeavers.get(username),
    });
    this.timersOfLeavers.delete(username);
  }

  private loginSave(saved: PlayerSave | undefined): PlayerSave {
    const respawn = respawnTile(this.world.tiles);
    if (!saved) return newSave(respawn);
    const tile = this.world.tiles[saved.y]?.[saved.x];
    if (tile && !tile.blocks) return saved;
    // A pooled site may have come back on the spot they logged out on.
    const nearest = this.sites.has(siteId(saved))
      ? this.sites.nearestPastSites(saved)
      : undefined;
    return { ...saved, ...(nearest ?? respawn) };
  }

  /** What to write to the database for this player, if they're in the region. */
  saveOf(id: string): PlayerSave | undefined {
    const player = this.state.players.get(id);
    if (!player) return undefined;
    return {
      ...saveOf(player),
      // The generic save writes `quests` as a plain array of ids, so the progress record replaces it.
      quests: this.quests.progressOf(id),
      // Or a save during death could bring someone back with 0 health (D13).
      ...(player.dead && this.fighting.respawned(player)),
    };
  }

  removePlayer(id: string) {
    const username = this.state.players.get(id)?.username;
    const unsynced = this.world.unsyncedPlayers.get(id);
    if (username && unsynced) {
      const { nextAttemptTick, nextEatTick } = unsynced;
      this.timersOfLeavers.set(username, { nextAttemptTick, nextEatTick });
    }
    this.state.players.delete(id);
    this.world.unsyncedPlayers.delete(id);
    this.queuedActions.delete(id);
    this.world.queuedEats.delete(id);
    this.world.queuedDrops.delete(id);
    this.queuedLogouts.delete(id);
    this.windows.forget(id);
    this.world.stopFollowersOf(id);
    // A leaver has no inventory to fill (spec D8).
    this.enemies.forget(id);
  }

  /** Lost connection but stays in the world: idle (D9), and still there to be hit. */
  dropPlayer(id: string) {
    this.world.clearAction(id);
    this.world.unsyncedPlayers.get(id)!.dropped = true;
    this.windows.forget(id);
    this.queuedActions.delete(id);
    this.world.queuedEats.delete(id);
    this.world.queuedDrops.delete(id);
    this.queuedLogouts.delete(id);
  }

  reconnectPlayer(id: string) {
    this.world.unsyncedPlayers.get(id)!.dropped = false;
  }

  lockRunning(id: string) {
    return this.world.lockRunning(id);
  }

  /** Not refreshed while dropped, or an enemy's swings would hold them here until killed (Q3). */
  lock(id: string) {
    this.world.lock(id);
  }

  queueLogout(id: string) {
    if (this.state.players.has(id)) this.queuedLogouts.add(id);
  }

  /** `to` comes straight off the network, so anything but a tile on the grid is ignored. */
  queueWalk(id: string, to: Tile) {
    if (!this.world.canAct(id)) return;
    if (!Number.isInteger(to?.x) || !Number.isInteger(to?.y)) return;
    if (!this.world.tiles[to.y]?.[to.x]) return;
    this.queuedActions.set(id, { kind: "walking", to: { x: to.x, y: to.y } });
  }

  /** `enemy` comes straight off the network, so anything but a live enemy's id is ignored. */
  queueTarget(id: string, enemy: string) {
    if (!this.world.canAct(id)) return;
    const target = this.state.enemies.get(enemy);
    if (!target || target.state === "dead") return;
    this.queuedActions.set(id, { kind: "fighting", enemy });
  }

  /** `target` is a player's session id, checked by the room's /follow command. */
  follow(id: string, target: string) {
    if (!this.world.canAct(id)) return;
    this.queuedActions.set(id, { kind: "following", player: target });
  }

  /** The session id of the player this one follows, if any. A queued intent counts already, since it replaces the action on the next tick. */
  following(id: string) {
    const queued = this.queuedActions.get(id);
    if (queued) return queued.kind === "following" ? queued.player : undefined;
    const action = this.world.unsyncedPlayers.get(id)?.action;
    return action?.kind === "following" ? action.player : undefined;
  }

  unfollow(id: string) {
    if (!this.following(id)) return;
    this.queuedActions.delete(id);
    this.world.clearAction(id);
  }

  /** `site` comes straight off the network; see `GatheringSites.gatherIntent`. */
  queueGather(id: string, skill: GatheringSkill, site: string) {
    this.queue(id, this.sites.gatherIntent(id, skill, site));
  }

  /** Comes straight off the network; see `Making.makeIntent`. */
  queueMake(id: string, intent: { item: string; all: boolean; at?: Tile }) {
    this.queue(id, this.making.makeIntent(id, intent));
  }

  /**
   * `slot` comes straight off the network, so anything but an inventory slot's index is
   * ignored. The log, the tinderbox and the tile all wait for the tick, since the player is
   * standing on the tile already (#224).
   */
  queueLight(id: string, slot: number) {
    if (!this.world.canAct(id)) return;
    if (!isInventorySlot(slot)) return;
    this.queuedActions.set(id, { kind: "lighting", slot });
  }

  /** Both come straight off the network; see `VillagerWindows.visitIntent`. */
  queueVisit(id: string, villager: string, then?: string) {
    this.queue(id, this.windows.visitIntent(villager, then));
  }

  /** Queues a click for the next tick, if it asks for anything and the player can act. */
  private queue(id: string, action: QueuedAction | undefined) {
    if (action && this.world.canAct(id)) this.queuedActions.set(id, action);
  }

  /** `target` comes straight off the network; see `ThievingTargets.pickpocketIntent`. */
  queuePickpocket(id: string, target: unknown) {
    this.queue(id, this.thieving.pickpocketIntent(id, target));
  }

  /** `stall` comes straight off the network; see `ThievingTargets.stealIntent`. */
  queueSteal(id: string, stall: unknown) {
    this.queue(id, this.thieving.stealIntent(id, stall));
  }

  /** `strongbox` comes straight off the network; see `ThievingTargets.openIntent`. */
  queueOpen(id: string, strongbox: unknown) {
    this.queue(id, this.thieving.openIntent(id, strongbox));
  }

  /** Whether the player is busy this tick: stunned, or later crossing an Agility obstacle (#236). */
  isBusy(id: string) {
    return this.world.isBusy(id);
  }

  /** Makes the player busy for `ticks` from now: whatever they were doing stops, and their clicks are ignored until it ends (#236). */
  makeBusy(id: string, ticks: number, busy: { hittable: boolean }) {
    this.world.makeBusy(id, ticks, busy);
  }

  /** `choice` comes straight off the network; see `VillagerWindows.choose`. */
  choose(id: string, choice: number) {
    this.windows.choose(id, choice);
  }

  /** The player closed the conversation, so walking away later says nothing. */
  endTalk(id: string) {
    this.windows.close(id, "talk");
  }

  closeBank(id: string) {
    this.windows.close(id, "bank");
  }

  /** Both come straight off the network; see `Bank.deposit`. */
  deposit(id: string, slot: number, amount: number) {
    this.bank.deposit(id, slot, amount);
  }

  depositInventory(id: string) {
    this.bank.depositInventory(id);
  }

  /** Both come straight off the network; see `Bank.withdraw`. */
  withdraw(id: string, slot: number, amount: number) {
    this.bank.withdraw(id, slot, amount);
  }

  /** Both come straight off the network; see `Bank.moveBankItem`. */
  moveBankItem(id: string, from: number, to: number) {
    this.bank.moveBankItem(id, from, to);
  }

  closeStore(id: string) {
    this.windows.close(id, "store");
  }

  /** Comes straight off the network; see `GeneralStore.deal`. */
  deal(id: string, intent: Deal) {
    this.store.deal(id, intent);
  }

  /** `groundItem` comes straight off the network, so anything but the id of one this player can see is ignored. */
  queueTake(id: string, groundItem: string) {
    if (typeof groundItem !== "string") return;
    if (!this.world.canAct(id) || !this.inventory.canSee(id, groundItem))
      return;
    this.queuedActions.set(id, { kind: "taking", groundItem });
  }

  /** `slot` comes straight off the network, so anything but a slot's index is ignored. */
  queueEat(id: string, slot: number) {
    if (!this.world.canAct(id)) return;
    if (!isInventorySlot(slot)) return;
    this.world.queuedEats.set(id, slot);
  }

  /** Both come straight off the network, so anything but a slot's index and a whole number above 0 is ignored. */
  queueDrop(id: string, slot: number, amount: number) {
    if (!this.world.canAct(id)) return;
    if (!isInventorySlot(slot)) return;
    if (!isAmount(amount)) return;
    this.world.queuedDrops.set(id, { slot, amount });
  }

  /** A drag; both come straight off the network. See `Inventory.moveItem`. */
  moveItem(id: string, from: number, to: number) {
    this.inventory.moveItem(id, from, to);
  }

  /** `slot` comes straight off the network; see `Inventory.mix`. */
  mix(id: string, slot: number) {
    this.inventory.mix(id, slot);
  }

  /** Comes straight off the network, so anything invalid is ignored. A tick reads no pins, so like chat this skips the queue. */
  pinSkill(id: string, intent: { skill: string; pinned: boolean }) {
    const pins = this.state.players.get(id)?.pinnedSkills;
    const { skill, pinned } = intent ?? {};
    if (!pins || !SKILLS.some(([name]) => name === skill)) return;
    const at = pins.indexOf(skill);
    if (pinned === false && at >= 0) pins.splice(at, 1);
    if (pinned === true && at < 0 && pins.length < MAX_PINNED_SKILLS)
      pins.push(skill);
  }

  /** `slot` comes straight off the network; see `Gear.equip`. */
  equip(id: string, slot: number) {
    this.gear.equip(id, slot);
  }

  /** `gearSlot` comes straight off the network; see `Gear.takeOff`. */
  takeOff(id: string, gearSlot: GearSlot) {
    this.gear.takeOff(id, gearSlot);
  }

  /** Whether this player can see the ground item with this id; the room sends them only those. */
  canSee(id: string, groundItem: string) {
    return this.inventory.canSee(id, groundItem);
  }

  /** Restores the stalls and strongboxes this player emptied before leaving, as the events that emptied them. */
  emptiedFor(id: string) {
    return this.thieving.emptiedFor(id);
  }

  /** One tick, in the order of spec §6. */
  tick() {
    this.state.tick++;
    this.applyIntents();
    this.walking.advance();
    for (const skill of GATHERING_SKILLS) this.gathering.advance(skill);
    this.firemaking.advanceFires();
    this.making.advance();
    this.firemaking.advanceLighting();
    this.windows.advanceVisits();
    this.thieving.advance();
    this.inventory.advanceTakes();
    this.fighting.advancePlayerSwings();
    this.walking.syncActions();
    this.fighting.advanceEnemies();
    this.advancePlayerTimers();
    this.sites.advance();
    for (const enemy of this.enemies.returnDead(this.state.tick))
      this.events.push({ type: "enemyReturned", enemy });
    this.world.groundItems.advance(this.state.tick);
    this.store.advance(this.state.tick);
  }

  private applyIntents() {
    for (const [id, intent] of this.queuedActions)
      this.walking.start(id, intent);
    this.queuedActions.clear();
    for (const [id, slot] of this.world.queuedEats) this.eating.eat(id, slot);
    this.world.queuedEats.clear();
    for (const [id, { slot, amount }] of this.world.queuedDrops)
      this.world.dropSlot(id, slot, amount);
    this.world.queuedDrops.clear();
    for (const id of this.queuedLogouts) {
      const refusal = logoutRefusal(this.lockRunning(id));
      if (refusal)
        this.events.push({ type: "told", player: id, line: refusal });
      else this.loggedOut.push(id);
    }
    this.queuedLogouts.clear();
  }

  /** Each player's respawn once their death is over, or else their healing (spec §6). */
  private advancePlayerTimers() {
    for (const id of this.world.unsyncedPlayers.keys()) {
      if (this.world.player(id).dead) this.fighting.respawnIfDue(id);
      else this.eating.heal(id, this.state.tick);
    }
  }
}
