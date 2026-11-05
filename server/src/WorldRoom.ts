import { Room } from "@colyseus/core";
import { schema, t } from "@colyseus/schema";
import { parseRegion, REGION_GRID, TICK_DRIVER_MS } from "@runic/shared";
import { tickStepper } from "./tickStepper.ts";

export const WorldState = schema({ tick: t.uint32().default(0) }, "WorldState");

export class WorldRoom extends Room {
  autoDispose = false;
  state = new WorldState();
  region = parseRegion(REGION_GRID);

  onCreate() {
    // Not setFixedTimestep(step, 1000/300): its 300 ms timer drifts against its own
    // accumulator and runs two ticks back to back every ~30 ticks (see #17).
    this.setTimestep(
      tickStepper(() => {
        this.state.tick++;
        this.broadcastPatch();
      }),
      TICK_DRIVER_MS,
    );
    // After the timestep, never as a class field: with no step set yet, null starts
    // a 16 ms clock.tick() loop that eats the step's deltaTime and starves it.
    this.patchRate = null;
  }
}
