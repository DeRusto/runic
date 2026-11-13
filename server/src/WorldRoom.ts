import {
  ClientState,
  CloseCode,
  Room,
  type Client,
  type Deferred,
} from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import {
  BANK_MOVE_INTENT,
  CHAT,
  CLOSE_BANK_INTENT,
  DEPOSIT_INTENT,
  DEPOSIT_INVENTORY_INTENT,
  WITHDRAW_INTENT,
  GATHERING,
  GATHERING_SKILLS,
  CHOOSE_INTENT,
  CLOSE_STORE_INTENT,
  DEAL_INTENT,
  DROP_INTENT,
  MOVE_INTENT,
  EAT_INTENT,
  LIGHT_INTENT,
  MIX_INTENT,
  END_TALK_INTENT,
  EQUIP_INTENT,
  EVENTS,
  LIST_FRIENDS_INTENT,
  LIST_IGNORES_INTENT,
  LOGOUT_INTENT,
  MAKE_INTENT,
  MAX_CHAT_LENGTH,
  MAX_CHAT_LINE_LENGTH,
  PIN_INTENT,
  TARGET_INTENT,
  SAVE_INTERVAL_TICKS,
  TAKE_INTENT,
  TAKE_OFF_INTENT,
  TAKEN_OVER_CLOSE_CODE,
  TICK_DRIVER_MS,
  TICK_MS,
  VISIT_INTENT,
  WALK_INTENT,
  type ChatLine,
  type GatheringIntent,
  type Deal,
  type GearSlot,
  type Tile,
} from "@runic/shared";
import { accountForToken } from "./accounts.ts";
import { readSave, writeSave } from "./saves.ts";
import { runCommand } from "./chatCommands.ts";
import { Simulation } from "./simulation.ts";
import {
  ignoredBy,
  sendFriends,
  sendIgnores,
  tellFriendedBy,
} from "./social.ts";
import { tickStepper } from "./tickStepper.ts";
import { loadWorldRegion } from "./worldRegion.ts";

const region = loadWorldRegion();

export class WorldRoom extends Room {
  autoDispose = false;
  sim = new Simulation(region.tiles, Math.random, region.pools);
  state = this.sim.state;
  /** Players whose connection is gone but whose lock still holds them here. */
  private dropped = new Map<
    string,
    { client: Client; seat: Deferred<Client> }
  >();

