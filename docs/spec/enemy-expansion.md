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
