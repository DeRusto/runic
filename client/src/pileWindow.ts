import { TAKE_INTENT, WALK_INTENT, type Tile } from "@runic/shared";
import { groundItemLine } from "./groundItems.ts";
import { leftPanel } from "./leftPanels.ts";
import type { WorldConnection } from "./players.ts";

/**
 * The window a click on a pile opens, once the player stands on its tile. It lists only the
 * ground items the player can see (the server sends no others), and a row takes that one.
 * Returns how to ask for it. Rows are only ever changed in place, or a patch landing between
 * a press and its release would lose the click.
 */
export function showPileWindow(room: WorldConnection) {
  const panel = document.getElementById("pile")!;
  const list = document.getElementById("pile-rows")!;
  const rows = new Map<string, HTMLButtonElement>();
  /** The pile's tile while the window is open. */
  let open: Tile | undefined;
  /** The pile being walked to, whose window opens on arrival. */
  let walkingTo: Tile | undefined;
  /** Whether the walk to `walkingTo` has begun, so its end short of the tile can be told from its start. */
  let walked = false;
  const on = (me: Tile, tile: Tile) => me.x === tile.x && me.y === tile.y;

  const close = () => {
    open = walkingTo = undefined;
    panel.hidden = true;
    rows.clear();
    list.replaceChildren();
  };
  const left = leftPanel(close);

  const draw = (tile: Tile) => {
    const state = room.state;
    const me = state.players.get(room.sessionId)?.username ?? "";
    const here = new Set<string>();
    for (const [id, groundItem] of state.groundItems ?? []) {
      if (!on(groundItem, tile)) continue;
      here.add(id);
      if (!rows.has(id)) {
        const row = document.createElement("button");
        row.type = "button";
        row.onclick = () => room.send(TAKE_INTENT, id);
        list.append(row);
        rows.set(id, row);
      }
      rows.get(id)!.textContent = groundItemLine(groundItem, me);
    }
    for (const [id, row] of rows) {
      if (here.has(id)) continue;
      row.remove();
      rows.delete(id);
    }
    if (!rows.size) close();
  };

  const show = (tile: Tile) => {
    walkingTo = undefined;
    open = tile;
    left.opening();
    panel.hidden = false;
    draw(tile);
  };

  close();
  document.getElementById("pile-close")!.onclick = close;
  room.onStateChange((state) => {
    const me = state.players.get(room.sessionId);
    if (!me) return;
    if (me.dead) close();
    else if (walkingTo && on(me, walkingTo)) show(walkingTo);
    // A walk that ends short forgets the pile, or standing there later would open it unasked.
    else if (walkingTo && me.action === "walking") walked = true;
    else if (walkingTo && walked) walkingTo = undefined;
    else if (open && !on(me, open)) close();
    else if (open) draw(open);
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
    left.forget();
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("pointerdown", onPress);
  });

  return ({ x, y }: Tile) => {
    const me = room.state.players.get(room.sessionId);
    if (!me || me.dead) return;
    if (on(me, { x, y })) return show({ x, y });
    close();
    walkingTo = { x, y };
    walked = false;
    room.send(WALK_INTENT, { x, y });
  };
}
