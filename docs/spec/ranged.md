# Runic: Ranged

**Status: building.** Terms are defined in `GLOSSARY.md`. This is the second milestone of the Phase 8 map (#88). The spec issue #275 gathers the owner's decisions (#268, #269, #270, #271), and each build ticket records here the part it builds. The first ticket (#276) makes Ranged a trained skill, adds the ammo slot, and gates bows and arrows on Ranged; shooting, stances, recovery, the combat triangle and chasing come in later tickets and extend this page.

The values live in `shared/src/skills.ts` (the skill list) and `shared/src/gear.ts` (gates, bonuses and the ammo slot); where this page and those files disagree, the files win and this page is fixed.

## 1. The Ranged skill

Ranged moves from the upcoming skills to the trained ones, after Defense on the character sheet. It has its own synced experience field and save column, and counts toward total level like any other skill. Mastery takes its usual 7% share of Ranged experience (#80). The combat level formula already read Ranged (#78), so it needs no change. A save from before this build loads with 0 Ranged experience.

Nothing pays Ranged experience until the shooting ticket: a bow still fights in melee and trains Attack and Strength as the stance directs (melee rework spec §3).

## 2. Gear, gates and the ammo slot

The gear set gains an eleventh slot, the ammo slot (#269). It holds one stack of arrows and nothing else, up to 20, the inventory's stack size (owner, 2026-11-23). A save from before this build loads with it empty. The ammo slot can hold arrows while a sword is in hand; arrows do nothing unless a bow is wielded, and that comes with shooting.

The weapon slot and the ammo slot each carry a count, synced and saved beside the item, because throwing knives will stack in the weapon slot (#269). Equipping, taking off and drop on death move the whole count:

| Action | Ammo slot |
| --- | --- |
| Equip arrows into an empty slot | The whole inventory stack moves in |
| Equip more of the arrow already worn | The slot tops up to 20, and the rest stays in its inventory slot; a full slot says so and takes none |
| Equip another tier | The two stacks trade places, each with its own count |
| Take off | The whole stack goes to the first empty inventory slot, or is refused with no empty slot |
| Die | The whole stack drops as one ground item, under the ground item rules (#71) |

The top-up is this build's choice, since #275 left it open: it fills the slot as far as one click's stack allows and keeps the tier the player already chose, so a click never swaps a partial slot for a different count of the same arrow.

A worn weapon from before this build counts as one. Every other slot still holds one item.

### Gates and stats

The weapon slot's gate is per item: swords gate on Attack, and bows on Ranged. Arrows gate on Ranged. Every other piece still gates on Defense.

| Arrow | Hit bonus | Ranged gate |
| --- | --- | --- |
| Copper | 100 | 1 |
| Bronze | 150 | 5 |
| Iron | 200 | 10 |
| Steel | 250 | 15 |
| Emberite | 300 | 20 |

| Bow | Accuracy | Ranged gate |
| --- | --- | --- |
| Birch | +5 | 1 |
| Oak | +10 | 10 |
| Charwood | +15 | 20 |

A bow's Accuracy adds to the wearer's chance to hit, as a ring's does (#238). The sword-copied hit bonus bows carried before is gone, so the arrow alone will decide how hard a shot hits. Arrows add nothing to a sword's swing.

A bow a player wore before this build stays worn and keeps working: the gate is checked only when gear goes on, so no migration touches it (#268). Once taken off, it goes back on only at its Ranged gate.

Arrows are gear but never come out improved when fletched, since no decision makes ammo improvable. Bows still roll improved versions on Fletching, and their Virtues size by the metal tier their wood's gate matches (#228).

## 3. The migration

One migration adds Ranged's experience column, the ammo slot and the two counts, each with a default, so no row needs converting. A worn weapon with no count loads as a count of 1. Every other column, the worn bow included, stays as it was.
