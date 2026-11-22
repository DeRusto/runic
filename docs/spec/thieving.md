# Runic: Thieving

**Status: in progress.** Pickpocketing the drunk is built (#250); the other targets follow in their own tickets. Terms are defined in `GLOSSARY.md`. The design is #235 and the build order #236. Where a number is given, it is a first value to tune in play.

## 1. The scale every target shares

Later Thieving tickets reuse these two rules instead of setting their own. Both live in `shared/src/thieving.ts`.

**Experience.** A target pays `thievingXpAt(level)` per success, by the level it needs: 8 at level 1 (what a level-1 tree pays), plus 1.25 per level above 1, rounded once.

| Target level | 1 | 5 | 10 | 15 | 20 | 25 | 30 | 40 | 45 | 55 |
| ------------ | - | - | -- | -- | -- | -- | -- | -- | -- | -- |
| Experience   | 8 | 13 | 19 | 26 | 32 | 38 | 44 | 57 | 63 | 76 |

**Failure chance.** `pickpocketFailPercent(levelNeeded, level)` is 40% at the level a target needs and falls evenly, 2 points a level, to none at 20 levels above it (`NO_FAIL_LEVELS_ABOVE`). From there an attempt never fails, as with Agility. Stalls and strongboxes use the same curve; what a failure costs differs by kind (#235).

## 2. Pickpocketing

- A click on a person walks the player next to them, and the try lands on the tick of arrival. One click is one try, and a player can try at most once every 2 ticks (`PICKPOCKET_INTERVAL_TICKS`).
- A click is refused, with the reason in the chat, below the target's level or with no room for coins.
- **Success** pays coins in the target's range, the experience above, Mastery's usual 7%, and now and then the target's rare item. A rare item with no room goes on the ground under the player.
- **Failure** deals a hit of one Hitpoints level (100 hundredths) that never kills: it leaves the player at least the smallest scrap of health. Then the player is stunned for 6 ticks (`STUN_TICKS`).

## 3. The busy state

The stun is one use of a general **busy** state: busy for N ticks, with a switch for whether enemies can hit the player meanwhile (`server/src/busy.ts`).

- Becoming busy stops whatever the player was doing. While busy, every click that acts (walking, fighting, gathering, making, eating, dropping, equipping, banking, trading, talking, pickpocketing) is ignored. Logging out, pinning skills and closing windows still work.
- A busy player never fights back, even when hit.
- With hits on, as for the stun, enemies swing as usual. With hits off, as Agility's crossing will be (#236), an enemy's due swing lands on nobody.
- Death and leaving end it.

## 4. The drunk

**Pell**, the drunk, is a level-1 mark standing outside the inn, by its west corner, at (8, 44). He pays 1 to 5 coins, and one success in ten a cooked perch. A right-click offers Pickpocket, and a left-click pickpockets him at once, since he has nothing else to offer.