  messages = {
    [WALK_INTENT]: (client: Client, to: Tile) =>
      this.sim.queueWalk(client.sessionId, to),
    [TARGET_INTENT]: (client: Client, enemy: string) =>
      this.sim.queueTarget(client.sessionId, enemy),
    // Typed by hand, since fromEntries loses the keys the client's send() checks against.
    ...(Object.fromEntries(
      GATHERING_SKILLS.map((skill) => [
        GATHERING[skill].intent,
        (client: Client, site: string) =>
          this.sim.queueGather(client.sessionId, skill, site),
      ]),
    ) as Record<GatheringIntent, (client: Client, site: string) => void>),
    [MAKE_INTENT]: (
      client: Client,
      intent: { item: string; all: boolean; at?: Tile },
    ) => this.sim.queueMake(client.sessionId, intent),
    [VISIT_INTENT]: (
      client: Client,
      visit: { villager: string; then?: string },
    ) => this.sim.queueVisit(client.sessionId, visit?.villager, visit?.then),
    [CHOOSE_INTENT]: (client: Client, choice: number) =>
      this.sim.choose(client.sessionId, choice),
    [END_TALK_INTENT]: (client: Client) => this.sim.endTalk(client.sessionId),
    [DEAL_INTENT]: (client: Client, deal: Deal) =>
      this.sim.deal(client.sessionId, deal),
    [CLOSE_STORE_INTENT]: (client: Client) =>
      this.sim.closeStore(client.sessionId),
    [EAT_INTENT]: (client: Client, slot: number) =>
      this.sim.queueEat(client.sessionId, slot),
    [DROP_INTENT]: (client: Client, drop: { slot: number; amount: number }) =>
      this.sim.queueDrop(client.sessionId, drop?.slot, drop?.amount),
    [MOVE_INTENT]: (client: Client, move: { from: number; to: number }) =>
      this.sim.moveItem(client.sessionId, move?.from, move?.to),
    [MIX_INTENT]: (client: Client, mix: { slot: number }) =>
      this.sim.mix(client.sessionId, mix?.slot),
    [LIGHT_INTENT]: (client: Client, slot: number) =>
      this.sim.queueLight(client.sessionId, slot),
    [DEPOSIT_INTENT]: (
      client: Client,
      deposit: { slot: number; amount: number },
    ) => this.sim.deposit(client.sessionId, deposit?.slot, deposit?.amount),
    [WITHDRAW_INTENT]: (
      client: Client,
      withdraw: { slot: number; amount: number },
    ) => this.sim.withdraw(client.sessionId, withdraw?.slot, withdraw?.amount),
    [DEPOSIT_INVENTORY_INTENT]: (client: Client) =>
      this.sim.depositInventory(client.sessionId),
    [BANK_MOVE_INTENT]: (client: Client, move: { from: number; to: number }) =>
      this.sim.moveBankItem(client.sessionId, move?.from, move?.to),
    [CLOSE_BANK_INTENT]: (client: Client) =>
      this.sim.closeBank(client.sessionId),
    [TAKE_INTENT]: (client: Client, groundItem: string) =>
      this.sim.queueTake(client.sessionId, groundItem),
    [EQUIP_INTENT]: (client: Client, slot: number) =>
      this.sim.equip(client.sessionId, slot),
    [TAKE_OFF_INTENT]: (client: Client, slot: GearSlot) =>
      this.sim.takeOff(client.sessionId, slot),
    [PIN_INTENT]: (
      client: Client,
      intent: { skill: string; pinned: boolean },
    ) => this.sim.pinSkill(client.sessionId, intent),
    [LOGOUT_INTENT]: (client: Client) => this.sim.queueLogout(client.sessionId),
    // Asked for by the client once it listens, since a message sent during the join would arrive first.
    [LIST_FRIENDS_INTENT]: (client: Client) => sendFriends(this, client),
    [LIST_IGNORES_INTENT]: (client: Client) => sendIgnores(client),
    // Not through the simulation: chat skips the tick, and a dead player can still talk (D8).
    [CHAT]: (client: Client, line: string) => {
      const text = typeof line === "string" ? line.trim() : "";
      // A command limits its own message; this only bounds the line.
      if (text.startsWith("/") && text.length <= MAX_CHAT_LINE_LENGTH)
        return runCommand(this, client, text.slice(1));
      if (!text.startsWith("/")) this.say(client, text, false);
    },
  };

  /** Public chat or, from `/e`, an emote: `text` is trimmed, and one empty or over the limit is dropped. */
  say(client: Client, text: string, emote: boolean) {
    if (!text || text.length > MAX_CHAT_LENGTH) return;
    const { id, username } = client.auth;
    const ignoring = ignoredBy(id);
    // Dropped here, not hidden by the client, so an ignored player's words never reach you.
    this.broadcast(
      CHAT,
      { id: client.sessionId, username, text, emote } satisfies ChatLine,
      { except: this.clients.filter((other) => ignoring.has(other.auth.id)) },
    );
  }

  // Static, so a refused token fails at matchmaking, before any seat is reserved.
  static async onAuth(token: string) {
    return accountForToken(token);
  }

  onCreate() {
    // Not setFixedTimestep(step, 1000/300): its 300 ms timer drifts against its own
    // accumulator and runs two ticks back to back every ~30 ticks (see #17).
    this.setTimestep(
      tickStepper(() => {
        this.sim.tick();
        for (const id of this.sim.loggedOut.splice(0)) {
          this.clients.getById(id)?.leave(CloseCode.CONSENTED);
        }
        for (const [id, { seat }] of this.dropped) {
          if (!this.sim.lockRunning(id)) seat.reject();
        }
        if (this.sim.state.tick % SAVE_INTERVAL_TICKS === 0)
          this.saveEveryone();
        this.updateViews();
        this.broadcastPatch();
        const events = this.sim.events.splice(0);
        if (events.length) this.broadcast(EVENTS, events);
      }),
      TICK_DRIVER_MS,
    );
    // After the timestep, never as a class field: with no step set yet, null starts
    // a 16 ms clock.tick() loop that eats the step's deltaTime and starves it.
    this.patchRate = null;
  }

