import {
  CHAT,
  combatLevel,
  MAX_CHAT_LINE_LENGTH,
  playerOptionRefusal,
  type PlayerOption,
} from "@runic/shared";
import { printChatLine } from "./bottomBar.ts";
import type { WorldConnection } from "./players.ts";

/** What right-clicking another player offers. Each does what its chat command does, and Message only fills in `/pm`. */
export function playerMenuChoices(room: WorldConnection, id: string) {
  const player = room.state.players.get(id)!;
  const { username } = player;
  const refuse = (option: PlayerOption) => () => {
    const refusal = playerOptionRefusal(option);
    if (refusal) printChatLine(refusal);
  };
  // In PLAYER_OPTIONS order, which is the menu's.
  const choices: Record<PlayerOption, () => void> = {
    Trade: refuse("Trade"),
    Follow: () => room.send(CHAT, `/follow ${username}`),
    Attack: refuse("Attack"),
    Examine: () =>
      printChatLine(`${username}, combat level ${combatLevel(player)}`),
    Message: () => {
      const input = document.getElementById("chat-input") as HTMLInputElement;
      // Setting the value fires no input event, so raise the limit here as bottomBar does.
      input.maxLength = MAX_CHAT_LINE_LENGTH;
      // Setting the value puts the caret at its end.
      input.value = `/pm ${username} `;
      input.focus();
    },
    Duel: refuse("Duel"),
  };
  return Object.entries(choices);
}
