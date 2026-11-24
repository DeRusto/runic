# Runic: Combat drops

**Status: built.** Terms are defined in `GLOSSARY.md`. This is milestone 4 of the Phase 8 map (#88), planned in spec #293 from the owner's decision in #272. Spiders leave silk, and five other enemies leave bones or heavy bones. It changes no rule of how loot lands: each player who damaged an enemy rolls its loot table, and what they win lands on the enemy's tile as their own ground item for the first minute, with a chat line (#71).

The drop values live in the `loot` and `bone` fields of `shared/src/enemies.ts`; where this page and that file disagree, the file wins and this page is fixed.

## 1. Spider silk

Every Spider kill leaves 1 or 2 spider silk for each player who damaged it, at even odds (#272, #295). The Spider's loot table holds one material row at chance 1, so it takes no chance roll, and each damager rolls only the count. Rope takes two silk at the workbench, so a player has enough for one rope after about one and a half kills.

| Enemy  | Item        | Chance     | Count       |
| ------ | ----------- | ---------- | ----------- |
| Spider | Spider silk | every kill | 1 or 2, even |

A player who swung at the Spider but never landed a hit gets no silk, as with any other loot.

## 2. Bones and Heavy Bones

Each player who damaged an enemy rolls its loot table and then independently rolls for one bone item, if the enemy has a bone field (#272, #296). The bone lands on the enemy's tile, belongs to that player for the first minute, and gets its own chat line. A Skeleton can leave both bones and an Emberbone on the same kill.

| Enemy | Bone item | Chance | Other loot |
| ----- | --------- | ------ | ---------- |
| Skeleton | Bones | 2 in 3 | Emberbone (1 in 4) |
| Skeleton Mage | Heavy bones | 2 in 3 | Bone sigil (1 in 3, only for players Hollis asks it of) |
| Tarn Ox | Bones | 2 in 3 | Tarn hide (every kill) |
| Bristleback | Bones | 2 in 3 | Bristle hide (every kill) |
| Cinderhorn | Heavy bones | 2 in 3 | Cinder hide (every kill) |
| Spider | None | | Spider silk (every kill) |
| Imp | None | | None |

Both stack to 20 in the inventory and can be banked. Their store values are 4 coins for bones and 8 for heavy bones. Marta pays 1 and 3 coins respectively. Phase 9 adds their use in Prayer.
