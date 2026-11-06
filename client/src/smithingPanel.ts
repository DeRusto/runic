import {
  costsOf,
  countOf,
  MAKE_INTENT,
  makeRefusal,
  RECIPES,
  tilesApart,
  WALK_INTENT,
  type RecipeItem,
  type StationKind,
} from "@runic/shared";
import type { SyncedPlayer } from "./characterSheet.ts";
import { itemName } from "./itemIcons.ts";
import type { WorldConnection } from "./players.ts";
import { stationTile } from "./stations.ts";

const part = () => document.createElement("span");

/**
 * The panel a click on a station opens, once the player is next to it. Returns how to ask
 * for it. Rows are only ever changed in place, or a patch landing between a press and its
 * release would lose the click.
 */
export function showSmithingPanel(room: WorldConnection) {
  const panel = document.getElementById("smithing")!;
  const title = document.getElementById("smithing-title")!;
  /** The station being walked to, whose panel opens on arrival. */
  let walkingTo: StationKind | undefined;
  const close = () => {
    walkingTo = undefined;
    panel.hidden = true;
  };

  const rows = (Object.keys(RECIPES) as RecipeItem[]).map((item) => {
    const row = document.createElement("div");
    const [name, cost, level, reason] = [part(), part(), part(), part()];
    name.textContent = itemName(item);
    level.textContent = `Smithing ${RECIPES[item].level}`;
    const button = (label: string, all: boolean) => {
      const make = document.createElement("button");
      make.type = "button";
      make.textContent = label;
      make.onclick = () => room.send(MAKE_INTENT, { item, all });
      return make;
    };
    const buttons = [button("Make 1", false), button("Make all", true)];
    row.append(name, cost, level, reason, ...buttons);
    return { item, row, cost, reason, buttons };
  });
  document
    .getElementById("smithing-rows")!
    .replaceChildren(...rows.map(({ row }) => row));

  const draw = (me: SyncedPlayer) => {
    for (const { item, row, cost, reason, buttons } of rows) {
      const refusal = makeRefusal(item, me);
      row.className = refusal ? "cant" : "";
      reason.textContent = refusal ?? "";
      cost.textContent = costsOf(item)
        .map(
          ([material, count]) =>
            `${count} ${itemName(material)} (have ${countOf(material, me)})`,
        )
        .join(", ");
      for (const make of buttons) make.disabled = !!refusal;
    }
  };

  const show = (station: StationKind, me: SyncedPlayer) => {
    walkingTo = undefined;
    title.textContent = itemName(station);
    for (const { item, row } of rows)
      row.hidden = RECIPES[item].station !== station;
    draw(me);
    panel.hidden = false;
  };

  close();
  document.getElementById("smithing-close")!.onclick = close;
  room.onStateChange((state) => {
    const me = state.players.get(room.sessionId);
    if (!me) return;
    if (me.dead) close();
    else if (walkingTo && tilesApart(me, stationTile(walkingTo)) <= 1)
      show(walkingTo, me);
    else if (!panel.hidden) draw(me);
  });

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };
  // A press, so it closes before the click it belongs to can open it again or act on the world.
  const onPress = (event: PointerEvent) => {
    if (!panel.contains(event.target as Node)) close();
  };
  document.addEventListener("keydown", onKey);
  document.addEventListener("pointerdown", onPress);
  room.onLeave(() => {
    close();
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("pointerdown", onPress);
  });

  return (station: StationKind) => {
    const me = room.state.players.get(room.sessionId);
    if (!me || me.dead) return;
    const tile = stationTile(station);
    if (tilesApart(me, tile) <= 1) return show(station, me);
    close();
    walkingTo = station;
    // A plain walk, which stops next to a tile that blocks and leaves the player idle.
    room.send(WALK_INTENT, tile);
  };
}
