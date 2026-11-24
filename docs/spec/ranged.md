# Runic: Ranged

**Status: building.** Terms are defined in `GLOSSARY.md`. This is the second milestone of the Phase 8 map (#88). The spec issue #275 gathers the owner's decisions (#268, #269, #270, #271), and each build ticket records here the part it builds. The first ticket (#276) makes Ranged a trained skill, adds the ammo slot, and gates bows and arrows on Ranged. The second (#277) adds shooting with a bow, and the third (#278) adds sight, so houses, trees and rocks block a shot. The fourth (#279) adds throwing knives. Stances, recovery, the combat triangle and chasing come in later tickets and extend this page.

The values live in `shared/src/skills.ts` (the skill list), `shared/src/gear.ts` (gates, bonuses, the ammo slot, and a bow's reach and fire rate) and `shared/src/ranged.ts` (the ranged hit) and `shared/src/sight.ts` (the tall tiles and the line of sight); where this page and those files disagree, the files win and this page is fixed.

## 1. The Ranged skill

Ranged moves from the upcoming skills to the trained ones, after Defense on the character sheet. It has its own synced experience field and save column, and counts toward total level like any other skill. Mastery takes its usual 7% share of Ranged experience (#80). The combat level formula already read Ranged (#78), so it needs no change. A save from before this build loads with 0 Ranged experience.

A bow shot pays Ranged experience (§4). A sword or bare hands still fight in melee and train Attack and Strength as the stance directs (melee rework spec §3).

## 2. Gear, gates and the ammo slot

The gear set gains an eleventh slot, the ammo slot (#269). It holds one stack of arrows and nothing else, up to 20, the inventory's stack size (owner, 2026-11-23). A save from before this build loads with it empty. The ammo slot can hold arrows while a sword is in hand; arrows do nothing unless a bow is wielded (§4).

The weapon slot and the ammo slot each carry a count, synced and saved beside the item, because throwing knives stack in the weapon slot (#269). Equipping, taking off and drop on death move the whole count:

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

## 4. Shooting

A player's style is the weapon in hand: a bow shoots, and a sword or bare hands fight in melee (#271). Every outcome below is decided on the server; the client sends only the attack intent.

### Reach and fire rate

| Value | Bow | Melee, for comparison |
| --- | --- | --- |
| Reach | 6 tiles, a diagonal step counting as one (#270) | Next to the enemy |
| Ticks between attacks | 8 (#270) | 8 |

A player who attacks an enemy within reach shoots from where they stand. From further off, they walk toward it, re-pathing each step as it moves, and stop on the first tile within reach; the first shot comes on the tick they arrive. The walk goes to the nearest tile in reach, counted in steps, even when the enemy itself cannot be reached on foot, such as behind a wall of trees. An enemy that moves out of reach mid-fight is walked back into reach the same way, and no shot fires, no arrow is spent and no experience is paid until it is in reach again (owner, #277). "In reach" here always means in reach and in sight, as the next section sets out.

### Sight

A shot needs a straight line from the centre of the shooter's tile to the centre of the target's that crosses no tall tile (#270, #278). The tall tiles are (owner, 2026-11-23):

| Tall | On the map |
| --- | --- |
| House walls | Every wall tile of a house |
| Trees | Tree props, and the trees Woodcutting fells |
| Rocks | Rock props, ore veins and essence veins |
| Runestone Hollow's ruins | Its columns and standing stones |

Every other tile lets a shot pass: doors, water, bushes, the gate, stations, stalls, strongboxes, barrels, crates, lamps, the well, villagers, marks, enemies and players (owner, #278). So a player can shoot across the Lake but not through a house. A Woodcutting tree that has run out shows as a stump, which a shot passes over until the tree grows back, though the stump still blocks walking (owner, #286). A run-out vein still blocks a shot. A pooled tree or vein that has left its spot blocks nothing until it comes back.

The line counts every tile it touches, even at a single corner, so a diagonal that squeezes past the corner of a wall is blocked; this build took the suggestion in #278. The shooter's and the target's own tiles never block. The check reads only the line between the two tiles, so it gives the same answer with shooter and target swapped. It lives in `shared` as `inSight`, for the ranged enemies of a later milestone to use too.

A player who attacks a target in reach but out of sight walks to the nearest tile, counted in steps, from which the target is both in reach and in sight, then fires on the tick they arrive. A target that moves out of sight mid-fight is walked to again the same way, with the same check made fresh on every step. When no tile the player can walk to has the target in both, the attack is cancelled and the chat says "You can't get a clear shot at that." No shot fires, no arrow is spent and no experience is paid, and the player never walks forever.

Sight is for shots only. A melee swing still needs the player next to the enemy, and enemies, which all fight in melee, check no sight.

### The hit

A ranged shot uses melee's curves, read from Ranged (#268):

| Value | Rule |
| --- | --- |
| Chance to land | 40%, plus 0.5 points per Ranged level above 1, plus worn Accuracy (the bow's and the ring's) |
| Damage on a landed shot | 100 to (200 + 100 per 20 Ranged levels), plus the arrow's hit bonus and Might (the Might potion and the Might Virtue) |
| Critical | Agility's crit chance (Agility spec §1), for 1.5 times the damage |
| Experience | 6 Ranged per 100 damage dealt, rounded once per shot, none for overkill, and Hitpoints the same again |

Stances come in a later ticket, so all of a shot's experience goes to Ranged, as Steady will send it. Attack and Strength play no part in a shot, and the arrow adds nothing to a sword's swing. The melee hit and its numbers are unchanged; both share one roll in `shared/src/combat.ts`.

### Spending and refill

Each shot spends one arrow from the ammo slot, hit or miss. When a shot spends the slot's last arrow, the slot refills with up to 20 more of the same arrow from the inventory, taken from its slots in order, so the fight carries on (owner, 2026-11-23). Other tiers in the inventory are left alone.

When neither the slot nor the inventory holds any more of that arrow, the attack stops at once and the chat says "You have no arrows left to fire." The enemy keeps fighting as usual. A bow with an empty ammo slot cannot start an attack, with the same line, and a player in that state who is hit while idle does not fight back. Nothing is said then: the line comes when the arrows run out or when the player tries to attack.

### The check before each shot

Before every shot the server checks again that the target is alive and that a bow and an arrow are worn (owner, #277). A target that has died ends the attack. A bow taken off mid-fight ends the attack rather than turning it into a bare-handed swing, and arrows taken off end it with the chat line above once the next shot falls due, even while walking back into reach; in each case nothing is spent and nothing is paid. Repeated attack clicks never give more than one shot, arrow spent or experience award in a tick, and never beat the bow's 8 ticks, as the timer between shots outlives each click.

The client checks the empty-ammo refusal too and shows the line without sending the click, while the server's check stays the one that decides.

### Fighting back

A player with a bow and arrows who is hit while idle fights back with the bow, under the same reach, fire rate and spending rules, 4 ticks after the enemy's swing, as a melee player does.

### On the client

A bow shot plays the character's overhand cast clip, and its damage number, flash and nudge show at the enemy 1000 ms later, once the arrow would have flown. The shooter turns to face the enemy on each shot, even one that ends the fight. This is this build's choice of shot art, which #275 left open.

## 5. Throwing knives

Throwing knives use the ranged hit, sight and experience rules in §4. A player can throw from up to 4 tiles away and throws once every 6 ticks. Each knife supplies its tier's hit bonus and adds no Accuracy.

| Throwing knife | Hit bonus | Ranged gate |
| --- | --- | --- |
| Copper | 100 | 1 |
| Bronze | 150 | 5 |
| Iron | 200 | 10 |
| Steel | 250 | 15 |
| Emberite | 300 | 20 |

Smithing uses the existing anvil recipes and produces common knives. A player equips up to 20 of one tier in the weapon slot, and the Gear tab shows the count. Equipping more of the same tier by hand tops up the stack to 20. Swapping puts the entire worn stack into the inventory slot freed by the incoming weapon. Taking the stack off requires an empty inventory slot. On death the remaining knives drop together under the ground item rules (#71).

A throw spends one knife whether it hits or misses. The last throw empties the weapon slot, ends the attack and shows “You have no throwing knives left to throw.” Any knives in the inventory remain there. The enemy can keep attacking, and the player stays idle against it until they give another order, equip a weapon, or either combatant dies.
