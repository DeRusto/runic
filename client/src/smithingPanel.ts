import {
  AUGMENTATIONS,
  levelRefusal,
  MAKE_INTENT,
  makeRefusal,
  MAKING_SKILLS,
  makingOf,
  materialLines,
  RECIPES,
  TIERS,
  tilesApart,
  WALK_INTENT,
  type AugmentationKind,
  type MakeItem,
  type MakingSkill,
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

/** A piece's name without its tier's: `copperThrowingKnife` is "Throwing knife" (#228). */
const pieceName = (item: string, tier: string) => {
  const suffix = itemName(item).replace(itemName(tier), "").trimStart();
  return suffix.charAt(0).toUpperCase() + suffix.slice(1);
};

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
  const augmentations = Object.keys(AUGMENTATIONS) as AugmentationKind[];
  /** One folding section: a Making skill's list, or one tier of it for a tiered skill (#221, #225, #238). */
  const section = (
    places: readonly StationKind[],
    skill: MakingSkill,
    makes: MakeItem[],
    name: string,
    tier?: string,
  ) => {
    const element = document.createElement("details");
    const header = document.createElement("summary");
    const [heading, gate] = [part(), part()];
    heading.textContent = name;
    header.append(heading, gate);
    const rows = makes.map((item) => {
      const row = document.createElement("div");
      const icon = document.createElement("img");
      icon.src = iconUrl(item);
      icon.alt = "";
      const [name, cost] = [part(), part()];
      // In a tier's section the header names the metal, so a row names only the piece:
      // "Chestplate", or "Throwing knife" for the two-word one (#228).
      name.textContent =
        skill === "Smithing" && tier ? pieceName(item, tier) : itemName(item);
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
      const short = materialLines(item)
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
      places,
      element,
      gate,
      first: makes[0]!,
      rows,
    };
  };
  // In the table's order; an augmentation joins its skill's section after the recipes (#225).
  const sections = (Object.keys(MAKING_SKILLS) as MakingSkill[]).flatMap(
    (skill) => {
      const { places, tiered } = MAKING_SKILLS[skill] as {
        places: readonly StationKind[];
        tiered?: boolean;
      };
      const makes: MakeItem[] = [
        ...items.filter((item) => RECIPES[item].skill === skill),
        ...augmentations.filter((kind) => AUGMENTATIONS[kind].skill === skill),
      ];
      return tiered
        ? TIERS.map((tier) =>
            section(
              places,
              skill,
              makes.filter((item) => item.startsWith(tier)),
              itemName(tier),
              tier,
            ),
          )
        : [section(places, skill, makes, skill)];
    },
  );
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
    for (const { gate, first } of sections) {
      const { skill, level } = makingOf(first);
      gate.textContent = levelRefusal(first, me) ? `${skill} ${level}` : "";
    }
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
      s.element.hidden = !s.places.includes(station);
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
    /** Whether the fire the panel is for has burnt out, which a station never does. */
    const burntOut = (fire: Tile | undefined) =>
      !!fire && !state.fires.has(`${fire.x},${fire.y}`);
    if (me.dead || burntOut(atFire)) close();
    else if (burntOut(walkingToFire)) walkingTo = walkingToFire = undefined;
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
