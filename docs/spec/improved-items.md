# Runic: Improved items

**Status: decided, not yet built.** Terms are defined in `GLOSSARY.md`. Decisions come from the closed tickets on [Map: Improved items](https://github.com/DeRusto/runic/issues/143), and how an item carries its Quality and Virtue is recorded in `docs/adr/0004-improved-items-as-compound-ids.md`.

This spec adds to the [second slice spec](second-slice.md) and the [Mining and Smithing rebalance](mining-smithing-rebalance.md). Everything there still holds.

The numbers are first values to tune in play. They were checked against Spider and Skeleton fights with an expected-value sum per fight ([Do the Virtue sizes need a combat simulation?](https://github.com/DeRusto/runic/issues/163)), and nobody has played them yet.

## 1. What changes

When a player makes gear, it sometimes comes out one **Quality** up, with a **Virtue**: a named boost to one character attribute. A Copper chestplate of Fortitude takes 4% off each hit like any Copper chestplate, and also adds 20 to its wearer's max health. Its name shows green, so the player sees at a glance that it is better than plain.

A **character attribute** is a number combat reads: max health, the player's hit, or an enemy's chance to hit the player. A Virtue is never a skill level, so it never changes combat level or meets a gate.

**Which items.** Any gear a skill makes can be improved. Today that is the 25 pieces made at the anvil. Gear from later skills (Crafting, Fletching, Jewelsmithing) follows the same rule when those skills land, and each skill's own map decides which Virtues its gear can have. Bars and other materials are never improved.

**Existing progress survives.** Every item a player holds today is common, and stays exactly as it is.

Out of scope: changing an item after it is made, such as rerolling its Virtue or raising its Quality (it may come back with Jewelsmithing or a later map); improved items from enemies or any other loot.

## 2. Rules

### Qualities

From [What qualities are there, and what does each step up give?](https://github.com/DeRusto/runic/issues/144).

- There are three Qualities: **common**, **uncommon** and **rare**. Every item is common unless it is made one of the other two. A higher step can be added later without changing these.
- An uncommon item has one Virtue at its base size. A rare item has one Virtue at double that size (§3).
- An item holds at most one Virtue, and a common item has none.
- **Quality acts only through the Virtue.** An improved item has the same base stats (hit bonus, block chance, armour), the same gate and the same worn look as its common form.

### Virtues

From [Which Virtues exist, and what does each raise?](https://github.com/DeRusto/runic/issues/146).

| Virtue | Raises |
|---|---|
| **Fortitude** | Max health |
| **Might** | The minimum and maximum hit |
| **Avoidance** | Takes points off an enemy's chance to hit the player |

- **Any Virtue on any gear.** An improved item's Virtue is one of the three at equal odds, whatever its slot. The player never picks it.
- **They add up.** The Virtues on every worn piece add together, as armour does. Two pieces of Fortitude give the sum of both.
- **Might works like a sword's hit bonus.** It is added only to a hit that lands, never to a miss, and a critical hit multiplies it with the rest of the hit.
- **Avoidance** comes off the enemy's chance to hit after Defense has lowered it. It never changes block chance or armour.
- **Fortitude and current health.** Max health is the Hitpoints level × 100, plus the Fortitude of every worn piece. Equipping Fortitude raises only max health, and regen fills the rest. Taking it off, or swapping it for a piece with less, lowers current health to the new max if it was above it. Swapping gear never heals. Regen stays 5% of max health, so Fortitude speeds it up a little.
- Block chance and armour stay base stats only. No Virtue raises them.

### Making an improved item

From [What is the chance of making an improved item, and what changes it?](https://github.com/DeRusto/runic/issues/149).

- **Each piece of gear made rolls once, on the server**, when it is finished: first whether it is improved, then whether an improved item is rare, then its Virtue.
- **The chance grows with levels above the item's gate**, as gathering's `attemptChance` does: 4% at the gate, plus 0.2% per Smithing level above it, capped at 20% (§3). A higher tier needs no separate factor, since its higher gate already lowers the chance at the same level.
- **One improved item in five is rare**, at every level. The rest are uncommon.
- **Every slot has the same chance.** A helmet costs 2 bars and a chestplate 5, so helmets give more improved rolls per bar. That's accepted.
- **No extra experience.** An improved item pays the same Smithing experience as a common one, so the pacing simulation stays valid.
- **The chance is hidden.** The Smithing panel shows no percentage or hint.
- Everything else about making stays as it is: the costs, the wait, the checks, and Make 1 and Make all. An improved item goes into the inventory exactly where its common form would.

### How an item carries its Quality and Virtue

From [How does an item carry its quality and Virtue?](https://github.com/DeRusto/runic/issues/145) and ADR 0004.

- **An improved item is one compound id string:** the base id, the Quality and the Virtue, joined by `:` in that order. For example `copperChestplate:uncommon:fortitude` or `emberiteSword:rare:might`. Quality is `uncommon` or `rare`, and Virtue is `fortitude`, `might` or `avoidance`, all lower case.
- **A common item is its plain base id**, never `copperSword:common`. So existing saves, enemy loot and every item that can't be improved need no change.
- The compound id lives wherever an item id lives today: inventory slots, the gear fields and their save columns, ground items, and events. No schema changes shape.
- **One shared helper** in `shared/` splits an id into its base id, Quality and Virtue. Every lookup by item id (stack size, gear stats, gates, icons, names, worn looks, recipes) reads the base id through it. Only the Virtue, the name and the colour read the rest.
- **Others see it.** Worn gear syncs to every player in the room, and a dropped improved item shows its full name to whoever can see it. This is intended.
- **Stacking** never compares Virtues, because gear stacks to 1.

## 3. Numbers

**Virtue sizes**

A Virtue's size is its unit × the item's tier number (Copper 1, Bronze 2, Iron 3, Steel 4, Emberite 5). Rare is double uncommon, and the size is the same on every slot.

| Virtue | Unit | Uncommon, Copper → Emberite | Rare, Copper → Emberite | Full rare Emberite set (5 pieces) |
|---|---|---|---|---|
| Fortitude | 20 health | +20 → +100 health | +40 → +200 | +1,000 health |
| Might | 3 hit | +3 → +15 hit | +6 → +30 | +150 hit |
| Avoidance | 0.1 points | −0.1 → −0.5 points | −0.2 → −1.0 | −5 points |

A full rare Emberite set of Fortitude is worth 10 Hitpoints levels, and the Avoidance set about 17 Defense levels against a Skeleton. A full rare set of one Virtue is a long chase: at the cap, one piece in 75 comes out rare with a given Virtue.

**Chance**

Improved chance = min(4% + 0.2% × (Smithing level − the item's gate), 20%). Of those, 1 in 5 is rare.

| | At the gate | Copper gear at Smithing 20 | 80 or more levels above the gate |
|---|---|---|---|
| Improved | 4% | 7.8% | 20% |
| Rare | 0.8% | 1.56% | 4% |

All of these live in `shared/` as named constants, beside `GEAR` and `RECIPES`.

## 4. Saves

No save column changes and nothing migrates. A compound id is a new value in the string fields items already use, and a plain id still means a common item.

## 5. Client

From [How does an improved item look and read?](https://github.com/DeRusto/runic/issues/147). The prototype to copy from is variant A of `client/prototype-improved-items.html` on the [`prototype/improved-item-look`](https://github.com/DeRusto/runic/tree/prototype/improved-item-look) branch.

### Names and colours

- **Name:** the base name, then "of" and the Virtue, for example "Copper chestplate of Fortitude". The Virtue is capitalised, as a proper noun. The name never includes the Quality word: the colour shows it.
- **Colours:** green for uncommon and blue for rare. Use the dark shade on the brown panels (`#1f9a2c`, `#2563c9`) and the light shade on the dark bar and over the world (`#5fe36a`, `#6fb0ff`). A common item keeps today's plain text.
- The colours sit close to the heal and miss pops. That's accepted: pops are short-lived numbers over a head, and names show in text.

### Where the name shows

- **Inventory and Gear tab slots** replace the browser's `title` tooltip with a custom tooltip, so the coloured name shows on hover. Each slot keeps its `aria-label`. Refusal text, such as a level gate, shows in the same tooltip after the name.
- **Gear tab:** "Body: Copper chestplate of Fortitude. Takes 4% off each hit you take. Adds 20 to your max health." The base stat comes first, then the Virtue line at its size for the tier and Quality, in the same wording as the base stats:
  - Fortitude: "Adds N to your max health."
  - Might: "Adds N to your minimum and maximum hit."
  - Avoidance: "Takes N points off an enemy's chance to hit you."
- **Ground label:** the coloured name, as today's "<name> (1)".
- **Chat line when made:** only an improved item gets one: "You make a Copper chestplate of Fortitude!", with the name coloured. "An" replaces "a" before a vowel ("You make an Iron sword of Might!"). A common item stays silent, as making is today. The server says what was made in the event, and the client writes and colours the line.

## 6. Check while building

- Watch Fortitude's effect on regen in the playtest. It moves the level where a player stops eating against Skeletons from about 33 down to about 27.
- Every place that looks an item up by id must read the base id. A compound id that reaches `ITEMS`, `GEAR`, `iconUrl` or the worn looks unsplit gives a missing icon or a crash.

## 7. Build tickets

Each is a thin working slice that builds on those it needs. Each is a `ready-for-agent` issue.

| # | Ticket | Delivers | Needs |
|---|---|---|---|
| 1 | [Make improved gear](https://github.com/DeRusto/runic/issues/164) | The id helper and every lookup through it, the roll at the anvil, names with "of", the chat line uncoloured; improved gear can be held, worn, dropped and taken | |
| 2 | [Virtues work in combat](https://github.com/DeRusto/runic/issues/165) | Fortitude, Might and Avoidance in combat and max health, and the Virtue line in the Gear tab | 1 |
| 3 | [Quality colours and tooltips](https://github.com/DeRusto/runic/issues/166) | Green and blue names in chat, the Gear tab and ground labels, and custom slot tooltips | 1 |
