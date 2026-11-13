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
  type Tile,
} from "@runic/shared";
import type { SyncedPlayer } from "./characterSheet.ts";
import { iconUrl, itemName } from "./itemIcons.ts";
import { addPanel } from "./panels.ts";
import type { WorldConnection } from "./players.ts";
import { stationTile } from "./stations.ts";
import { itemTipParts, recipeTip, type ItemTip } from "./itemTip.ts";
import { addTip } from "./tooltip.ts";

const part = () => document.createElement("span");

/** Which panel section a station opens: a fire cooks like the range (#224). */
const sectionOf = (station: StationKind) =>
  station === "fire" ? "range" : station;

/**
 * The panel a click on a station opens, once the player is next to it. Returns how to ask
 * for it; a fire is asked for with its own tile (#224). Rows are only ever changed in place,
 * or a patch landing between a press and its release would lose the click.
 */
export function showSmithingPanel(room: WorldConnection) {
  const panel = document.getElementById("smithing")!;
  const title = document.getElementById("smithing-title")!;
  /** The station being walked to, whose panel opens on arrival. */
  let walkingTo: StationKind | undefined;
  /** The fire being walked to, by its tile: the station kinds are all fixed places (#224). */
  let walkingToFire: Tile | undefined;
  /** The station whose panel is open, and the fire's tile if it is one. */
  let at: StationKind | undefined;
  let atFire: Tile | undefined;
  const close = () => {
    walkingTo = at = undefined;
    walkingToFire = atFire = undefined;
    panel.hidden = true;
    placed.closed();
  };
  const placed = addPanel(panel, close);

  const items = Object.keys(RECIPES) as RecipeItem[];
  /** One folding section: a tier of the furnace or anvil, or the range's whole Cooking list (#221). */
  const section = (
    station: StationKind,
    recipes: RecipeItem[],
    name: string,
    tier?: string,
  ) => {
    const element = document.createElement("details");
    const header = document.createElement("summary");
    const [heading, gate] = [part(), part()];
    heading.textContent = name;
    header.append(heading, gate);
    const rows = recipes.map((item) => {
      const row = document.createElement("div");
      const icon = document.createElement("img");
      icon.src = iconUrl(item);
      icon.alt = "";
      const [name, cost] = [part(), part()];
      // At the anvil the tier's header names the metal, so a row names only the piece.
      name.textContent =
        station === "anvil" ? item.slice(tier!.length) : itemName(item);
      const button = (label: string, all: boolean) => {
        const make = document.createElement("button");
        make.type = "button";
        make.textContent = label;
        make.ariaLabel = `${label} ${itemName(item)}`;
        // Off by aria-disabled, not disabled, so the pointer over it still shows the row's tooltip.
        make.onclick = () => {
          if (make.ariaDisabled !== "true")
            room.send(MAKE_INTENT, { item, all, at: atFire });
        };
        return make;
      };
      const buttons = [button("Make 1", false), button("Make all", true)];
      row.append(icon, name, cost, ...buttons);
      // Bars are always the tier's own, so the line can say just "bars".
      const short = costsOf(item)
        .map(([material, count]) =>
          tier && material === `${tier}Bar`
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
    element.append(header, ...rows.map(({ row }) => row));
    return {
      station,
      element,
      gate,
      first: recipes[0]!,
      rows,
    };
  };
  const sections = [
    ...(["furnace", "anvil"] as const).flatMap((station) =>
      TIERS.map((tier) =>
        section(
          station,
          items.filter(
            (item) =>
              RECIPES[item].station === station && item.startsWith(tier),
          ),
          itemName(tier),
          tier,
        ),
      ),
    ),
    section(
      "range",
      items.filter((item) => RECIPES[item].station === "range"),
      "Cooking",
    ),
  ];
  const rows = sections.flatMap((s) => s.rows);
  document
    .getElementById("smithing-rows")!
    .replaceChildren(...sections.map(({ element }) => element));

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

  const show = (
    station: StationKind,
    fire: Tile | undefined,
    me: SyncedPlayer,
  ) => {
    walkingTo = walkingToFire = undefined;
    at = station;
    atFire = fire;
    title.textContent = itemName(station);
    // Folding starts over at each opening: the tiers the player has reached open, the rest fold.
    for (const s of sections) {
      s.element.hidden = s.station !== sectionOf(station);
      s.element.open = !levelRefusal(s.first, me);
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
    /** Where to measure reach from: a fire's own tile, or the station's nearest. */
    const reached = (tile: Tile | undefined, kind: StationKind) =>
      tilesApart(me, tile ?? stationTile(kind, me)) <= 1;
    if (me.dead) close();
    else if (walkingTo && reached(walkingToFire, walkingTo))
      show(walkingTo, walkingToFire, me);
    // Panels stay open through presses elsewhere; walking away is what closes this one (spec §6).
    else if (at && !reached(atFire, at)) close();
    else if (at) draw(me);
  });

  // A press on the way changes the player's mind, so the panel doesn't open on arrival.
  // Any press counts, even on another panel: this panel is shut on the way, so none lands on it.
  const onPress = () => (walkingTo = walkingToFire = undefined);
  document.addEventListener("pointerdown", onPress);
  room.onLeave(() => {
    close();
    document.removeEventListener("pointerdown", onPress);
  });

  return (station: StationKind, fire?: Tile) => {
    const me = room.state.players.get(room.sessionId);
    if (!me || me.dead) return;
    const tile = fire ?? stationTile(station, me);
    if (tilesApart(me, tile) <= 1) return show(station, fire, me);
    close();
    walkingTo = station;
    walkingToFire = fire;
    // A plain walk, which stops next to a tile that blocks and leaves the player idle.
    room.send(WALK_INTENT, tile);
  };
}
