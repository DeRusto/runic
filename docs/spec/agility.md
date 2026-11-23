# Runic Agility

Agility opens with the Southfield course, just south of the road east of the village. The course is open at level 1, and five shortcuts from level 10 to 60 open other parts of the region (§3 to §5). The design follows [issue #234](https://github.com/DeRusto/runic/issues/234) and is part of [Phase 7](https://github.com/DeRusto/runic/issues/87).

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

## 3. Shortcuts

Five shortcuts lead somewhere. Three open pockets of the region that nobody can walk into, and two cut a walk of more than 60 steps down to one crossing. The values live in `shared/src/agility.ts`; where this page and that file disagree, the file wins and this page is fixed.

| Shortcut      | Level | Rope | Start      | Far end    | Crossing ticks | Agility experience | Failure hit | Leads to                                       |
| ------------- | ----- | ---- | ---------- | ---------- | -------------- | ------------------ | ----------- | ---------------------------------------------- |
| Ridge stile   | 10    | No   | (62, 12)   | (64, 12)   | 4              | 20                 | 100         | Over the ridge into the north-east field       |
| Bramble swing | 20    | Yes  | (10, 53)   | (7, 53)    | 5              | 35                 | 150         | The Tangle, a thicket clearing in the copse    |
| Charred fence | 30    | No   | (93, 28)   | (93, 30)   | 4              | 50                 | 200         | Over the Boneyard's north wall to its Emberite |
| Ruin ledge    | 45    | No   | (119, 31)  | (121, 31)  | 5              | 75                 | 250         | A walled nook in Runestone Hollow's corner     |
| Crag line     | 60    | Yes  | (9, 35)    | (9, 32)    | 6              | 100                | 300         | The shelf on top of the west field's crag      |

A shortcut crosses both ways. Clicking it walks the player to the nearer end they can reach, and the crossing lands on the other end. Both ends carry a marked start. A shortcut crossing works like a course crossing (§2): the same uninterruptible busy state, the same immunity to hits, and experience on the landing tick. A shortcut crossing never counts toward a Southfield lap and never resets one. While a crossing that can still fail is under way, the client moves the figure only halfway along the obstacle; the landing tick then carries it on to the far end or back to the start, so the client never shows an outcome before the server decides it.

The Ridge stile saves a 63-step walk round the ridge by the road, and the Charred fence a 62-step walk into the Boneyard's east strip. Each pocket holds a small pool of its own, one active at a time unless stated: the Tangle has three nightbloom spots, the nook has three essence spots with two active, and the crag's shelf has two emberbloom spots. The open pools elsewhere in the region keep their spots and active counts.

The experience rises with the level so that crossing a shortcut back and forth trains past the course's range. At the requirement and with no failures, that pays about 5 experience a tick on the Ridge stile and about 17 on the Crag line.

## 4. Failing a Shortcut

A shortcut fails 25% of the time at exactly its required level (`SHORTCUT_FAIL_PERCENT_AT_REQUIREMENT`). The chance falls by 2.5 percentage points per level above the requirement and reaches 0% at 10 levels above it (`SURE_FOOTED_LEVELS`), so a player that far above a shortcut never fails it. One roll on the landing tick decides each crossing. Course obstacles never fail.

A failure takes the shortcut's failure hit, in hundredths of a Hitpoints level, but never below 1 health, so it cannot kill. The player stays on the end they started from, earns no experience and reads a line naming the shortcut crossed, such as "You slip on the crag line and land back where you started." The hit shows over the player at once, like a failed pickpocket's.

## 5. Rigging

The Bramble swing and the Crag line need a rope (Crafting, at the workbench) the first time a player crosses them. The server checks the rope when the crossing starts, takes one rope from the inventory, and records the shortcut as rigged for that player. The shortcut then stays open for them for good, in both directions, with no more rope. A failed first crossing still spends the rope and leaves the shortcut rigged. Each player rigs their own: another player's rope does nothing for them.

A save that loads inside a pocket whose shortcuts the player can't cross back out of, such as one made on the crag's top or in the Hollow's corner before those were walled in, loads at that shortcut's outer end instead. A player who can cross back out loads where they saved.

The rigged shortcuts are saved per player in the `rigged_shortcuts` column, added by its own migration with an empty list as its default, so every earlier save loads with nothing rigged and keeps the rest of its progress.

The client and the server share one refusal (`crossRefusal`). Below the level, the player reads "You need Agility 20 to cross the bramble swing."; with no rope for an unrigged shortcut, "You need a rope to rig the bramble swing." The client shows it and sends nothing. The server checks again when the player arrives, in case the rope left the inventory on the way, and tells the player why it refused.
