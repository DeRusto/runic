# Prayer

## 1. The Skill

Prayer appears between Blocking and Mastery in the skills list, with its level and experience. The combat level formula counts half its level, rounded down. Mastery receives 7% of the Prayer experience earned.

## 2. Prayer Points

Maximum prayer points are 10 per Prayer level. A level gain raises the maximum and keeps the current amount. While no prayer is active, one point returns every 20 server ticks, up to the maximum. The bottom bar shows current and maximum prayer points beside Health.

The save records Prayer experience and current points. New players and saves from before Prayer start at 0 Prayer experience with a full pool of 10 points. The migration preserves all other saved progress.

## 3. Burying Bones

Select a bone in the bag to bury it on the current tile. Burying takes two ticks (600 ms) from the start of the action and consumes one bone on completion. A new action replaces it, and the bone must still be in the selected slot when the action completes.

| Item        | Prayer Experience | Store Value |
| ----------- | ---------------- | ----------- |
| Bones       | 5                | 4 coins     |
| Heavy bones | 13               | 8 coins     |

The general store pays 1 coin for bones and 3 for heavy bones. Existing enemy drops and store prices carry over.

## 4. Shrines

A shrine is a fixed place, like a station, that never runs out and that any number of players can use at once. It blocks walking and does not stop shots. Clicking a shrine offers Pray and Offer bones; the player walks next to it first.

Praying refills 20 prayer points a tick until the pool is full or the player moves. It pays no experience and costs nothing.

Offering bones takes one bone every two ticks (600 ms) after arrival, every bone and heavy bone in the bag in bag order, until none are left or the player moves or clicks elsewhere. With no bones in the bag it is refused with "You have no bones to offer."

| Item        | Offered at a Shrine |
| ----------- | ------------------- |
| Bones       | 15                  |
| Heavy bones | 40                  |

Two shrines stand on the region, each one tile of four stone columns under a carved roof:

- **The village shrine**, on the south-east corner of the village square (21, 45). No new building stands with it.
- **The Cairns shrine**, west of the Cairns field among its burial mounds (64, 9). Every tile beside it lies more than 8 tiles from each Cairn warden's home, past the 3 tiles it wanders plus the larger of its 4-tile notice range and 5-tile leash.

## 5. Prayers

A player turns prayers on and off from the Prayer tab. Nine boost prayers stand on three ladders of three steps each. The three wards are listed but cannot be turned on yet; a later ticket builds them.

| Prayer         | Ladder, Step | Prayer Level | Effect                                   | Drain per 200 Ticks |
| -------------- | ------------ | ------------ | ---------------------------------------- | ------------------- |
| Sure Hand      | Accuracy 1   | 1            | +3 points to land                        | 10                  |
| Firm Grip      | Might 1      | 4            | +50 hit                                  | 10                  |
| Light Step     | Avoidance 1  | 7            | +3 Avoidance                             | 10                  |
| True Aim       | Accuracy 2   | 10           | +6 points to land                        | 20                  |
| Stone Fist     | Might 2      | 13           | +100 hit                                 | 20                  |
| Quick Shadow   | Avoidance 2  | 16           | +6 Avoidance                             | 20                  |
| Far Sight      | Accuracy 3   | 20           | +10 points to land                       | 30                  |
| Giant's Wrath  | Might 3      | 22           | +150 hit                                 | 30                  |
| Mist Walker    | Avoidance 3  | 25           | +10 Avoidance                            | 30                  |
| Ward of Arrows | Ranged ward  | 28           | Halves ranged enemies' landed hits       | 40                  |
| Ward of Steel  | Melee ward   | 31           | Halves melee enemies' landed hits        | 40                  |
| Ward of Runes  | Magic ward   | 34           | Halves magic enemies' landed hits        | 40                  |

An Accuracy prayer adds its points to the player's chance to land with every style, on the same scale as worn Accuracy and before the combat triangle moves it. A Might prayer adds to a landed hit with every style, on top of a Might potion. An Avoidance prayer adds to the player's Avoidance against every enemy, on top of an Avoidance potion; an enemy still keeps its 5% chance to hit. Prayers add on top of gear Virtues and potions.

One step of each ladder runs at a time: turning on another step turns the first off. Different ladders run together.

Each active prayer adds its drain every tick, and each whole 200 costs one point, so the fraction carries between ticks and drain is exact over time. Two step-1 prayers together cost one point every 10 ticks. While any prayer is on, no points regenerate. When the pool reaches 0, every prayer switches off and the chat says "You have run out of prayer points. Your prayers fade."

Turning a prayer on is refused above its level with "You need Prayer N for that." and at 0 points with "You have no prayer points left. Pray at a shrine to refill them." Turning one off is never refused. A change works mid-fight and takes effect from the next tick, but not during an Agility crossing, like stances.

Prayers switch off on death. They are not saved, so logging out switches them off and a returning player logs in with none on.

## 6. The Prayer Tab

The Prayer tab sits on the character sheet after Spellbook. It shows the points as a bar and as "Prayer points x / y", then the twelve prayers in level order, each with its name, level, drain a minute (200 ticks) and effect. Prayers above the player's level show greyed, and so do the wards until they arrive. Active prayers are lit. Clicking a prayer turns it on or off, or prints why it cannot be turned on.

Every player with any prayer on shows a small glowing blue star over their head, between the health bar and their name, which everyone sees.
