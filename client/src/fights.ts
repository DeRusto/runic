import {
  EVENTS,
  levelFor,
  pickIntervalTicks,
  TICK_MS,
  type WorldEvent,
} from "@runic/shared";
import { revealPick } from "./bottomBar.ts";
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
/** How far through `PickUp` the result of a pick shows (spec §7). */
const PICK_RESULT_AT = 0.4;
const EAT_CLIP_SPEED = 1.33;

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
        const spider = spiderFigures.get(event.spider)!;
        setTimeout(() => spider.dieAndSink("Spider_Death"), PLAYER_CONTACT_MS);
      } else if (event.type === "spiderReturned") {
        spiderFigures.get(event.spider)!.reappear();
      } else if (event.type === "pick") {
        const figure = playerFigures.get(event.player);
        const player = room.state.players.get(event.player);
        if (!figure || !player) continue;
        const interval = pickIntervalTicks(levelFor(player.foragingXp));
        const clipMs = figure.onceWithin("PickUp", interval * TICK_MS);
        setTimeout(() => {
          playerOverheads
            .get(event.player)
            ?.say(event.success ? "Picked!" : "No luck");
          if (event.player === room.sessionId) revealPick();
        }, PICK_RESULT_AT * clipMs);
      } else if (event.type === "eaten") {
        playerOverheads.get(event.player)?.pop(`+${event.healed}`, "heal");
        const figure = playerFigures.get(event.player);
        if (figure && !figure.moving) figure.once("Use_Item", EAT_CLIP_SPEED);
      }
    }
  });
}
