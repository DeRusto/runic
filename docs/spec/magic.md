# Runic: Magic

**Status: building.** Terms are defined in `GLOSSARY.md`. This is the second milestone of the Phase 9 map (#89). The spec issue #325 gathers the owner's decisions (#317, #318, #319, #320, #324), and each build ticket records here the part it builds. The first ticket (#327) makes Magic a trained skill, adds the three staves Crafting makes, and adds the focus and fury runes the spells spend. The second (#329) adds the Spellbook tab and casting the eight combat spells for their damage. The third (#332) adds the effects of air, water and earth spells. The fourth (#333) adds the three utility spells. Fire’s burn and the ability bar come in later tickets.

The values live in `shared/src/skills.ts` (the skill list), `shared/src/weapons.ts` and `shared/src/gear.ts` (a staff's gate and Accuracy), `shared/src/making.ts` (the staff and rune recipes), `shared/src/runecrafting.ts` (the rune list), `shared/src/strongboxes.ts` (the strongboxes' rune picks), `shared/src/magic.ts` (the combat spells, reach, cast rate, refusals and the magic hit), `shared/src/utilitySpells.ts` (the utility spells, their refusals, Coin-turn's price and the teleports' landing tiles) and `shared/src/generalStore.ts` (store values); where this page and those files disagree, the files win and this page is fixed.

## 1. The Magic skill

Magic moves from the upcoming skills to the trained ones, after Ranged on the character sheet. It has its own synced experience field and save column, and counts toward total level as it already did at level 1. Mastery takes its usual 7% share of Magic experience (#80). The combat level formula already read Magic at 1.5 times (#78), so it needs no change; it now reads a real level. A save from before this build loads with 0 Magic experience and loses nothing else.

Casting pays Magic experience (§5).

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

A staff in hand puts its wielder in the magic style and casts the picked combat spell (§5). Before #329 a staff fought in melee; it no longer swings.

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

## 5. Casting the combat spells

A player's style is the weapon in hand, so a staff puts them in the magic style (#271, #317). The combat triangle's magic side then applies unchanged: a cast lands 10 points more often on a melee enemy and 10 points less often on a ranged one, and the triangle never moves the damage.

The spellbook opens with eight combat spells, a dart and a surge for each element (#318):

| Spell | Magic gate | Hit bonus | Base experience | Runes per cast | Effect |
| --- | --- | --- | --- | --- | --- |
| Air dart | 1 | 100 | 2 | 1 air, 1 focus | 5 points off Accuracy for 20 ticks |
| Water dart | 5 | 150 | 3 | 1 water, 1 air, 1 focus | Next swing 4 ticks late |
| Earth dart | 10 | 200 | 4 | 2 earth, 1 air, 1 focus | Held for 6 ticks |
| Air surge | 15 | 250 | 5 | 1 air, 1 fury | 10 points off Accuracy for 20 ticks |
| Fire dart | 20 | 300 | 6 | 3 fire, 2 air, 1 focus | Burns for 3 hits of 10% over 6 ticks |
| Water surge | 25 | 350 | 7 | 1 water, 1 air, 1 fury | Next swing 8 ticks late |
| Earth surge | 30 | 400 | 8 | 2 earth, 1 air, 1 fury | Held for 12 ticks |
| Fire surge | 35 | 450 | 9 | 3 fire, 2 air, 1 fury | Burns for 3 hits of 20% over 6 ticks |

The Spellbook tab lists every effect. Air, water and earth apply their effects on landed hits (§8). Fire deals its cast damage and will gain its burn in #334.

The player's picked combat spell is saved with the player. A new player, and every save from before casting, has none picked. Picking a spell above the player's Magic level is refused with a line naming the gate, such as "You need Magic level 5 to cast Water dart.", and changes nothing.

A cast reaches 8 tiles, a diagonal step counting as one, under the same sight check and tall tiles as a shot (#270). An attack on an enemy out of reach or out of sight walks the player to the nearest tile with both, as a bow's does. A player casts every 10 ticks. Magic has no stances, so nothing changes the reach or the rate, and the Gear tab shows no stance buttons for a staff.

Every cast spends its spell's runes from the inventory, hit or miss, and none come back. With no spell picked, an attack with a staff is refused with "Choose a combat spell first." Without the runes, at the click or when a cast falls due mid-fight, the attack stops with "You have run out of runes." The enemy keeps fighting as usual. Taking the staff off mid-fight ends the attack, as taking a bow off does (#277).

A cast's chance to land and its max hit use the shared hit curves on the Magic level: 40% plus 0.5 points per Magic level above 1, plus worn Accuracy (the staff's and the ring's), and a max of 200 plus 100 every 20 Magic levels. A landed cast deals a whole number from 100 to that max, plus the spell's hit bonus and Might (worn and from a Might potion). Agility's crit chance applies, and a critical cast deals 1.5 times its hit.

Each cast pays its spell's base experience to Magic, hit or miss, plus 6 per 100 damage dealt, rounded once, with none for overkill. Hitpoints gets the damage part again; Defense, Attack and Strength get nothing.

An idle mage who is hit fights back with the picked spell under the same reach and sight rules. With no spell picked or no runes, they stay idle.

A cast plays the Use_Item clip on the caster, and the hit shows at the enemy once the clip reaches it, as a shot's does.

## 6. The Spellbook tab

The character sheet has a fourth tab, Spellbook, beside Gear, Skills and Appearance. It lists the eight combat spells in gate order, each with its Magic gate, runes, hit bonus and effect, then the utility spells (§9). Spells above the player's Magic level show greyed. The picked spell shows highlighted. Clicking a spell picks it; clicking one above the player's level prints its refusal in the chat and sends nothing.

## 7. The combat spell's migration

One migration adds the picked combat spell's column with a default of "", so every existing save loads with none picked and no row needs converting.


## 8. Air, water and earth effects

A landed cast applies its effect to the enemy it hits, including elites and docile creatures. Each element has its own timer. A repeat cast restarts that element's effect at full length. A surge replaces a dart, and a dart refreshes a running surge at surge strength.

- Air lowers the enemy's Accuracy by 5 points for a dart or 10 for a surge, for 20 ticks. The enemy's chance to hit still has a 5% floor. The label above the enemy reads **Weakened**.
- Water delays the enemy's next swing by 4 ticks for a dart or 8 for a surge. On each cast, the delay starts at the later of the cast tick and the tick the enemy could swing without water. A recast keeps the stronger running delay, and the delays never add together. The label reads **Slowed** while the delay runs.
- Earth holds the enemy for 6 ticks for a dart or 12 for a surge. It stops every step, whether the enemy would wander, chase or return home. The enemy still attacks a player in reach. The label reads **Held**.

Effects clear on death or when the enemy reaches home after leashing. The labels reflect the server's state, and several labels can appear together.

## 9. Utility spells

Three utility spells list after the combat spells on the Spellbook tab, in gate order, each with its Magic gate, runes and what it does (#319). They cast with any weapon in hand, a sword, a bow, a staff or bare hands.

| Spell | Magic gate | Runes per cast | Experience | What it does |
| --- | --- | --- | --- | --- |
| Village teleport | 12 | 3 air, 1 fury | 15 | Moves the caster to the village square |
| Coin-turn | 20 | 3 fire, 1 focus | 10 | Turns one item into the store's price in coins |
| Hollow teleport | 28 | 3 earth, 1 air, 1 fury | 25 | Moves the caster just inside Runestone Hollow's gap, beside Hollis |

Spells above the player's Magic level show greyed. Clicking one casts it, and the server decides the outcome on the next tick. A cast spends its runes, pays its experience to Magic and replaces the player's current action, as a click does. Casting is refused during an Agility crossing, like other clicks.

Village teleport lands on the respawn tile, which stands in the village square beside the pedlar, at (18,42) on today's region. Hollow teleport lands on the tile west of Hollis, between them and the gap at x 95, at (96,42). The build picked both, as #325 left them to it. The figure appears on the landing tile at once and rises from the ground, as it does on a respawn.

Coin-turn asks for an item: the player clicks the spell, which shows pressed and says "Choose an item to turn into coins.", then clicks an inventory slot. One item leaves that slot (one from a stack), and the general store's buy price for it goes into the inventory's coins, 40% of its value as a sale would pay. Clicking the spell again, or Cancel on a slot's menu, stops asking. An open store or bank gets the slots back afterwards.

Every refusal says why in the chat and spends nothing:

- Below the gate: "You need Magic level 12 to cast Village teleport."
- Without the runes: "You don't have the runes to cast Village teleport."
- Hollow teleport before Hollis's quest is done: "You must finish Hollis's quest to cast Hollow teleport."
- A teleport while the combat lock runs (34 ticks after a hit): "You can't teleport until 10 seconds after a fight." Coin-turn moves nobody, so the lock does not refuse it.
- Coin-turn on anything the store does not buy: today only coins, with the store's own line, "The store doesn't buy coins."
- Coin-turn on a quest item (the copper, iron and emberite proof essences, the Hollow essence and the bone sigil): "Coin-turn can't turn a quest item."
- Coin-turn whose turned item is one of the runes the cast needs, leaving too few: the runes line.
- Coin-turn with no room for the coins, when one from a stack leaves no free slot and no coins are held: "You don't have room for the coins."

A teleport sends a `teleported` event after the patch that moves the player, so the client shows the landing instead of a walk across the region. The intent's payload is the spell and, for Coin-turn, the inventory slot; anything else is dropped.

