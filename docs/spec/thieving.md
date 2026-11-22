# Runic: Thieving

**Status: building.** Terms are defined in `GLOSSARY.md`. The owner settled the design in #235 and the build order in #236, both on 2026-11-22. This page records the numbers the first build ticket (#250) chose, so the later Thieving tickets (#251 to #253) reuse them, the targets #251 added, Marta's stalls from #252, and the strongboxes from #253. Every number is a first value to tune in play.

The values live in `shared/src/thieving.ts` and, for the stalls and strongboxes, `shared/src/stalls.ts` and `shared/src/strongboxes.ts`; where this page and that file disagree, the file wins and this page is fixed.

## 1. Failure chance

Every Thieving target fails on the same curve. A player at exactly the target's level fails 50% of the time (`FAIL_PERCENT_AT_REQUIREMENT`). The chance falls by 2.5 points per level above the requirement, and reaches 0 at 20 levels above it (`SURE_HANDED_LEVELS`), so a player that far above a target never fails it. One roll decides each attempt.

## 2. Experience

The experience scale starts with the drunk's 8 per success, the same as Fishing's lowest catch. A later target pays more as its level rises, in step with the other skills' tables at the same level (Fishing's level 10 trout pays 20 and its level 20 pike pays 32). The pedlar and Marta match those two catches, and Odo and Hollis carry the same rise of about 1.2 per level on to levels 30 and 45.

## 3. Pickpocketing

| Target          | Level | Experience | Coins | Rare item (chance)           | Failure hit |
| --------------- | ----- | ---------- | ----- | ---------------------------- | ----------- |
| Pell, the drunk | 1     | 8          | 1–5   | Cooked perch (12.5%, 1 in 8) | 100         |
| Jory, the pedlar | 10 | 20 | 4–12 | Rope (12.5%) | 150 |
| Marta | 20 | 32 | 8–20 | Vial (12.5%) | 200 |
| Odo | 30 | 45 | 12–30 | Iron bar (12.5%) | 250 |
| Hollis | 45 | 62 | 20–45 | Rune essence (12.5%) | 300 |

- A success always pays coins, an even pick between the fewest and the most, and now and then the rare item as well. Loot that doesn't fit in the inventory goes on the ground at the player's feet.
- A failure hits for the target's failure hit, in hundredths of a Hitpoints level, but never below 1 health, and then stuns. The hit shows over the player like an enemy's.
- Attempts are at least 3 ticks apart (`PICKPOCKET_INTERVAL_TICKS`), however often the player clicks.

## 4. The stun and the busy state

A stun lasts 8 ticks (`STUN_TICKS`), 2.4 seconds. It is the first use of the general **busy** state, which holds a player for a set number of ticks, with a switch for whether enemies can hit them:

- While busy, the server ignores every click the player sends (walking, actions, eating, dropping, moving items, equipping, mixing, trading and banking), and the player stops where they stand. Each click is checked as it arrives, against the tick it would apply on.
- With the switch on, as for the stun, enemies notice and hit the player as usual, but the player doesn't fight back.
- With the switch off, as for Agility's crossing, enemies neither notice the player nor land a swing.
- Dying ends the busy state, and leaving the game ends it too, since it isn't saved.

## 5. Pell, the drunk

Pell is a mark: he stands at (12,44), just outside the inn's door, under the nameplate "Pell, drunk", and offers only Pickpocket. A left-click pickpockets him, and a right-click offers Pickpocket.

## 6. Jory, the pedlar, and the villagers

Jory is the second mark: a travelling pedlar who stands at (20,40), on the village square's cobbles, under the nameplate "Jory, pedlar". Like Pell, a left-click pickpockets him and a right-click offers Pickpocket.

Marta, Odo and Hollis are villagers first. A left-click still talks to them, and a right-click adds Pickpocket after their other choices. Each pays the rare item that fits their work: a vial from the general store, an iron bar from the forge, and rune essence from the stones. Aldous, the banker, has no Pickpocket choice, and the server ignores a pickpocket aimed at him. No villager can be attacked.

