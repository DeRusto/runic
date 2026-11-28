# Runic: Magic

**Status: building.** Terms are defined in `GLOSSARY.md`. This is the second milestone of the Phase 9 map (#89). The spec issue #325 gathers the owner's decisions (#317, #318, #319, #320, #324), and each build ticket records here the part it builds. The first ticket (#327) makes Magic a trained skill, adds the three staves Crafting makes, and adds the focus and fury runes the spells will spend. Casting, the spellbook and the spells come in later tickets.

The values live in `shared/src/skills.ts` (the skill list), `shared/src/weapons.ts` and `shared/src/gear.ts` (a staff's gate and Accuracy), `shared/src/making.ts` (the staff and rune recipes), `shared/src/runecrafting.ts` (the rune list), `shared/src/strongboxes.ts` (the strongboxes' rune picks) and `shared/src/generalStore.ts` (store values); where this page and those files disagree, the files win and this page is fixed.

## 1. The Magic skill

Magic moves from the upcoming skills to the trained ones, after Ranged on the character sheet. It has its own synced experience field and save column, and counts toward total level as it already did at level 1. Mastery takes its usual 7% share of Magic experience (#80). The combat level formula already read Magic at 1.5 times (#78), so it needs no change; it now reads a real level. A save from before this build loads with 0 Magic experience and loses nothing else.

Nothing pays Magic experience until casting comes.

## 2. Staves

Crafting makes three staves at the workbench (#317). Each is weapon gear gated on Magic:

| Staff | Made from | Crafting gate | Crafting experience | Magic gate | Accuracy |
| --- | --- | --- | --- | --- | --- |
| Birch | 1 birch log | 1 | 8 | 1 | +5 |
| Oak | 1 oak log, 1 ashstone | 10 | 16 | 10 | +10 |
| Charwood | 1 charwood log, 1 cinderglass | 20 | 25 | 20 | +15 |

The experience runs along Crafting's own line, from the rope's 8 to the Gossamer cloak's 25, since #325 left it to the build. A staff's store value is what it is made from, as a bow's is: 3 coins for the birch staff, 31 for the oak and 62 for the charwood.

The weapon slot's gate stays per item: swords gate on Attack, bows and throwing knives on Ranged, and staves on Magic. A staff's Accuracy adds to its wearer's chance to hit, as a bow's or a ring's does. A staff carries no hit bonus, because the spell will carry it. A shield can be worn with a staff, and a worn staff drops on death like any other worn gear.

Staves roll improved versions, and the improved chance reads the recipe's skill, Crafting, as a bow's reads Fletching. Their Virtues size like any weapon's.

Until casting comes, a staff has no reach of its own, so a player with one in hand fights in melee: the swing trains Attack and Strength as the stance directs, takes the staff's Accuracy on its chance to hit, and adds no hit bonus. The magic style comes with casting.

## 3. The migration

One migration adds Magic's experience column with a default of 0, so no row needs converting and every other column stays as it was.

## 4. The focus and fury runes

| Rune | Runecrafting gate | Doubles at | Experience | Store value | The store pays |
| --- | --- | --- | --- | --- | --- |
| Focus rune | 1 | 2 | 5 | 20 | 8 |
| Fury rune | 15 | 30 | 16 | 60 | 24 |

Both are made at the altar in Runestone Hollow from rune essence, one essence to one rune, or two at the doubling level, and a make never fails (#230, #320). There is no new station. The altar's Runecrafting section lists the six runes in gate order.

The store pays 8 coins for a focus rune and 24 coins for a fury rune and keeps both off the shelf when players sell them (#327). Their values of 20 and 60 produce those payouts under the store's usual 40% rule.

Both strongboxes' rune picks grow from the four elementals to all six runes, an even pick, with today's counts: 2 to 5 of one rune from the Boneyard's, and 4 to 10 from Runestone Hollow's.

The focus and fury rune icons are the air and fire medallions with their glyphs and gems recoloured, until the owner has medallions for them.
