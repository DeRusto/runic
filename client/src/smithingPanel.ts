import {
  costsOf,
  levelRefusal,
  MAKE_INTENT,
  makeRefusal,
  RECIPES,
  TIERS,
  tilesApart,
  WALK_INTENT,
  type RecipeItem,
  type StationKind,
} from "@runic/shared";
import type { SyncedPlayer } from "./characterSheet.ts";
import { iconUrl, itemName } from "./itemIcons.ts";
import { addPanel } from "./panels.ts";
import type { WorldConnection } from "./players.ts";
import { stationTile } from "./stations.ts";
import { itemTipParts, recipeTip, type ItemTip } from "./itemTip.ts";
import { addTip } from "./tooltip.ts";

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
  /** The station whose panel is open. */
  let at: StationKind | undefined;
  const close = () => {
    walkingTo = at = undefined;
    panel.hidden = true;
    placed.closed();
  };
  const placed = addPanel(panel, close);

  const items = Object.keys(RECIPES) as RecipeItem[];
  const sections = (["furnace", "anvil"] as const).flatMap((station) =>
    TIERS.map((tier) => {
      const section = document.createElement("details");
      const header = document.createElement("summary");
      const [name, gate] = [part(), part()];
      name.textContent = itemName(tier);
      header.append(name, gate);
      const recipes = items.filter(
        (item) => RECIPES[item].station === station && item.startsWith(tier),
      );
      const rows = recipes.map((item) => {
        const row = document.createElement("div");
        const icon = document.createElement("img");
        icon.src = iconUrl(item);
        icon.alt = "";
        const [name, cost] = [part(), part()];
        // At the anvil the tier's header names the metal, so a row names only the piece.
        name.textContent =
          station === "anvil" ? item.slice(tier.length) : itemName(item);
        const button = (label: string, all: boolean) => {
          const make = document.createElement("button");
          make.type = "button";
          make.textContent = label;
          make.ariaLabel = `${label} ${itemName(item)}`;
          // Off by aria-disabled, not disabled, so the pointer over it still shows the row's tooltip.
          make.onclick = () => {
            if (make.ariaDisabled !== "true")
              room.send(MAKE_INTENT, { item, all });
          };
          return make;
        };
        const buttons = [button("Make 1", false), button("Make all", true)];
        row.append(icon, name, cost, ...buttons);
        // Bars are always the tier's own, so the line can say just "bars".
        const short = costsOf(item)
          .map(([material, count]) =>
            material === `${tier}Bar`
              ? `${count} bars`
              : `${count} ${itemName(material)}`,
          )
          .join(" + ");
        // Filled in on each draw, as the materials held and any refusal change.
        const entry = {
          item,
          row,
          cost,
          short,
          buttons,
          tip: undefined as ItemTip | undefined,
        };
        addTip(row, () => (entry.tip ? itemTipParts(entry.tip) : ""));
        return entry;
      });
      section.append(header, ...rows.map(({ row }) => row));
      return { station, section, gate, first: recipes[0]!, rows };
    }),
  );
  const rows = sections.flatMap((s) => s.rows);
  document
    .getElementById("smithing-rows")!
    .replaceChildren(...sections.map(({ section }) => section));

  const draw = (me: SyncedPlayer) => {
    for (const entry of rows) {
      const { item, row, cost, short, buttons } = entry;
      const refusal = makeRefusal(item, me);
      row.className = refusal ? "cant" : "";
      cost.textContent = [short, refusal].filter(Boolean).join(" · ");
      entry.tip = recipeTip(item, me);
      for (const make of buttons) make.ariaDisabled = String(!!refusal);
    }
    for (const { gate, first } of sections)
      gate.textContent = levelRefusal(first, me)
        ? `${RECIPES[first].skill} ${RECIPES[first].level}`
        : "";
  };

  const show = (station: StationKind, me: SyncedPlayer) => {
    walkingTo = undefined;
    at = station;
    title.textContent = itemName(station);
    // Folding starts over at each opening: the tiers the player has reached open, the rest fold.
    for (const s of sections) {
      s.section.hidden = s.station !== station;
      s.section.open = !levelRefusal(s.first, me);
    }
    draw(me);
    panel.hidden = false;
    placed.opened();
  };

  close();
  document.getElementById("smithing-close")!.onclick = close;
  room.onStateChange((state) => {
    const me = state.players.get(room.sessionId);
    if (!me) return;
    if (me.dead) close();
    else if (walkingTo && tilesApart(me, stationTile(walkingTo, me)) <= 1)
      show(walkingTo, me);
    // Panels stay open through presses elsewhere; walking away is what closes this one (spec §6).
    else if (at && tilesApart(me, stationTile(at, me)) > 1) close();
    else if (at) draw(me);
  });

  // A press on the way changes the player's mind, so the panel doesn't open on arrival.
  // Any press counts, even on another panel: this panel is shut on the way, so none lands on it.
  const onPress = () => (walkingTo = undefined);
  document.addEventListener("pointerdown", onPress);
  room.onLeave(() => {
    close();
    document.removeEventListener("pointerdown", onPress);
  });

  return (station: StationKind) => {
    const me = room.state.players.get(room.sessionId);
    if (!me || me.dead) return;
    const tile = stationTile(station, me);
    if (tilesApart(me, tile) <= 1) return show(station, me);
    close();
    walkingTo = station;
    // A plain walk, which stops next to a tile that blocks and leaves the player idle.
    room.send(WALK_INTENT, tile);
  };
}
