# Runic Agility

Agility opens with the Southfield course, just south of the road east of the village. The course is open at level 1. The design follows [issue #234](https://github.com/DeRusto/runic/issues/234) and is part of [Phase 7](https://github.com/DeRusto/runic/issues/87).

## 1. Experience and Critical Hits

Obstacle crossings and course lap bonuses are the sources of Agility experience. Mastery receives its usual 7% share of the experience that lands. Agility appears on the character sheet and contributes to total level. The combat level formula and walking speed stay as before.

Every landed player hit has a 10% chance to be critical at Agility level 1. Each additional level adds 0.1 percentage points, up to 19.8% at level 99. A critical still deals 1.5 times the hit's damage before the target's remaining health caps it. The Gear tab shows the current chance.

## 2. Southfield Course

| Order | Obstacle        | Start    | Landing  | Crossing ticks | Agility experience |
| ----- | --------------- | -------- | -------- | -------------- | ------------------ |
| 1     | Balance beam    | (36, 45) | (38, 45) | 4              | 30                 |
| 2     | Hurdle          | (40, 45) | (40, 47) | 3              | 25                 |
| 3     | Stepping stones | (39, 48) | (37, 48) | 5              | 35                 |
| 4     | Crawl rail      | (36, 48) | (36, 46) | 4              | 30                 |

Click an obstacle to walk to its marked start and cross. The server begins the crossing when the player reaches the start. Each tick is 300 ms. From the start of a crossing until the landing tick, the server discards action clicks and enemies cannot land a hit. The server moves the player to the landing tile and awards experience on the landing tick. Players can share an obstacle. All four course obstacles have a 0% failure chance.

A lap starts at the balance beam and awards 80 bonus experience when the player lands from the crawl rail after crossing all four in order. Crossing out of order still pays for that obstacle and resets progress. The balance beam always starts a new lap. Lap progress belongs to each player and lasts for that session. A full lap pays 200 experience, so reaching level 30 from level 1 takes 211 laps at that rate.

## 3. Shortcut Failure

Shortcuts and Rope rigging are scheduled for the next part of Agility. The proposed initial shortcut failure chance is 25% at the required level, falling by 2.5 percentage points per additional level. It reaches 0% at 10 levels above the requirement. A failure returns the player to the start with a small, nonfatal hit. The shortcut build will set each shortcut's damage and placement.
