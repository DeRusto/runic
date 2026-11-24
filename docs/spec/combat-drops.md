# Runic: Combat drops

**Status: building.** Terms are defined in `GLOSSARY.md`. This is milestone 4 of the Phase 8 map (#88), planned in spec #293 from the owner's decision in #272. It gives the Spider its first drop, and the next ticket adds bones and heavy bones to five other enemies. It changes no rule of how loot lands: each player who damaged an enemy rolls its loot table, and what they win lands on the enemy's tile as their own ground item for the first minute, with a chat line (#71).

The values live in the `loot` rows of `shared/src/enemies.ts`; where this page and that file disagree, the file wins and this page is fixed.

## 1. Spider silk

Every Spider kill leaves 1 or 2 spider silk for each player who damaged it, at even odds (#272, #295). The Spider's loot table holds one material row at chance 1, so it takes no chance roll, and each damager rolls only the count. Rope takes two silk at the workbench, so a player has enough for one rope after about one and a half kills.

| Enemy  | Item        | Chance     | Count       |
| ------ | ----------- | ---------- | ----------- |
| Spider | Spider silk | every kill | 1 or 2, even |

A player who swung at the Spider but never landed a hit gets no silk, as with any other loot.
