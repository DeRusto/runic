import { EVENTS, type WorldEvent } from "@runic/shared";
import {
  playerFigures,
  playerOverheads,
  type WorldConnection,
} from "./players.ts";
import { spiderFigures, spiderOverheads } from "./spiders.ts";
import type { Overhead } from "./overhead.ts";

// The moment each swing clip connects (spec §7). The server decided on the tick.
const PLAYER_CONTACT_MS = 550;
const SPIDER_CONTACT_MS = 450;

/** Holds back a blow's number and bar until the clip connects. `onHit` runs then too, if it landed. */
function atContact(
  overhead: Overhead | undefined,
  damage: number,
  contactMs: number,
  onHit: () => void,
) {
  if (overhead) overhead.pendingDamage += damage;
  setTimeout(() => {
    if (overhead) {
      overhead.pendingDamage -= damage;
      overhead.pop(
        damage ? String(damage) : "miss",
        damage ? "damage" : "miss",
      );
    }
    if (damage) onHit();
  }, contactMs);
}

/** Plays each tick's events on the figures. */
export function showFights(room: WorldConnection) {
  room.onMessage(EVENTS, (events: WorldEvent[]) => {
    for (const event of events) {
      if (event.type === "playerSwing") {
        const attacker = playerFigures.get(event.player);
        const spider = spiderFigures.get(event.spider)!;
        attacker?.once("Melee_Unarmed_Attack_Punch_A");
        // Where it stood when the blow was decided; it won't move far before contact.
        const from = room.state.players.get(event.player);
        atContact(
          spiderOverheads.get(event.spider),
          event.damage,
          PLAYER_CONTACT_MS,
          () => {
            spider.flash();
            if (from) spider.nudgeFrom(from);
          },
        );
      } else if (event.type === "spiderSwing") {
        spiderFigures.get(event.spider)!.once("Spider_Attack");
        atContact(
          playerOverheads.get(event.player),
          event.damage,
          SPIDER_CONTACT_MS,
          () => {
            const victim = playerFigures.get(event.player);
            if (victim && !victim.playingOnce) victim.once("Hit_A");
          },
        );
      } else if (event.type === "spiderDied") {
        setTimeout(
          () => spiderFigures.get(event.spider)!.dieAndSink("Spider_Death"),
          PLAYER_CONTACT_MS,
        );
      } else if (event.type === "spiderReturned") {
        spiderFigures.get(event.spider)!.reappear();
      }
    }
  });
}
