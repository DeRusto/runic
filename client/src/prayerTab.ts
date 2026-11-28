import {
  isBoostPrayer,
  levelFor,
  maxPrayerPoints,
  PRAYER_INTENT,
  prayerRefusal,
  PRAYERS,
  prayersInLevelOrder,
} from "@runic/shared";
import type { SyncedPlayer } from "./characterSheet.ts";
import type { WorldConnection } from "./players.ts";

/**
 * The Prayer tab: the points as a bar and a number, then the twelve prayers in level order, each
 * with its level, drain and effect. Boost prayers are toggle buttons, greyed above the player's
 * level and lit while active; a click turns one on or off, or says in the chat why it can't be
 * turned on. The wards are listed greyed until they are built (Prayer spec §6). Returns what
 * draws the player's own points, level and active prayers.
 */
export function showPrayerTab(
  room: WorldConnection,
  say: (line: string) => void,
) {
  let me: SyncedPlayer | undefined;
  const rows = prayersInLevelOrder().map((prayer) => {
    const { name, level, drain, effect } = PRAYERS[prayer];
    const boost = isBoostPrayer(prayer);
    const row = document.createElement(boost ? "button" : "div");
    row.className = boost ? "prayer" : "prayer ward";
    if (boost) (row as HTMLButtonElement).type = "button";
    const parts = [
      name,
      `Prayer ${level} · Drains ${drain} a minute`,
      effect,
    ].map((text) => {
      const part = document.createElement("span");
      part.textContent = text;
      return part;
    });
    row.append(...parts);
    row.setAttribute(
      "aria-label",
      `${name}: Prayer ${level}, ${effect}, drains ${drain} points a minute${boost ? "" : ", coming soon"}`,
    );
    if (!boost) row.setAttribute("aria-disabled", "true");
    // Off by aria-disabled, not disabled, so a click still says why.
    else
      row.onclick = () => {
        if (!me) return;
        const refusal =
          !me.prayers.includes(prayer) && prayerRefusal(me, prayer);
        if (refusal) say(refusal);
        else room.send(PRAYER_INTENT, prayer);
      };
    return { prayer, level, boost, row };
  });
  document
    .getElementById("prayers")!
    .replaceChildren(...rows.map(({ row }) => row));
  const points = document.getElementById("prayer-tab-points")!;
  const bar = document.getElementById("prayer-tab-bar") as HTMLProgressElement;

  return (player: SyncedPlayer) => {
    me = player;
    const max = maxPrayerPoints(player.prayerXp);
    points.textContent = `Prayer points ${player.prayerPoints} / ${max}`;
    bar.max = max;
    bar.value = player.prayerPoints;
    const level = levelFor(player.prayerXp);
    for (const { prayer, level: needs, boost, row } of rows) {
      if (!boost) continue;
      row.setAttribute("aria-disabled", String(level < needs));
      row.setAttribute("aria-pressed", String(player.prayers.includes(prayer)));
    }
  };
}
