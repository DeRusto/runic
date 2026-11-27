# Runic: Enemy expansion

**Status: building.** Terms are defined in `GLOSSARY.md`. This is milestone 3 of the Phase 8 map (#88). The spec issue #294 gathers the owner's decisions (#273, #274), and each build ticket records here the part it builds. The first ticket (#297) gives the Bristleback and Cinderhorn numbers fit for their hide bands.

The values live in `shared/src/enemies.ts`; where this page and that file disagree, the file wins and this page is fixed. Every number here is a first value for playtest.

## 1. Tougher hide creatures

The Bristleback and Cinderhorn were tuned only to be killable, so a band-10 or band-20 player killed them in a few hits without risk. They now fight back at their hide band's strength (#273, #297):

| Creature              | Health      | Hits land  | Max hit    |
| --------------------- | ----------- | ---------- | ---------- |
| Bristleback (band 10) | 500 → 1400  | 20% → 40%  | 100 → 300  |
| Cinderhorn (band 20)  | 1000 → 2600 | 25% → 50%  | 150 → 450  |

"Hits land" is the share of swings that hit a player with no Avoidance; Avoidance, an Avoidance potion and the combat triangle move it as they move any enemy's. A landed hit is any whole number from 100 to the max hit, as for every enemy.

Their behaviour is otherwise unchanged. Both still start no fights, never wander, and give up once their attacker stands more than 2 tiles from where they last attacked. Their swing timing, return time, hide and bone drops stay as they were. The Tarn Ox stays docile and unchanged, so a new player keeps a safe first hide.

Experience comes from damage dealt (6 per 100), so a kill now pays for all of its health: about 84 for a Bristleback and 156 for a Cinderhorn, before the stance splits it. Each hit's experience is rounded on its own, as for every enemy, so a kill's total can land a few points either side (a Bristleback killed in twelve hits of 109 and one of 92 pays 90).

## 2. Ranged Enemies

The Skeleton Mage shoots from up to 5 tiles and fights in the ranged style (#298). A diagonal step counts as one tile. A fighting ranged enemy stands still while its target is within reach and in sight. It shoots when its attack timer is due. If reach or sight fails, it follows its walking route toward the target until both hold. Enemies without a shot reach still swing only when next to their target.

Shots use the same tall-tile sight check as player shots. House walls, trees, rocks, columns, standing stones and burial mounds block them. Shots pass over water and run-out Woodcutting stumps. Stumps still block walking while the tree regrows. Noticing still requires a walking route, and the existing leash still ends a chase. A player's attack renews the chase as before.

The Mage keeps its first attack delay and shoots every 8 ticks when it can. Its shot uses the same roll as a swing, including Avoidance, the combat triangle, shield block, armour, the health cap and Defense experience. It spends no ammunition and leaves none on the ground. The Mage casts with its staff and the hit shows on the player.

## 3. Thornling

Four Thornlings live in the middle field (#299). Each has 1000 health, 0 Accuracy, a base 40% chance to land a shot, and a max hit of 250. It fights at range, shoots up to 4 tiles using the sight rule in §2, and leashes 4 tiles from its attacker’s last attack. It ignores passers-by and retaliates on an attack, including a miss under the existing chase rule.

Its timing matches the Spider. The first shot is due after 4 ticks, then every 8 ticks. At idle it has a 10% chance to take a wander step when ready to move, up to 5 tiles from home. It returns at home 150 ticks after death. A fight pays the usual experience for damage dealt, and a kill yields no loot or bones.

Its attack animation flings a thorn, with the hit shown when the thorn reaches the player. The hover tooltip reads “Thornling” and the right-click menu offers “Attack Thornling”.

## 4. Fenwing

Four Fenwings live on the Lake shore beside the Tarn Oxen (#300). Each has 500 health, 0 Accuracy, a base 30% chance to land a hit, and a max hit of 150. A Fenwing ignores passers-by. It retaliates in melee and gives up once its attacker stands more than 3 tiles from where they last attacked.

The timing matches the Spider. The first swing is due after 4 ticks, with subsequent swings every 8 ticks. At idle it has a 10% chance to wander when ready to move, up to 2 tiles from home to stay near the shore. It returns home 150 ticks after death.

Each player who damaged it gets 3 to 6 feathers and independently has a two-in-three chance to get bones. Both drops appear on the defeated Fenwing's tile and are private to the recipient for the first minute. Feathers are used in the arrow recipe, and the general store continues to sell them.

## 5. Gorger

Three Gorgers live in the middle field (#301). A Gorger has 1600 health, 0 Accuracy, a base 45% chance to land a melee swing and a max hit of 350. It notices reachable players within 3 tiles and gives up past its 4-tile leash.

Its timing and wander match the Skeleton. The first swing is due after 4 ticks, then every 8 ticks. When idle and ready to move it has a 10% chance to wander up to 3 tiles from home. It returns home 200 ticks after death.

Each damager gets one pick from the bag, a single material loot row with a guaranteed roll. Each weight below applies to one item and the weights total 100. Count ranges are inclusive and uniform. The pick lands on the Gorger's tile and stays private to the damager for the first minute. The Gorger has no separate bone roll. Both swords are common quality.

| How often | Weight per item | Items |
| --------- | --------------- | ----- |
| Often | 24 | Spider silk (1–2), feathers (3–6) |
| Fairly often | 12 | Bones (1), coins (5–20) |
| Sometimes | 6 | Tarn hide (1), bristle hide (1), copper arrows (5–10), bronze arrows (5–10) |
| Rarely | 1 | Cinder hide (1), Emberbone (1), copper sword (1), bronze sword (1) |

## 6. The Cairns and the Cairn Warden

The Cairns is a moss-covered field within the existing region, above the Boneyard (#302). It spans columns 69 to 90 and rows 3 to 13, with an open approach from the south. Its five burial mounds replace rock props, so their tiles still block walking and shots in both directions. No previously walkable tile gains a blocker.

Four Cairn wardens live there. Each has 4500 health, a base 65% chance to land a melee swing, +15 Accuracy and a max hit of 800. It notices reachable players within 4 tiles and gives up past its 5-tile leash. The first swing is due after 4 ticks, then every 8 ticks. When idle and ready to move, it has a 10% chance to wander up to 3 tiles from home. It returns home 200 ticks after death.

Each player who damaged the warden independently rolls a two-in-three chance for one heavy bones drop on the warden's tile. The drop is private to that player for the first minute. The warden has no other loot.

## 7. Elites

After an enemy dies, its return has a one-in-twenty chance to be elite (#303). Startup enemies are ordinary, and docile enemies such as the Tarn Ox always return ordinary. An elite keeps its variant until death, including when it walks home and recovers. The next return rolls again.

An elite has double its kind's maximum health, +10 Accuracy points and a max hit 25% higher. Round the max hit to the nearest whole unit, with halves rounded up. A Fenwing's 150 becomes 188. The elite keeps its kind's noticing, wandering, chase, leash, style and reach. Experience still comes from damage dealt and is rounded per hit.

Among enemies, only elites can land critical hits (#304). A swing or shot that hits and gets past the shield has a 10% chance to deal 1.5 times its rolled damage, rounded to the nearest whole unit with halves rounded up. Armour and Defense experience use the increased hit, and health lost is capped at what the player has left. The server marks the hit as critical and the player sees the same critical damage display used for their own attacks.

For each damager, every gear and material row gets twice its usual independent picks. Quest rows keep their usual picks and quest requirements, so an Elite Skeleton Mage can leave at most one bone sigil for a damager on Hollis's offering. An elite always drops one of its kind's bones per damager if its kind has a bone drop. An Elite Gorger gives two bag picks, and an Elite Imp still leaves nothing.

The server syncs the elite flag and the enemy's own maximum health. The client shows “Elite” before the kind's name in the menu, tooltip and defeat message. Its figure is 20% larger with a violet tint. The health bar reads against its own maximum.
