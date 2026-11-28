import { logoutRefusal } from "@runic/shared";
import type { World } from "./worldContext.ts";

/** Log out intents, refused while the combat lock runs or during a crossing, and accepted ones kept for the room to disconnect. */
export class Logouts {
  private queued = new Set<string>();
  /** Players whose log out intent was accepted, for the room to disconnect. */
  readonly loggedOut: string[] = [];

  constructor(private readonly world: World) {}

  queue(id: string) {
    if (this.world.state.players.has(id) && !this.world.isCrossing(id))
      this.queued.add(id);
  }

  /** A leaver's or dropped player's queued log out goes with them. */
  forget(id: string) {
    this.queued.delete(id);
  }

  /** Each queued log out goes through, or is told why not. */
  apply() {
    for (const id of this.queued) {
      const refusal = logoutRefusal(this.world.lockRunning(id));
      if (refusal) this.world.tell(id, refusal);
      else this.loggedOut.push(id);
    }
    this.queued.clear();
  }
}
