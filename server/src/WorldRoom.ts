import { CloseCode, Room, type Client } from "@colyseus/core";
import {
  LOGOUT_INTENT,
  parseRegion,
  REGION_GRID,
  SAVE_INTERVAL_TICKS,
  TAKEN_OVER_CLOSE_CODE,
  TICK_DRIVER_MS,
  WALK_INTENT,
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

  messages = {
    [WALK_INTENT]: (client: Client, to: Tile) =>
      this.sim.queueWalk(client.sessionId, to),
    [LOGOUT_INTENT]: (client: Client) => this.sim.queueLogout(client.sessionId),
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
        if (this.sim.state.tick % SAVE_INTERVAL_TICKS === 0)
          this.saveEveryone();
        this.broadcastPatch();
      }),
      TICK_DRIVER_MS,
    );
    // After the timestep, never as a class field: with no step set yet, null starts
    // a 16 ms clock.tick() loop that eats the step's deltaTime and starves it.
    this.patchRate = null;
  }

  onJoin(client: Client) {
    const old = this.clients.find(
      (other) => other !== client && other.auth.id === client.auth.id,
    );
    if (old) {
      this.saveAndRemove(old);
      old.leave(TAKEN_OVER_CLOSE_CODE);
    }
    this.sim.addPlayer(client.sessionId, readSave(client.auth.id));
  }

  // A clean shutdown closes every client through here too, before the database closes.
  onLeave(client: Client) {
    this.saveAndRemove(client);
  }

  /** Does nothing for a client who was already taken over. */
  private saveAndRemove(client: Client) {
    this.save(client);
    this.sim.removePlayer(client.sessionId);
  }

  private saveEveryone() {
    this.clients.forEach((client) => this.save(client));
  }

  private save(client: Client) {
    const save = this.sim.saveOf(client.sessionId);
    if (save) writeSave(client.auth.id, save);
  }
}
