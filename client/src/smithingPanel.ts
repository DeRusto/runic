import {
  costsOf,
  countOf,
  MAKE_INTENT,
  makeRefusal,
  RECIPES,
  type RecipeItem,
  type StationKind,
} from "@runic/shared";
import type { SyncedPlayer } from "./characterSheet.ts";
import { itemName } from "./itemIcons.ts";
import type { WorldConnection } from "./players.ts";

const part = () => document.createElement("span");

/**
 * The panel a click on a station opens, with no server involved until a pick. Returns how to
 * open it. Rows are only ever changed in place, or a patch landing between a press and its
 * release would lose the click.
 */
export function showSmithingPanel(room: WorldConnection) {
  const panel = document.getElementById("smithing")!;
  const title = document.getElementById("smithing-title")!;
  const close = () => {
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
      make.onclick = () => {
        close();
        room.send(MAKE_INTENT, { item, all });
      };
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

  close();
  room.onStateChange((state) => {
    const me = state.players.get(room.sessionId);
    if (!me || panel.hidden) return;
    if (me.dead) close();
    else draw(me);
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
    title.textContent = itemName(station);
    for (const { item, row } of rows)
      row.hidden = RECIPES[item].station !== station;
    draw(me);
    panel.hidden = false;
  };
}
