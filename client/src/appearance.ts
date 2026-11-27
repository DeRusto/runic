import {
  APPEARANCE_INTENT,
  KNIGHT_COLORS,
  SKIN_TONES,
  type KnightColor,
  type SkinTone,
} from "@runic/shared";
import * as THREE from "three";
import type { SyncedPlayer } from "./characterSheet.ts";
import type { WorldConnection } from "./players.ts";

/**
 * How each color repaints the Knight's red atlas swatch, its cape, as a canvas filter over the
 * model's own red; `swatch` shows it on the color's button.
 */
const KNIGHT_LOOKS: Record<KnightColor, { filter: string; swatch: string }> = {
  crimson: { filter: "none", swatch: "#d32027" },
  azure: { filter: "hue-rotate(215deg)", swatch: "#2a6bd3" },
  emerald: { filter: "hue-rotate(130deg)", swatch: "#1f9e4a" },
  gold: {
    filter: "hue-rotate(50deg) saturate(1.6) brightness(1.9)",
    swatch: "#e0a920",
  },
  violet: { filter: "hue-rotate(280deg)", swatch: "#8a3ad3" },
  onyx: { filter: "grayscale(1) brightness(0.45)", swatch: "#4a4a4a" },
  ivory: { filter: "grayscale(1) brightness(3.2)", swatch: "#eeeae0" },
};

/** Each skin tone's color, multiplied over a grey copy of the face's swatches; Fair keeps the model's own. */
const SKIN_LOOKS: Record<SkinTone, string> = {
  porcelain: "#ffe6d2",
  fair: "#f6c9a4",
  tan: "#d9a06e",
  olive: "#b5875a",
  brown: "#8a5636",
  deep: "#5a3522",
};

/** The Knight atlas is an 8 by 4 grid; these are [column, row] of the swatches each look repaints. */
const CAPE_SWATCHES = [[0, 1]] as const;
const SKIN_SWATCHES = [
  [0, 0],
  [1, 0],
] as const;

/** One labelled group of toggle buttons, each sending its own id. */
function lookButtons<Id extends string>(
  room: WorldConnection,
  groupId: string,
  label: string,
  names: Record<Id, string>,
  swatchOf: (id: Id) => string,
) {
  const group = document.getElementById(groupId)!;
  group.setAttribute("aria-label", label);
  const buttons = (Object.keys(names) as Id[]).map((id) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = names[id];
    button.style.borderLeft = `8px solid ${swatchOf(id)}`;
    button.onclick = () => room.send(APPEARANCE_INTENT, id);
    return { id, button };
  });
  group.replaceChildren(...buttons.map(({ button }) => button));
  return (chosen: string) => {
    for (const { id, button } of buttons)
      button.setAttribute("aria-pressed", String(chosen === id));
  };
}

/** The Appearance tab's color and skin tone buttons. Returns what draws the player's own as pressed. */
export function showAppearance(room: WorldConnection) {
  const drawColor = lookButtons(
    room,
    "knight-color",
    "Color",
    KNIGHT_COLORS,
    (color) => KNIGHT_LOOKS[color].swatch,
  );
  const drawSkin = lookButtons(
    room,
    "skin-tone",
    "Skin tone",
    SKIN_TONES,
    (tone) => SKIN_LOOKS[tone],
  );
  return (me: SyncedPlayer) => {
    drawColor(me.knightColor);
    drawSkin(me.skinTone);
  };
}

/**
 * Makes the Knight's atlas in any color and skin tone, each painted once on first use and then
 * shared, as most players will wear only a few of the 42.
 */
export function knightMaps(map: THREE.Texture) {
  const image = map.image as ImageBitmap;
  const [w, h] = [image.width / 8, image.height / 4];
  const painted = new Map<string, THREE.Texture>();
  return (color: string, skin: string) => {
    const filter = KNIGHT_LOOKS[color as KnightColor]?.filter ?? "none";
    const tone = skin === "fair" ? undefined : SKIN_LOOKS[skin as SkinTone];
    if (filter === "none" && !tone) return map;
    const key = `${color} ${skin}`;
    if (painted.has(key)) return painted.get(key)!;
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    // shortcut: like the gear's grey atlas, a browser without canvas filters (Safari) shows only the model's own look.
    context.filter = filter;
    for (const [column, row] of CAPE_SWATCHES)
      context.drawImage(
        image,
        column * w,
        row * h,
        w,
        h,
        column * w,
        row * h,
        w,
        h,
      );
    if (tone) {
      // A grey copy keeps the swatch's shading; the tone multiplied over it gives the skin its color.
      context.filter = "grayscale(1) brightness(1.2)";
      for (const [column, row] of SKIN_SWATCHES)
        context.drawImage(
          image,
          column * w,
          row * h,
          w,
          h,
          column * w,
          row * h,
          w,
          h,
        );
      context.filter = "none";
      context.globalCompositeOperation = "multiply";
      context.fillStyle = tone;
      for (const [column, row] of SKIN_SWATCHES)
        context.fillRect(column * w, row * h, w, h);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = map.flipY;
    texture.colorSpace = map.colorSpace;
    painted.set(key, texture);
    return texture;
  };
}