Pickpocketing a villager never closes their shop or conversation to the player: once the stun ends, talking and trading work as before.

## 7. Marta's stalls

Three stalls stand outside the general store, and all belong to Marta. The food stall stands east of the store's front at (13,40), where the village's market stall stood; the gem stall and the fish stall stand west of it at (7,40) and (8,40). A left-click steals from a stall, and a right-click offers Steal-from. Theft rolls on the same failure curve as a pickpocket (§1), and the attempt interval of §3 holds across both, so a player can't alternate targets to beat it.

| Stall | Level | Experience | Loot, one row picked by weight                           | Empty for |
| ----- | ----- | ---------- | -------------------------------------------------------- | --------- |
| Food  | 5     | 14         | Berry 2–4 (3), cooked perch 1 (1)                        | 10 ticks  |
| Fish  | 15    | 26         | Perch 1–2 (6), trout 1 (3), pike 1 (1)                   | 20 ticks  |
| Gem   | 25    | 38         | Ashstone 1 (6), cinderglass 1 (3), heartflame 1 (1)      | 50 ticks  |

- The experience follows §2's rise of about 1.2 per level.
- A theft pays items, never coins. Loot that doesn't fit in the inventory goes on the ground, as a pickpocket's does.
- After a theft the stall is empty for that player alone until its timer runs out (`emptyTicks`); other players can still steal from it. Only the thief's own client shows its counter bare.
- On a failure Marta catches the player: no loot, no hit and no stun. That stall is closed to that player for 100 ticks, 30 seconds (`STALL_LOCKOUT_TICKS`); their other stalls, and other players, are unaffected.
- Both timers are kept by username, so leaving and joining again doesn't end one early. They aren't saved: a server restart refills and reopens every stall.

The per-player timer is `PlayerTimers` in `server/src/playerTimers.ts`, which the strongboxes (§8) share.

## 8. Strongboxes

Two strongboxes stand out where the danger is. The Boneyard strongbox stands at (83,37) on the Boneyard's ashen ground, among the Skeletons. The Runestone Hollow strongbox stands at (120,38) on the Hollow's moss, within reach of its Skeleton Mages and Imps, so the walk to it crosses the Boneyard. A left-click opens a strongbox, and a right-click offers Open. An attempt rolls on the same failure curve as a pickpocket (§1), and the attempt interval of §3 holds across every Thieving target.

| Strongbox        | Level | Experience | Coins  | Gem, one picked by weight                       | Runes, one kind picked evenly | Empty for              | Trap hit |
| ---------------- | ----- | ---------- | ------ | ----------------------------------------------- | ----------------------------- | ---------------------- | -------- |
| Boneyard         | 40    | 56         | 25–60  | Ashstone (6), cinderglass (3), heartflame (1)   | 2–5                           | 1000 ticks, 5 minutes  | 800      |
| Runestone Hollow | 55    | 74         | 50–120 | Ashstone (2), cinderglass (5), heartflame (3)   | 4–10                          | 2000 ticks, 10 minutes | 1200     |

- The experience carries §2's rise of about 1.2 per level on from Hollis.
- A success always pays all three: coins, an even pick between the fewest and the most; one gem; and a handful of one elemental rune (air, water, earth or fire). Loot that doesn't fit in the inventory goes on the ground, as a pickpocket's does.
- After a success the strongbox is empty for that player alone until its timer runs out (`emptyTicks`); other players can still open it. Only that player's client shows its lid open. The timer is kept by username in the same `PlayerTimers` as the stalls', so leaving and joining again doesn't end it early, and it isn't saved: a server restart refills every strongbox.
- A failure gives no loot and leaves the strongbox full. Its trap hits for the trap hit, in hundredths of a Hitpoints level, at least twice as hard as Hollis's 300. The hit shows over the player like an enemy's. A player it leaves alive is stunned as for a failed pickpocket (§4).
- A trap can kill: a hit that would take more health than the player has takes all of it. Death and respawn then work as for any death: the player respawns in the village with full health and keeps every level and all experience, and drops the inventory and worn gear where they fell, as any death does (#119).
