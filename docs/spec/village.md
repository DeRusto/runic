# Runic: The village

**Status: built.** This spec records Phase 10 as built. Terms are defined in `GLOSSARY.md`. Decisions come from the closed tickets on [Map: Phase 10, the village](https://github.com/DeRusto/runic/issues/90), and each section names the ticket it comes from.

This spec adds to the [second slice spec](second-slice.md) and the [interface polish spec](interface-polish.md). Everything there still holds. The numbers are first values to tune in play.

## 1. What changes

The village gets three villagers who talk: Odo the Blacksmith, Marta the storekeeper and Aldous the banker. Coins arrive as an ordinary item, which players earn only by selling to Marta's general store. Aldous keeps a 96-slot bank for each player. Stacks can be split and slots dragged into a new order.

## 2. Villagers and conversations

From [Who is the village cast?](https://github.com/DeRusto/runic/issues/194) and [How does talking to a character look and play?](https://github.com/DeRusto/runic/issues/195).

- Each villager stands on one tile. Clicking one walks the player next to them, and the conversation opens on arrival.
- A conversation shows the villager's lines in the dialogue box above the bar, under their portrait, name and role ("Odo, blacksmith"). Each line types itself out; a click or Space shows the rest of it, and the next click or Space moves on. The player's choices follow as buttons (number keys pick them). Escape closes it.
- The server checks the player is still beside the villager before it carries out a choice.
- Odo gives the tools a player lacks only when asked in conversation, no longer on arrival.
- Odo's copper-ore quest opens the smithy: the furnace and anvil refuse a player who hasn't finished it ("You need to help Odo first."), and handing over the ore he asks for finishes it for a quest point. After that he still takes three more ores, each paying Mining experience. The journal lists the quest and its stage (#231).
- Right-clicking Marta offers **Trade**, and Aldous **Bank**: the player walks over and the window opens on arrival, skipping the talk.

**Ending.** A conversation, the store window and the bank each close when the player walks away from the villager ("You walk away from Marta.") or is hit. A blocked swing counts as a hit; a miss does not. A player has at most one of the three open.

## 3. Coins

From [How do coins work?](https://github.com/DeRusto/runic/issues/193).

- Coins are an ordinary inventory item. All of a player's coins share one slot with no cap, which shows a short form (`999`, `12K`, `3.4M`); the tooltip gives the exact count.
- They can be dropped, taken, banked and lost on death like any item.
- Everyone starts with 0. Selling to the general store is the only source.

## 4. Moving items

From [How do coins work?](https://github.com/DeRusto/runic/issues/193).

- **Amount menu.** Drop, deposit, withdraw, buy and sell offer 1, 5, 10, X and All on a stack. A part drop is one ground item.
- **Drag to reorder**, within the inventory or within the bank, at any time and without interrupting an action. Onto an empty slot: move. Onto a different item: swap. A partial stack onto a partial stack of the same item fills the target, and the rest stays. Onto a full stack of the same item: swap.
- By keyboard, M on a slot picks it up, M on another moves it there, and Escape lets go.

## 5. General store

From [What does the general store sell and pay?](https://github.com/DeRusto/runic/issues/196) and [How does the store window look and play?](https://github.com/DeRusto/runic/issues/198).

### Value

- Raw items have a hand-set value. The cheapest sellable item is worth 3, so it sells for 1.

| Item | Value | Item | Value |
|---|---|---|---|
| Berry | 3 | Emberite ore | 20 |
| Herb | 6 | Emberbone | 10 |
| Copper ore | 3 | Ashstone | 25 |
| Tin | 3 | Cinderglass | 50 |
| Coal | 4 | Heartflame | 100 |
| Iron ore | 8 | | |

- A bar or piece of gear is worth everything it is made of: a bar its ores and finds, and gear its bars and any finds, such as the Emberbone in Emberite gear. An uncommon item is worth 2 times its common version, and a rare one 4 times.
- The store sells at full value and pays 40% of value, rounded down, but never less than 1 coin for one item unless it is trash (worth 0). A sale of several pays the one-item price times the count. The rate never changes with stock.
- The store buys every item, improved gear included, but not coins. Tools are not items.

### Shelf

- 40 slots, shared by every player and not saved: a restart resets it to the starting stock.
- Starting stock: 20 berries, 10 herbs, 5 copper ore and 5 coal. Each comes back one at a time every 30 s (100 ticks) up to that amount.
- Items players sell go on the shelf for anyone to buy. They drain one at a time, every 60 s (200 ticks) for common, 5 min (1,000) for uncommon and 20 min (4,000) for rare, and leave the shelf when none are left, whether drained or bought.
- When the shelf is full, the store still buys, but the item does not go on it.

### Store window

- The shelf's slots sit at the top. Below them, the counter holds two trays: what the player buys, and what they sell. Clicking a shelf item puts 1 on the buy tray, and clicking an inventory item puts 1 on the sell tray; right-click offers the amount menu. Each tray line has a button to take it back.
- A running line shows what the player pays, what they get and the change in their coins. One **Deal** settles both trays, sales first so their coins pay for the buys. Nothing changes hands before Deal.
- When the deal can't go through, Deal greys out with the reason under it ("You need 6 more coins.", "You don't have room for all that.").
- The server refuses a deal only when the shelf no longer has enough of an item ("The store doesn't have that many left."). A deal still goes through when another player bought some first or a refill came in, so players sharing the shelf don't spoil each other's deals.

## 6. Bank

From [How does the bank work?](https://github.com/DeRusto/runic/issues/197).

- Opened only through Aldous, in conversation or with the **Bank** shortcut. It is free.
- 96 slots per player, shown as a 12 by 8 grid with a count ("37 / 96"), beside the inventory.
- Materials, food and coins stack with no cap, one slot per item. Gear takes one slot per piece.
- Only inventory items go in: worn gear must be taken off, and tools can't be banked.
- A click on an inventory slot deposits it all, and a click on a bank slot withdraws as much as fits, filling free inventory slots in stacks of 20; the rest stays. Right-click offers the amount menu. **Deposit inventory** puts in whatever fits.
- A full bank still takes an item that already has a slot. Anything else is refused with "Your bank is full."
- Deposits and withdrawals are refused during a combat lock.
- The bank is saved with the rest of a player's progress, and starts empty for new players and existing saves. Only its owner is sent it.

## 7. Build tickets

1. [Talking to Odo](https://github.com/DeRusto/runic/issues/199)
2. [Marta and Aldous](https://github.com/DeRusto/runic/issues/200)
3. [Split stacks and drag to reorder](https://github.com/DeRusto/runic/issues/201)
4. [Coins and the general store](https://github.com/DeRusto/runic/issues/202)
5. [The bank](https://github.com/DeRusto/runic/issues/203)
6. [Move the smithy](https://github.com/DeRusto/runic/issues/204)
