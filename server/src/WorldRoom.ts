import {
  ClientState,
  CloseCode,
  Room,
  type Client,
  type Deferred,
} from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import {
  CHAT,
  DROP_INTENT,
  EAT_INTENT,
  EQUIP_INTENT,
  EVENTS,
  FORAGE_INTENT,
  FRIENDS,
  LOGOUT_INTENT,
  MAKE_INTENT,
  MAX_CHAT_LENGTH,
  MINE_INTENT,
  PIN_INTENT,
  PRIVATE_LINE,
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
  type Friend,
  type GearSlot,
  type Tile,
} from "@runic/shared";
import { accountForToken, accountNamed } from "./accounts.ts";
import { addFriend, friendedBy, friendsOf, removeFriend } from "./friends.ts";
import { readSave, writeSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";
import { tickStepper } from "./tickStepper.ts";
import { loadWorldRegion } from "./worldRegion.ts";

export class WorldRoom extends Room {
  autoDispose = false;
  sim = new Simulation(loadWorldRegion(), Math.random);
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
      this.sim.queueGather(client.sessionId, "foraging", bush),
    [MINE_INTENT]: (client: Client, vein: string) =>
      this.sim.queueGather(client.sessionId, "mining", vein),
    [MAKE_INTENT]: (client: Client, intent: { item: string; all: boolean }) =>
      this.sim.queueMake(client.sessionId, intent),
    [VISIT_INTENT]: (client: Client) => this.sim.queueVisit(client.sessionId),
    [EAT_INTENT]: (client: Client, slot: number) =>
      this.sim.queueEat(client.sessionId, slot),
    [DROP_INTENT]: (client: Client, slot: number) =>
      this.sim.queueDrop(client.sessionId, slot),
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
    [FRIENDS]: (client: Client) => this.sendFriends(client),
    // Not through the simulation: chat skips the tick, and a dead player can still talk (D8).
    [CHAT]: (client: Client, line: string) => {
      const text = typeof line === "string" ? line.trim() : "";
      if (!text || text.length > MAX_CHAT_LENGTH) return;
      if (text.startsWith("/")) return this.runCommand(client, text.slice(1));
      const { username } = client.auth;
      this.broadcast(CHAT, {
        id: client.sessionId,
        username,
        text,
      } satisfies ChatLine);
    },
  };

  /** Chat commands by lower-cased name; each gets the trimmed text after the name. */
  private commands: Record<string, (client: Client, args: string) => void> = {
    pm: (client, args) => {
      const [, name, message] = args.match(/^(\S+)\s+(.+)$/s) ?? [];
      if (!name) return this.tell(client, "Usage: /pm <name> <message>");
      const to = this.clients.find(
        (other) =>
          other.auth.username.toLowerCase() === name.toLowerCase() &&
          this.sim.state.players.has(other.sessionId),
      );
      if (!to) return this.tell(client, `${name} is not online.`);
      if (to.auth.id === client.auth.id)
        return this.tell(
          client,
          "You can't send a private message to yourself.",
        );
      this.tell(to, `From ${client.auth.username}: ${message}`);
      this.tell(client, `To ${to.auth.username}: ${message}`);
    },
    // Silent: the friend is never asked or told (Phase 4 map).
    friend: (client, name) => {
      if (!name) return this.tell(client, "Usage: /friend <name>");
      const friend = accountNamed(name);
      if (!friend)
        return this.tell(client, `There is no account named ${name}.`);
      if (friend.id === client.auth.id)
        return this.tell(
          client,
          "You can't add yourself to your friends list.",
        );
      if (!addFriend(client.auth.id, friend.id))
        return this.tell(
          client,
          `${friend.username} is already on your friends list.`,
        );
      this.tell(client, `${friend.username} is now on your friends list.`);
      this.sendFriends(client);
    },
    unfriend: (client, name) => {
      if (!name) return this.tell(client, "Usage: /unfriend <name>");
      const friend = accountNamed(name);
      if (!friend)
        return this.tell(client, `There is no account named ${name}.`);
      if (!removeFriend(client.auth.id, friend.id))
        return this.tell(
          client,
          `${friend.username} is not on your friends list.`,
        );
      this.tell(
        client,
        `${friend.username} is no longer on your friends list.`,
      );
      this.sendFriends(client);
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
        this.showGroundItems();
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
    if (!takingOver.length) this.tellFriendedBy(client, "logged in");
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
    if (loggedIn) this.tellFriendedBy(client, "logged out");
  }

  /**
   * Visibility only grows until a ground item goes. No view.remove is needed then: a view
   * keeps no list of what it holds, and leaving the map clears the item's view bits.
   */
  private showGroundItems() {
    for (const client of this.clients) {
      for (const [id, groundItem] of this.sim.state.groundItems) {
        const { view } = client;
        if (
          view &&
          !view.has(groundItem) &&
          this.sim.canSee(client.sessionId, id)
        )
          view.add(groundItem);
      }
    }
  }

  /** `line` is the chat line after its leading "/". */
  private runCommand(client: Client, line: string) {
    const [name = "", args = ""] = line.split(/\s+(.*)/s);
    const command = Object.hasOwn(this.commands, name.toLowerCase())
      ? this.commands[name.toLowerCase()]
      : undefined;
    if (!command) return this.tell(client, `Unknown command: /${name}`);
    command(client, args.trim());
  }

  /** A chat-box line for this client only. */
  private tell(client: Client, line: string) {
    client.send(PRIVATE_LINE, line);
  }

  private sendFriends(client: Client) {
    const online = new Set(
      this.online()
        .filter((other) => this.sim.state.players.has(other.sessionId))
        .map((other) => other.auth.id),
    );
    client.send(
      FRIENDS,
      friendsOf(client.auth.id).map(({ id, username }): Friend => ({
        username,
        online: online.has(id),
      })),
    );
  }

  /** Tells everyone online who has this player on their friends list, and refreshes their lists. */
  private tellFriendedBy(client: Client, happened: string) {
    const friendedHere = friendedBy(client.auth.id);
    for (const other of this.clients) {
      if (!friendedHere.has(other.auth.id)) continue;
      this.tell(other, `${client.auth.username} has ${happened}`);
      this.sendFriends(other);
    }
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
