# Runic: Melee rework

**Status: building.** Terms are defined in `GLOSSARY.md`. This is the first milestone of the Phase 8 map (#88): Attack and Strength replace Combat. The owner decided the split in #70 and #99 and the combat level formula in #78. The issues leave one choice open, where a melee hit's experience goes, and section 3 records the choice this build made.

The values live in `shared/src/stats.ts`, `shared/src/combat.ts`, `shared/src/stances.ts`, the fighting constants in `shared/src/index.ts`, the weapon gates and bonuses in `shared/src/gear.ts` and the combat level formula in `shared/src/skills.ts`; where this page and those files disagree, the files win and this page is fixed.

## 1. The two skills

Attack and Strength take Combat's place in the skill list, at its head, and count toward total level like any other skill. Combat is no longer a skill: the character sheet, the bar and pinning no longer offer it. Defense, Blocking and Hitpoints are unchanged.

## 2. Hit and damage

The numbers are Combat's old ones, with each read from its own skill:

| Value | Rule |
| --- | --- |
| Chance to land a swing | 40%, plus 0.5 points per Attack level above 1, plus worn Accuracy |
| Damage on a landed hit | 100 to (200 + 100 per 20 Strength levels), plus the weapon's hit bonus and Might |
| Critical | 10% of landed hits, for 1.5 times the damage, as before |

Every weapon, the bows included, gates on Attack at the level it gated on Combat. The Ranged milestone re-gates bows on Ranged.

## 3. Stances and experience

A melee hit still pays 6 experience per 100 damage dealt, rounded once per swing, with none for overkill, and pays Hitpoints the same amount again. The player's stance decides how the melee experience splits between Attack and Strength:

| Stance | Attack | Strength |
| --- | --- | --- |
| Balanced | half | half |
| Precise | all | none |
| Forceful | none | all |

Balanced gives Attack the odd point of an odd total, so a hit never pays more or less than before. A new player starts Balanced, and a player changes stance on the character sheet's Gear tab at any time, even mid-fight; the next swing pays the new stance.

This is RuneScape Classic's choice of fighting style under Runic's names, chosen because the issues left the split open. Two parts of RSC's styles are left out on purpose. Its defensive style trained Defence from the player's own hits, but Runic's Defense trains from being attacked, so no stance pays Defense. Its styles also added hidden levels to the skill they trained; Runic's stances change only where experience goes, so the character sheet's numbers stay the whole story.

## 4. The migration

One migration runs once on the first boot of this build:

- Every player's Attack and Strength experience each become a full copy of their Combat experience, so no one loses a level, and Combat's column goes.
- The copy earns no Mastery share (#99), as with the Foraging split.
- A pinned Combat becomes a pinned Attack in the same place, with Strength right after it when the bar has room (five pins or fewer before the split). A full bar keeps its six pins, with Attack where Combat was.
- Every player starts Balanced.

A new player's starting pins are Attack, Strength, Defense, Herblaw, Hitpoints and Mining.

## 5. Combat level

The formula from #78 now reads the real Attack and Strength levels: `floor(0.25 × (Defense + Blocking + Hitpoints + floor(Prayer / 2)) + max(0.325 × (Attack + Strength), 0.325 × floor(1.5 × Ranged), 0.325 × floor(1.5 × Magic)))`. Because the migration copies Combat to both, every existing player keeps the combat level they had, and a fresh player is still level 3.
