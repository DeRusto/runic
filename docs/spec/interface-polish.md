# Runic: Interface polish

**Status: both strands written.** Terms are defined in `GLOSSARY.md`. Decisions come from [Map: Interface polish](https://github.com/DeRusto/runic/issues/170), which charts the requests in [added tweaks and features](https://github.com/DeRusto/runic/issues/169).

This spec adds to the [second slice spec](second-slice.md) and the [Improved items spec](improved-items.md). Everything there still holds, except that §5 here replaces the slot tooltip from [Improved items §5](improved-items.md#5-client), and §6 retires the brown panels, so names inside panels take the light quality shades. §6 also replaces the [second slice's](second-slice.md#smithing-panel) rule that a click anywhere else closes the smithing panel.

The work runs on two strands. The **chat** strand (§1 to §4) adds four chat commands and writes item names in brackets. The **interface** strand (§5 to §9) gives the game one tooltip, one panel style, a dark bottom bar with square buttons, and experience labels on pinned bars.

## 1. What changes

Players get four new chat commands: `/help` lists every command, `/who` lists everyone online, `/r` answers the last private message, and `/e` acts something out in bold, such as "**DeRusto dances**". Every chat line the game writes about an item names it in brackets, as in "You make a [Copper chestplate of Fortitude]!", with the name inside coloured by its Quality.

Every hover in the game shows one dark tooltip that follows the cursor, and an item's tooltip lists its stats. Panels become dark windows that stay open together and drag by their title bars. The bottom bar takes the same dark look, its buttons become 36 px squares with icons, and Log out asks first. Each pinned skill shows how much experience its next level needs.

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

## 5. The tooltip

From [How does the one tooltip look and behave?](https://github.com/DeRusto/runic/issues/173). The prototype to copy from is `client/prototype-tooltip.html` on the [`prototype/tooltip`](https://github.com/DeRusto/runic/tree/prototype/tooltip) branch.

Every hover in the game shows the same **tooltip**, and no element keeps a `title` attribute. It replaces the slot tip (`#slot-tip`, `client/src/slotTip.ts`), the browser tips on XP bars, pin buttons, Toolbelt icons and smithing rows, and the box the ground label is drawn in. Each element keeps its `aria-label`, since the tooltip serves the pointer only.

### Behaviour

- It shows at once, with no delay, and follows the cursor while it moves.
- It sits up and to the right of the cursor, 12 px off. At the window's right edge it flips to the left of the cursor, and at the top edge it flips below.
- It hides when the pointer leaves or presses, as the slot tip does today, since a click can change what it describes.

### Look

- A near-black box (`#1d1610` to `#120d09`) with a thin brown border (`#8a6a44`), slightly rounded corners and a soft shadow, 280 px wide at most. It has no pointer arrow.
- The text is white 12 px system-ui. Item names take the light quality shades (`#5fe36a`, `#6fb0ff`).

### Item tips

An item tip holds, top to bottom:

1. The name, at 13 px, coloured by Quality.
2. A grey 11 px kind line. Gear gives its slot and its gate, as in "Head armour, needs Defense 15". Food gives its total healing in the health line's units and its healing ticks (`perTick * ticks` and `ticks` in `FOOD_HEALS`), as in "Food, heals 400 over 4 ticks" for a berry. A tool reads "Tool", a gem "Gem", and anything else "Material".
3. A thin divider, only when stat lines follow.
4. The base stats in light grey, in the Gear tab's wording (`does` in `shared/src/gear.ts`).
5. The Virtue line in the Quality colour, in the Gear tab's wording (`virtueDoes`).
6. Any refusal in red, such as "Needs Defense 15. You have 9."

Where item tips show:

| Hover | Tip |
|---|---|
| Inventory slot | The item's tip, with its refusal if it can't be worn |
| Gear slot holding an item | The worn item's tip. The "Take off" text goes, since a click still takes it off |
| Pile window row | The item's tip |
| Toolbelt icon | The tool's name and its "Tool" kind line |
| Smithing recipe | The tip of what it makes, base stats only, with no Virtue. Its materials (`2 Copper bar (have 5)`) and experience follow the stats, then any refusal |

The Gear tab's details line under the slots stays as it is, because a keyboard player reads it on focus.

### Plain tips

Every other hover shows one plain white line in the same box, with no kind line or divider:

| Hover | Line |
|---|---|
| Empty gear slot | The slot's name, such as "Head" |
| XP bar, on the bar or the sheet | The skill's total experience, such as "12,345 XP" |
| Pin button | Today's text: "Pin to the bar", "Unpin from the bar", or "The bar holds 6: unpin one first" |
| Bottom-bar button | See §7 |
| Ground label | Today's lines, one per item, names coloured |

## 6. Panels

From [How does the one panel look and behave?](https://github.com/DeRusto/runic/issues/174). The prototype to copy from is variant B of `client/prototype-panel.html` on the [`prototype/panel`](https://github.com/DeRusto/runic/tree/prototype/panel) branch (`?variant=B`).

A **panel** is a window that opens over the world: the character sheet, the smithing panel, the social panel and the pile window. The inventory and the bottom bar are not panels.

### Behaviour

- Any number of panels can be open at once. The rule that smithing, the pile window and the social panel close each other goes away (`client/src/leftPanels.ts`).
- Clicking anywhere on a panel brings it to the front. Opening a panel, by hotkey, button or click in the world, also brings it to the front.
- A player drags a panel by its title bar. A panel stays fully on screen and above the bottom bar while dragged, and is pulled back on screen if the window shrinks.
- A panel reopens where it was last left during this login. Positions aren't saved across logins.
- The first time in a login, the character sheet opens on the right and the other panels open on the left. Each is offset a little from the one before, so they cascade rather than stack exactly.
- Escape closes the front panel only. C and O still toggle their own panel. Hotkeys and Escape don't fire while the chat box has focus.
- A click or press outside a panel never closes it. The smithing panel and the pile window close only by Escape while in front, by their close button, by death, or by the player walking out of reach: more than one tile from the station, or off the pile's tile. A click in the world still does what it normally does.

### Look

- The tooltip's box: the near-black gradient, a black outer edge, a brown hairline inside it (`#8a6a44`), rounded corners and a soft shadow.
- The front panel's hairline turns gold (`#d2a86a`), and the title bars of panels behind it dim.
- **Title bar:** a dark brown gradient band holding a grip mark and the title in small caps, with a square close button that has a brown border and turns red on hover.
- **Tabs** (character sheet, social panel) run down the left side in a darker column, with a gold bar on the selected tab. A panel without tabs has no column.
- **Content:** dark gear slots with a brown hairline, rows that highlight on hover, gold XP bars and a thin brown scrollbar. Item names take the light quality shades.
- Panels no longer use `panel_brown.png` or `button_brown_close.png`.

## 7. Bottom bar

From [How do the square bottom-bar buttons look, and what does each show on hover?](https://github.com/DeRusto/runic/issues/175), [Do the bottom bar and inventory take the panel's dark look?](https://github.com/DeRusto/runic/issues/181) and [Does Log out get a hotkey?](https://github.com/DeRusto/runic/issues/182). The prototype for the buttons is `client/prototype-bar-buttons.html` on the [`prototype/bar-buttons`](https://github.com/DeRusto/runic/tree/prototype/bar-buttons) branch (`?variant=B` for the look, `?variant=C` for the order).

### The bar

- The near-black gradient replaces slate blue (`#232c3a`), with a brown hairline (`#8a6a44`) along the bar's top edge.
- **Inventory slots** take the square buttons' face (below). On hover the hairline lightens (`#b08a5a`). Gold stays reserved for an open panel. Locked slots keep their grey, faded look, and stack counts are unchanged.
- **Chat input:** a dark field with a brown hairline that lightens on focus. Chat lines sit straight on the bar.
- **Slot right-click menu:** the tooltip's box, with rows that highlight in dark brown on hover and keyboard focus.

### Square buttons

- In order: Turn view left and Turn view right together on the left, a gap, then Character sheet and Social. Log out stands alone at the far right end of the row.
- 36 px squares, the inventory slots' size: a near-black gradient, a black outer edge, a brown hairline inside it and slightly rounded corners.
- Each shows a 22 px icon in light tan (`#cdb48c`), drawn as a CSS mask. The hotkey letter sits small in the top-left corner in the hairline brown: Q, E, C and O. Log out has none.
- **Hover:** the hairline lightens (`#b08a5a`) and the icon brightens (`#efdcbc`). Log out's icon turns red (`#e06a5a`).
- **Pressed:** the face darkens (`#0b0806`) and the icon moves down 1 px. Pressing a button's hotkey shows the same press.
- **Open panel** (Character sheet, Social): the hairline turns gold (`#d2a86a`) with a soft inner gold glow, and the icon and hotkey letter turn gold, matching the front panel's edge.
- **Tip:** a plain tip giving the button's name, then its hotkey in a small bordered key box, such as "Character sheet [C]". Log out shows only its name.

The icons are Kenney art under CC0 1.0, found by [What art on disk can make square bottom-bar buttons, and is its licence clear?](https://github.com/DeRusto/runic/issues/172). Paths are under `kenney-game-assets/` in the local asset folder:

| Button | File | Pack |
|---|---|---|
| Turn view left | `Icons/Board Game Icons/PNG/Double (128px)/arrow_counterclockwise.png` | Board Game Icons 1.1 |
| Turn view right | `Icons/Board Game Icons/PNG/Double (128px)/arrow_clockwise.png` | Board Game Icons 1.1 |
| Character sheet | `Icons/Game Icons/PNG/Black/2x/singleplayer.png` | Game Icons 1.0 |
| Social | `Icons/Game Icons/PNG/Black/2x/multiplayer.png` | Game Icons 1.0 |
| Log out | `Icons/Game Icons/PNG/Black/2x/exitRight.png` | Game Icons 1.0 |

The icons go in `client/public/ui/`, beside each pack's licence copied as `LICENSE-Kenney-Game-Icons.txt` and `LICENSE-Kenney-Board-Game-Icons.txt`. Both licence files are listed under `ui/` in `client/public/LICENSE.txt`.

### Log out asks first

- Log out has no hotkey. Clicking its button opens a confirm box instead of logging out at once.
- The box sits centred over the world in the panel's look, with a front panel's gold hairline. It reads "Log out?" and has two buttons, **Log out** and **Cancel**. It has no title bar and can't be dragged, and only one can be open.
- **Log out** sends the log-out intent, as the button does today. The server still decides, so a refused log out, such as during a combat lock, shows its usual line and the player stays in.
- **Cancel**, Escape or a second click on the Log out button closes the box and does nothing else. Escape closes the box before any panel.

## 8. Experience labels

- Each pinned skill on the bottom bar shows how much experience its next level needs, right-aligned above its bar and always visible: `1,000 XP to level 12`. The skill's name and level stay on the left of the same line.
- The count is `xpForLevel(level + 1) - xp`, with thousands separated by commas.
- At the max level it reads `Max level`.
- The character sheet's skill bars don't gain the label. Both keep the hover tip from §5.

## 9. Interface build tickets

Each is a thin working slice. "Needs" names a ticket that must land first.

| # | Ticket | Delivers | Needs |
|---|---|---|---|
| 5 | [The one tooltip](https://github.com/DeRusto/runic/issues/183) | The tooltip box and behaviour, every `title` and the slot tip moved onto it as plain tips, and the ground label in its box | |
| 6 | [Item tips with stats](https://github.com/DeRusto/runic/issues/184) | The item tip layout on inventory slots, gear slots, pile rows, Toolbelt icons and smithing recipes | 5 |
| 7 | [Dark panels](https://github.com/DeRusto/runic/issues/185) | §6's look on all four panels, with tabs down the left | |
| 8 | [Free panels](https://github.com/DeRusto/runic/issues/186) | Panels open together, drag, come to the front with a gold edge, cascade, and close by Escape front first | 7 |
| 9 | [Dark bottom bar](https://github.com/DeRusto/runic/issues/187) | §7's bar, slots, chat input and right-click menu | |
| 10 | [Square bar buttons](https://github.com/DeRusto/runic/issues/188) | The icons and licences, and the square buttons with their order, states and tips | 5, 9 |
| 11 | [Log out asks first](https://github.com/DeRusto/runic/issues/189) | The confirm box | 7 |
| 12 | [Experience to next level](https://github.com/DeRusto/runic/issues/190) | §8's label on pinned bars | |
