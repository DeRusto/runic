/**
 * A player busy for a few ticks (#236): they can't act or move, and the server ignores their
 * clicks. `hittable` says whether enemies can still hit them: on for Thieving's stun, off for
 * Agility's crossing. It ends on `endTick`.
 */
export type Busy = { endTick: number; hittable: boolean };

/** Whether a busy state is still running on this tick. */
export const isBusy = (busy: Busy | undefined, tick: number) =>
  busy !== undefined && tick < busy.endTick;

/** Whether enemies may notice and hit a player in this busy state, if any. */
export const canBeHit = (busy: Busy | undefined, tick: number) =>
  !isBusy(busy, tick) || busy!.hittable;
