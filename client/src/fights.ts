import {
  EVENTS,
  levelFor,
  pickIntervalTicks,
  TICK_MS,
  type WorldEvent,
} from "@runic/shared";
import { holdPick, printChatLine, revealPick } from "./bottomBar.ts";
import { swingFor } from "./characters.ts";
import {
  playerFigures,
  playerOverheads,
  type WorldConnection,
} from "./players.ts";
import { ENEMY_CLIPS, enemyFigures, enemyOverheads } from "./enemies.ts";
import type { Overhead } from "./overhead.ts";
import { stationTile } from "./stations.ts";

// The moment the clip connects (spec §7). The server decided on the tick.
const ENEMY_CONTACT_MS = 450;
/** How far through `PickUp` or `Pickaxing` the result shows (spec §7). */
const PICK_RESULT_AT = 0.4;
const EAT_CLIP_SPEED = 1.33;

/** Holds back a blow's number and bar until the clip connects. `onHit` runs then too, if it landed. */
function atContact(
  overhead: Overhead | undefined,
  damage: number,
  contactMs: number,
  onHit: () => void,
) {
  overhead?.holdBlow(damage);
  setTimeout(() => {
    overhead?.showBlow(damage);
    if (damage) onHit();
  }, contactMs);
}

/** Plays each tick's events on the figures. */
export function showFights(room: WorldConnection) {
  const clipsOf = (id: string) => ENEMY_CLIPS[room.state.enemies.get(id)!.kind];

  // A reconnect brings the state, just after onReconnect, but not the events missed, so a death
  // or return may be owed.
  room.onReconnect(() =>
    room.onStateChange.once(() => {
      room.state.players.forEach((player, id) => {
        const figure = playerFigures.get(id);
        if (player.dead && !figure?.downed) figure?.alreadyDown("Death_A");
        else if (!player.dead && figure?.downed) figure.respawn();
      });
      room.state.enemies.forEach((enemy, id) => {
        const figure = enemyFigures.get(id)!;
        const dead = enemy.state === "dead";
        if (dead && !figure.downed)
          figure.dieAndSink(ENEMY_CLIPS[enemy.kind].death);
        else if (!dead && figure.downed) figure.reappear();
      });
    }),
  );

  room.onMessage(EVENTS, (events: WorldEvent[]) => {
    // A death follows its killing swing in the same batch, and falls when that swing connects.
    let killingContactMs = 0;
    for (const event of events) {
      if (event.type === "playerSwing") {
        const attacker = playerFigures.get(event.player);
        const enemy = enemyFigures.get(event.enemy)!;
        const from = room.state.players.get(event.player);
        // The patch came just before this message, so state.tick is this swing's tick for every viewer.
        const { clip, contactMs } = swingFor(
          from?.weapon ?? "",
          event.player,
          room.state.tick,
        );
        attacker?.once(clip);
        killingContactMs = contactMs;
        atContact(
          enemyOverheads.get(event.enemy),
          event.damage,
          contactMs,
          () => {
            enemy.flash();
            if (from) enemy.nudgeFrom(from);
          },
        );
      } else if (event.type === "enemySwing") {
        enemyFigures.get(event.enemy)!.once(clipsOf(event.enemy).attack);
        atContact(
          playerOverheads.get(event.player),
          event.damage,
          ENEMY_CONTACT_MS,
          () => {
            const victim = playerFigures.get(event.player);
            if (victim && !victim.playingOnce) victim.once("Hit_A");
          },
        );
      } else if (event.type === "enemyDied") {
        const enemy = enemyFigures.get(event.enemy)!;
        const { death } = clipsOf(event.enemy);
        setTimeout(() => enemy.dieAndSink(death), killingContactMs);
      } else if (event.type === "playerDied") {
        setTimeout(
          () => playerFigures.get(event.player)?.once("Death_A", 1, true),
          ENEMY_CONTACT_MS,
        );
      } else if (event.type === "playerRespawned") {
        playerFigures.get(event.player)?.respawn();
      } else if (event.type === "enemyReturned") {
        enemyFigures.get(event.enemy)!.reappear();
      } else if (event.type === "pick" || event.type === "mine") {
        const mining = event.type === "mine";
        const figure = playerFigures.get(event.player);
        const player = room.state.players.get(event.player);
        if (!figure || !player) continue;
        if (event.success && event.player === room.sessionId) holdPick();
        const interval = pickIntervalTicks(
          levelFor(mining ? player.miningXp : player.foragingXp),
        );
        const clipMs = figure.onceWithin(
          mining ? "Pickaxing" : "PickUp",
          interval * TICK_MS,
        );
        setTimeout(() => {
          playerOverheads
            .get(event.player)
            ?.pop(
              event.success ? (mining ? "Mined!" : "Picked!") : "No luck",
              "pick",
            );
          if (event.player === room.sessionId) revealPick();
        }, PICK_RESULT_AT * clipMs);
      } else if (event.type === "make") {
        const figure = playerFigures.get(event.player);
        if (!figure) continue;
        const hammer = event.station === "anvil";
        figure.work = { tile: stationTile(event.station), hammer };
        figure.onceWithin(
          hammer ? "Hammering" : "Working_A",
          event.ticks * TICK_MS,
        );
      } else if (event.type === "eaten") {
        const figure = playerFigures.get(event.player);
        if (figure && !figure.moving) figure.once("Use_Item", EAT_CLIP_SPEED);
      } else if (event.type === "told") {
        if (event.player === room.sessionId) printChatLine(event.line);
      }
    }
  });
}
