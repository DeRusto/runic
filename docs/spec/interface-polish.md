# Runic: Interface polish

**Status: chat strand written; interface strand still on the map.** Terms are defined in `GLOSSARY.md`. Decisions come from [Map: Interface polish](https://github.com/DeRusto/runic/issues/170), which charts the requests in [added tweaks and features](https://github.com/DeRusto/runic/issues/169).

This spec adds to the [second slice spec](second-slice.md) and the [Improved items spec](improved-items.md). Everything there still holds.

The work runs on two strands. The **chat** strand (§1 to §4) adds four chat commands and writes item names in brackets. The **interface** strand (one tooltip, one panel style, experience labels on pinned bars, square bottom-bar buttons) joins this spec once the map has decided it.

## 1. What changes

Players get four new chat commands: `/help` lists every command, `/who` lists everyone online, `/r` answers the last private message, and `/e` acts something out in bold, such as "**DeRusto dances**". Every chat line the game writes about an item names it in brackets, as in "You make a [Copper chestplate of Fortitude]!", with the name inside coloured by its Quality.

Out of scope: players linking items in their own chat by typing brackets, and remembering who to `/r` across logins.

## 2. Chat commands

Command names ignore case, as today. Each error below goes to the sender's chat box only, like every other chat command error.

### `/help`

- Prints one line per chat command to the sender's chat box, in alphabetical order. Each line gives the usage and a short description:

  | Line |
  |---|
  | `/e <text>: Act something out, shown in bold to everyone as your name then the text.` |
  | `/follow <name>: Walk after an online player.` |
  | `/friend <name>: Add an account to your friends list.` |
  | `/help: List every chat command.` |
  | `/ignore <name>: Add an account to your ignore list.` |
  | `/pm <name> <message>: Send a private message to an online player.` |
  | `/r <message>: Reply to the last player who sent you a private message.` |
  | `/unfollow: Stop following.` |
  | `/unfriend <name>: Take an account off your friends list.` |
  | `/unignore <name>: Take an account off your ignore list.` |
  | `/who: List every online player.` |

- The lines come from the same table the server runs commands from, so a command added later shows up in `/help` without a separate list to keep in step.
- Anything typed after `/help` is ignored.

### `/who`

- Prints one line to the sender's chat box: `Online (3): Alice, Bob, DeRusto`. The count comes first, then every online player's name, sorted by name ignoring case and including the sender.
- "Online" has its glossary meaning: a player held in the world by a combat lock counts, and a login still waiting does not.
- Ignore lists don't hide anyone from `/who`.
- Anything typed after `/who` is ignored.

### `/r <message>`

- Sends `<message>` to the last player who sent the sender a private message during this login. The server keeps it per login and never saves it, and the sender's own private messages don't change it.
- A private message counts only when it reaches the player. One dropped because the player ignores its sender doesn't set the reply target, so `/r` never reveals an ignored player.
- With nobody to reply to, the sender gets `You have nobody to reply to.`
- With no message, the sender gets `Usage: /r <message>`.
- Otherwise it behaves exactly like `/pm <name> <message>` to that player, errors included. A player who has since logged out gives `<name> is not online.`, and both chat boxes show the usual `To <name>:` and `From <name>:` lines.

### `/e <text>`

- An **emote**. It works like public chat in every respect: it reaches every player's chat box, has the same 120-character limit on the text, is dropped for players who ignore the sender, works while dead, and shows over the sender's head.
- In the chat box it reads `<name> <text>` in bold, such as "**DeRusto dances**", with no colon.
- Over the head it shows the text alone, as public chat does, since the head it hangs over already names the player.
- With no text, the sender gets `Usage: /e <text>`. A text past the limit is dropped without a line, as public chat is.
- The broadcast chat line says whether it is an emote, and the client draws it bold.

## 3. Item names in brackets

- Every chat line the game writes that names an item shows the name in square brackets: `[Copper chestplate of Avoidance]`. The name inside is coloured by its Quality, as [Improved items §5](improved-items.md#5-client) sets out, and the brackets stay in the line's plain colour. A common item's name stays plain, in brackets.
- "A" or "an" still goes before the bracket and follows the name's first letter: "You make an [Iron sword of Might]!"
- Two chat lines name an item today:

  | Line | Written by |
  |---|---|
  | `You make a [<item>]!` (improved items only) | The client, from the made event |
  | `You find an [Emberbone]. It is on the ground.` | The server, as a told line |

- **Tools aren't items.** A tool takes no inventory slot, so lines naming a hammer or pickaxe ("You need a hammer.", "The Blacksmith gives you a pickaxe and a hammer.") stay as they are.
- Brackets are for chat only. Tooltips, the Gear tab and ground labels keep the bare name.
- A chat line added later that names an item follows this rule. If the server writes it and the item could be improved, the line must carry the item id so the client can colour the name.

## 4. Build tickets

Each is a thin working slice. None needs another: `/help` reads the command table, so it lists `/e` and `/r` whenever they land.

| # | Ticket | Delivers | Needs |
|---|---|---|---|
| 1 | [`/help` and `/who`](https://github.com/DeRusto/runic/issues/177) | A usage and description beside each command in the table, `/help` printing them, and `/who` | |
| 2 | [`/r` replies to the last private message](https://github.com/DeRusto/runic/issues/178) | The per-login reply target and `/r` | |
| 3 | [`/e` emotes](https://github.com/DeRusto/runic/issues/179) | `/e`, the emote flag on the chat line, bold `<name> <text>` in the chat box and the text overhead | |
| 4 | [Item names in brackets](https://github.com/DeRusto/runic/issues/180) | Brackets on both item lines, with the name inside still coloured | |