  async onJoin(client: Client) {
    // Before any wait, so no patch reaches this client before its view filters ground items.
    client.view = new StateView();
    // A login still waiting below has no player yet, and this newer one replaces it.
    for (const other of this.sameAccount(client)) {
      if (!this.sim.state.players.has(other.sessionId))
        other.leave(TAKEN_OVER_CLOSE_CODE);
    }
    while (this.sameAccount(client).some((other) => this.held(other))) {
      await new Promise((tick) => this.clock.setTimeout(tick, TICK_MS));
      if (client.state === ClientState.LEAVING) return;
    }
    const takingOver = this.sameAccount(client);
    // A login kicked above can still be leaving; only one with a character makes this a take-over.
    const loggedInElsewhere = takingOver.some((old) =>
      this.sim.state.players.has(old.sessionId),
    );
    for (const old of takingOver) {
      this.saveAndRemove(old);
      old.leave(TAKEN_OVER_CLOSE_CODE);
    }
    this.sim.addPlayer(
      client.sessionId,
      readSave(client.auth.id),
      client.auth.username,
    );
    // A take-over is the same player logging in again, so their friends hear nothing.
    if (!loggedInElsewhere) tellFriendedBy(this, client, "logged in");
  }

  /**
   * With no seat held, core goes straight on to onLeave. A shutdown comes through here
   * too: it can't hold a seat, and its onLeave saves everyone before the database closes.
   */
  onDrop(client: Client, code: number) {
    const id = client.sessionId;
    if (code === CloseCode.SERVER_SHUTDOWN || !this.sim.lockRunning(id)) return;
    this.sim.dropPlayer(id);
    this.dropped.set(id, {
      client,
      seat: this.allowReconnection(client, "manual"),
    });
  }

  onReconnect(client: Client) {
    this.dropped.delete(client.sessionId);
    this.sim.reconnectPlayer(client.sessionId);
  }

  onLeave(client: Client) {
    this.dropped.delete(client.sessionId);
    // No player means a take-over already removed it, or the login never finished.
    const loggedIn = this.sim.state.players.has(client.sessionId);
    this.saveAndRemove(client);
    if (loggedIn) tellFriendedBy(this, client, "logged out");
  }

  /**
   * Adds to each view its own player and the ground items it can see. Visibility only grows until a ground item goes. No view.remove is needed then: a view
   * keeps no list of what it holds, and leaving the map clears the item's view bits.
   */
  private updateViews() {
    for (const client of this.clients) {
      const { view } = client;
      // Their own player, so their bank reaches them alone. Here rather than on join, so a reconnect's view gets it too.
      const own = this.sim.state.players.get(client.sessionId);
      if (view && own && !view.has(own)) view.add(own);
      for (const [id, groundItem] of this.sim.state.groundItems) {
        if (
          view &&
          !view.has(groundItem) &&
          this.sim.canSee(client.sessionId, id)
        )
          view.add(groundItem);
      }
    }
  }

  /** The one definition of online, for chat commands and friends lists (see `World`). */
  onlinePlayers() {
    return this.online().filter((client) =>
      this.sim.state.players.has(client.sessionId),
    );
  }

  private online() {
    return [
      ...this.clients,
      ...[...this.dropped.values()].map(({ client }) => client),
    ];
  }

  private sameAccount(client: Client) {
    return this.online().filter(
      (other) => other !== client && other.auth.id === client.auth.id,
    );
  }

  /** Dropped and not yet gone counts, or onLeave's save could come after the new login's read. */
  private held(client: Client) {
    return (
      this.dropped.has(client.sessionId) ||
      this.sim.lockRunning(client.sessionId)
    );
  }

  /** Does nothing for a client who was already taken over. */
  private saveAndRemove(client: Client) {
    this.save(client);
    this.sim.removePlayer(client.sessionId);
  }

  private saveEveryone() {
    this.online().forEach((client) => this.save(client));
  }

  private save(client: Client) {
    const save = this.sim.saveOf(client.sessionId);
    if (save) writeSave(client.auth.id, save);
  }
}
