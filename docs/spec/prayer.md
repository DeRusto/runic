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
