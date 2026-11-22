/**
 * Countdowns kept per player and per thing in the world, such as a stall emptied for one thief
 * or closed to one Marta caught (#252), and a strongbox emptied for one player (#253).
 * Other players and other things are unaffected. Keyed by username, so leaving and joining
 * again can't end one early. Counted in ticks, like every game timer.
 */
export class PlayerTimers {
  /** The tick each timer ends on, by player and thing. */
  private endTicks = new Map<string, number>();

  private static key = (player: string, thing: string) =>
    `${player}\u0000${thing}`;

  /** Starts, or restarts, `player`'s timer on `thing`, running `ticks` from `tick`. */
  start(player: string, thing: string, tick: number, ticks: number) {
    this.endTicks.set(PlayerTimers.key(player, thing), tick + ticks);
  }

  /** Whether `player`'s timer on `thing` is still running on `tick`. */
  running(player: string, thing: string, tick: number) {
    return this.remaining(player, thing, tick) > 0;
  }

  /** Ticks left on `player`'s timer for `thing`. */
  remaining(player: string, thing: string, tick: number) {
    const end = this.endTicks.get(PlayerTimers.key(player, thing));
    return Math.max(0, (end ?? tick) - tick);
  }

  /** Forgets every timer that has ended by `tick`, so the map holds only running ones. */
  forgetEnded(tick: number) {
    for (const [key, endTick] of this.endTicks)
      if (endTick <= tick) this.endTicks.delete(key);
  }

  /** How many timers are kept. */
  get size() {
    return this.endTicks.size;
  }
}
