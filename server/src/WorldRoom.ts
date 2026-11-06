import {
  ClientState,
  CloseCode,
  Room,
  type Client,
  type Deferred,
} from "@colyseus/core";
import {
  CHAT,
  DISCARD_INTENT,
  EAT_INTENT,
  EVENTS,
  FORAGE_INTENT,
  LOGOUT_INTENT,
  MAX_CHAT_LENGTH,
  parseRegion,
  PIN_INTENT,
  REGION_GRID,
  TARGET_INTENT,
  SAVE_INTERVAL_TICKS,
  TAKEN_OVER_CLOSE_CODE,
  TICK_DRIVER_MS,
  TICK_MS,
  WALK_INTENT,
  type ChatLine,
  type Tile,
} from "@runic/shared";
import { accountForToken } from "./accounts.ts";
import { readSave, writeSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";
import { tickStepper } from "./tickStepper.ts";

export class WorldRoom extends Room {
  autoDispose = false;
  sim = new Simulation(parseRegion(REGION_GRID), Math.random);
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
    [FORAGE_INTENT]: (client: Client, bush: string) =>
      this.sim.queueForage(client.sessionId, bush),
    [EAT_INTENT]: (client: Client, slot: number) =>
      this.sim.queueEat(client.sessionId, slot),
    [DISCARD_INTENT]: (client: Client, slot: number) =>
      this.sim.queueDiscard(client.sessionId, slot),
    [PIN_INTENT]: (
      client: Client,
      intent: { skill: string; pinned: boolean },
    ) => this.sim.pinSkill(client.sessionId, intent),
    [LOGOUT_INTENT]: (client: Client) => this.sim.queueLogout(client.sessionId),
    // Not through the simulation: chat skips the tick, and a dead player can still talk (D8).
    [CHAT]: (client: Client, line: string) => {
      const text = typeof line === "string" ? line.trim() : "";
      if (!text || text.length > MAX_CHAT_LENGTH) return;
      const { username } = client.auth;
      this.broadcast(CHAT, {
        id: client.sessionId,
        username,
        text,
      } satisfies ChatLine);
    },
  };

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
    // A login still waiting below has no player yet, and this newer one replaces it.
    for (const other of this.sameAccount(client)) {
      if (!this.sim.state.players.has(other.sessionId))
        other.leave(TAKEN_OVER_CLOSE_CODE);
    }
    while (this.sameAccount(client).some((other) => this.held(other))) {
      await new Promise((tick) => this.clock.setTimeout(tick, TICK_MS));
      if (client.state === ClientState.LEAVING) return;
    }
    for (const old of this.sameAccount(client)) {
      this.saveAndRemove(old);
      old.leave(TAKEN_OVER_CLOSE_CODE);
    }
    this.sim.addPlayer(
      client.sessionId,
      readSave(client.auth.id),
      client.auth.username,
    );
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
    this.saveAndRemove(client);
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
