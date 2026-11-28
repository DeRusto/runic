import {
  OFFER_INTENT,
  offeringRefusal,
  PRAY_INTENT,
  type Tile,
} from "@runic/shared";
import { printChatLine } from "./bottomBar.ts";
import type { WorldConnection } from "./players.ts";

/** What clicking a shrine at `shrine` offers (Prayer spec §4). Offering with no bones is refused in the chat. */
export function shrineMenuChoices(
  room: WorldConnection,
  shrine: Tile,
): [string, () => void][] {
  const at = { x: shrine.x, y: shrine.y };
  return [
    ["Pray", () => room.send(PRAY_INTENT, at)],
    [
      "Offer bones",
      () => {
        const me = room.state.players.get(room.sessionId);
        if (!me) return;
        const refusal = offeringRefusal(me);
        if (refusal) printChatLine(refusal);
        else room.send(OFFER_INTENT, at);
      },
    ],
  ];
}
