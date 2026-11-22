/**
 * Players who can't act or move for a while: their clicks are ignored until it ends. A stun keeps
 * them open to hits; Agility's crossing will not (#236). Nothing here knows why a player is busy.
 */
export class BusyPlayers {
  /** The tick each busy player is free again on, and whether enemies can hit them meanwhile. */
  private busy = new Map<string, { endTick: number; hittable: boolean }>();

  /** Busy from `tick` for `ticks` ticks, replacing any busy time already running. */
  start(
    id: string,
    {
      tick,
      ticks,
      hittable,
    }: { tick: number; ticks: number; hittable: boolean },
  ) {
    this.busy.set(id, { endTick: tick + ticks, hittable });
  }

  isBusy(id: string, tick: number) {
    const busy = this.busy.get(id);
    if (busy && tick >= busy.endTick) this.busy.delete(id);
    return busy !== undefined && tick < busy.endTick;
  }

  /** False only while busy with hits off. */
  canBeHit(id: string, tick: number) {
    return !this.isBusy(id, tick) || this.busy.get(id)!.hittable;
  }

  /** Frees the player at once, on death or leaving. */
  end(id: string) {
    this.busy.delete(id);
  }
}
