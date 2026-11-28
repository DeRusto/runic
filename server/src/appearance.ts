import { isKnightColor, isSkinTone } from "@runic/shared";
import type { World } from "./worldContext.ts";

/**
 * `look` comes straight off the network, so anything but a color or a skin tone is ignored.
 * Each sets its own. A look only, so it skips the queue.
 */
export function setAppearance(world: World, id: string, look: unknown) {
  const player = world.state.players.get(id);
  if (!player) return;
  if (isKnightColor(look)) player.knightColor = look;
  else if (isSkinTone(look)) player.skinTone = look;
}
