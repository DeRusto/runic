import { Room, type Client } from "@colyseus/core";
import {
  parseRegion,
  REGION_GRID,
  TARGET_INTENT,
  TICK_DRIVER_MS,
  WALK_INTENT,
  type Tile,
} from "@runic/shared";
import { accountForToken } from "./accounts.ts";
import { Simulation } from "./simulation.ts";
import { tickStepper } from "./tickStepper.ts";

export class WorldRoom extends Room {
  autoDispose = false;
  sim = new Simulation(parseRegion(REGION_GRID), Math.random);
  state = this.sim.state;

  messages = {
    [WALK_INTENT]: (client: Client, to: Tile) =>
      this.sim.queueWalk(client.sessionId, to),
    [TARGET_INTENT]: (client: Client, spider: string) =>
      this.sim.queueTarget(client.sessionId, spider),
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
        this.broadcastPatch();
      }),
      TICK_DRIVER_MS,
    );
    // After the timestep, never as a class field: with no step set yet, null starts
    // a 16 ms clock.tick() loop that eats the step's deltaTime and starves it.
    this.patchRate = null;
  }

  onJoin(client: Client) {
    this.sim.addPlayer(client.sessionId);
  }

  onLeave(client: Client) {
    this.sim.removePlayer(client.sessionId);
  }
}
