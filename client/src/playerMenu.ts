import { CHAT, combatLevel, playerOptionRefusal } from "@runic/shared";
import { printChatLine } from "./bottomBar.ts";
import type { WorldConnection } from "./players.ts";

/** What right-clicking another player offers. Each does what its chat command does, and Message only fills in `/pm`. */
export function playerMenuChoices(room: WorldConnection, id: string) {
  const player = room.state.players.get(id)!;
  const { username } = player;
  const refused = (option: string) =>
    [option, () => printChatLine(playerOptionRefusal(option)!)] as const;
  return [
    refused("Trade"),
    ["Follow", () => room.send(CHAT, `/follow ${username}`)],
    refused("Attack"),
    [
      "Examine",
      () => printChatLine(`${username}, combat level ${combatLevel(player)}`),
    ],
    [
      "Message",
      () => {
        const input = document.getElementById("chat-input") as HTMLInputElement;
        // Setting the value puts the caret at its end.
        input.value = `/pm ${username} `;
        input.focus();
      },
    ],
    refused("Duel"),
  ] as const;
}
