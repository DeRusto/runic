# Runic: Thieving

**Status: building.** Terms are defined in `GLOSSARY.md`. The owner settled the design in #235 and the build order in #236, both on 2026-11-22. This page records the numbers the first build ticket (#250) chose, so the later Thieving tickets (#251 to #253) reuse them. Every number is a first value to tune in play.

The values live in `shared/src/thieving.ts`; where this page and that file disagree, the file wins and this page is fixed.

## 1. Failure chance

Every Thieving target fails on the same curve. A player at exactly the target's level fails 50% of the time (`FAIL_PERCENT_AT_REQUIREMENT`). The chance falls by 2.5 points per level above the requirement, and reaches 0 at 20 levels above it (`SURE_HANDED_LEVELS`), so a player that far above a target never fails it. One roll decides each attempt.

## 2. Experience

The experience scale starts with the drunk's 8 per success, the same as Fishing's lowest catch. A later target pays more as its level rises, in step with the other skills' tables at the same level (Fishing's level 10 trout pays 20 and its level 20 pike pays 32).

## 3. Pickpocketing

| Target    | Level | Experience | Coins | Rare item (chance) | Failure hit |
| --------- | ----- | ---------- | ----- | ------------------ | ----------- |
| The drunk | 1     | 8          | 1–5   | Cooked perch (12%) | 100         |

- A success pays coins, an even pick between the fewest and the most, or the rare item instead. Loot that doesn't fit in the inventory goes on the ground at the player's feet.
- A failure hits for the target's failure hit, in hundredths of a Hitpoints level, but never below 1 health, and then stuns.
- Attempts are at least 3 ticks apart (`PICKPOCKET_INTERVAL_TICKS`), however often the player clicks.

## 4. The stun and the busy state

A stun lasts 8 ticks (`STUN_TICKS`), 2.4 seconds. It is the first use of the general **busy** state, which holds a player for a set number of ticks, with a switch for whether enemies can hit them:

- While busy, the server drops every click the player sends (walking, actions, eating and dropping), and the player stops where they stand.
- With the switch on, as for the stun, enemies notice and hit the player as usual, but the player doesn't fight back.
- With the switch off, as for Agility's crossing, enemies neither notice the player nor land a swing.
- Dying ends the busy state, and leaving the game ends it too, since it isn't saved.

## 5. The drunk

The drunk is a mark: he stands at (12,44), just outside the inn's door, under the nameplate "Drunk", and offers only Pickpocket. A left-click pickpockets him, and a right-click offers Pickpocket.
