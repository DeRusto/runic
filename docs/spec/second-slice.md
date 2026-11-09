# Runic: second slice

**Status: reviewed.** Terms are defined in `GLOSSARY.md`. Decisions come from the closed tickets on the [map](https://github.com/DeRusto/runic/issues/36) and from `docs/adr/`. Rules no ticket decided are marked **[Qn]** (ruled on in review, §13) or **[Dn]** (a default accepted in review, §14).

This spec describes only what changes. Everything else in the [first playable slice spec](first-playable-slice.md) still holds, and where the two disagree this one wins (§12 lists what was replaced). Its section numbers are kept here so the two read side by side, and "first-slice D2" means its default D2.

All timers are whole **ticks** of 300 ms. Numbers were checked in a throwaway simulation, but nobody has played them, so they are first values to tune in the playtest.

## 1. What the slice is

It gives players something to work toward. They mine ore, smelt bars, smith a sword and a shield, equip them, and beat a harder enemy, whose Emberbones unlock the top tier of gear. It is still for invited friends on one server process.

**The hard rule: existing progress survives.** Friends keep their experience, inventory and tile through the upgrade (§6).

Done means §10 passes on `runicrpg.com`.

Out of scope: trading; dropping items on the ground and picking them up; a bank; death penalties; player-versus-player combat; quests, and non-player characters other than the Blacksmith; sound; going public (email, self-serve password resets, sign-up abuse protection, anti-cheat, chat filtering); more than one server process; moving between regions.

This spec records the slice as built. Phase 3 later replaced Discard with Drop everywhere it appears below (the intent, the right-click menu and the §10 checks), and added ground items, pickup and drop on death; see [Map: Phase 3](https://github.com/DeRusto/runic/issues/83).

## 2. A session

1. A returning friend appears on their saved tile with everything they had, plus Mining, Smithing and Blocking at level 1. A new friend starts as before.
2. They click the **Blacksmith** in the **Smithy** and get a **pickaxe** and a **hammer**, which go in their **Toolbelt**.
3. They walk about 10 s to a Copper **vein** and mine ore. They carry it back and smelt it at the **furnace**, then smith a sword and a shield at the **anvil**.
4. They open the **character sheet** with `C` and equip both. Spiders now die faster, and the sword and shield show in hand during a fight.
5. At levels 10 and 20 they repeat the loop with Iron, then Emberite. Iron veins are farther out.
6. To reach the Emberite veins they cross the **Boneyard**, where **Skeletons** attack anyone who comes near. Killed Skeletons may give an **Emberbone**, which the Emberite rows at the anvil also need.

## 3. The region

- Still one region in one room, now about 96×64 tiles. The new columns go on the east side, so every saved tile keeps its meaning. The draft may go wider if the Boneyard needs it.
- New grid characters:

| Char | Tile | Blocks |
|---|---|---|
| `a` | ashen ground | |
| `A` | tree on ashen ground | yes |
| `K` | Skeleton home on ashen ground | |
| `c` / `i` | Copper / Iron vein on grass | yes |
| `e` | Emberite vein on ashen ground | yes |
| `F` | furnace on grass | yes |
| `N` | anvil on grass | yes |
| `B` | Blacksmith on grass | yes |

- **Smithy:** the furnace, anvil and Blacksmith stand together at the village's edge.
- **Veins get farther away with each tier:** about 10 s from the Smithy for Copper, about 25 s for Iron (in the old region, past the thicket or field), and about 45 s for Emberite (a pocket behind the Boneyard). A straight tile takes 0.6 s.
- **Boneyard:** a tree line with one gap surrounds it. The road that stops at about x=48 extends to the gap, and the old region's east wall gets an opening. The only route to the Emberite veins is through the Boneyard.
- **Reach rule:** a Skeleton's reach is home + wander + notice range + leash, which comes to 10 tiles. It must never touch the village, Smithy, thicket, Spider field or any vein, so mining is always safe once a player gets there. This matters because a player who is mining doesn't fight back.
- **Old region:** it changes only where something new goes: Copper and Iron veins, the Smithy, the road and the wall's opening. Anyone saved on a tile that now blocks goes to the respawn tile at login, which the code already does.
- The spec sets rules rather than drawing the grid. The owner walks the first draft and accepts it, and plans to revamp the layout later.

**Fit, worked through.** The farthest Spider home is at about x=58 and wanders 5 tiles, so Skeleton homes must start at about x=74. Emberite veins must be more than 10 tiles past every home, and the east ring is at x=95. So 6 homes in columns 74 to 80 and veins in columns 91 to 94 only just fit, and they land about 42 s from a Smithy near x=22, on target.

**Region test (Vitest), replacing the old counts:** the new size; only known characters; one `R`, 12 `b`, 6 `h`, 8 `S`, 6 `c`, 4 `i`, 3 `e`, 6 `K`, one each of `F`, `N` and `B`; the outer ring all blocks; every enemy home, and a tile next to every bush, vein, station and the Blacksmith, reachable from `R`. Two new checks:

- **Reach:** every `K` is more than 10 tiles (`tilesApart`) from `R`, every thicket tile, bush, vein, `F`, `N` and `B`, and more than 15 from every `S`, allowing for the Spider's wander.
- **Only route:** with ashen ground treated as blocked, no `e` can be reached from `R`.

The counts live only in this test.

## 4. Simulation rules

### Intents and actions

- New intents: mine a vein, make an item (`{ item, all }`), visit the Blacksmith, equip a slot, take off a gear slot, discard a slot, and pin or unpin a skill. Each comes off the network, so anything invalid is ignored.
- A player's action can now also be mining or smithing. Smithing covers both the furnace and the anvil.
- Mining, making and visiting the Blacksmith are clicks that replace the action. Equipping, taking off, discarding and pinning don't replace it, the same as eating and chat.

### Inventory

- A slot holds up to 20 of one material or food, and each item stacks separately. Gear takes a whole slot each.
- A new item tops up the first stack of that item with room, then takes the first empty slot. **Full** means no room in a matching stack and no empty slot. This also replaces the bush refusal's "no empty slot" check.
- **Discard** destroys the whole slot, including a stack of 20. It works at any time, including mid-fight, and doesn't interrupt the action. Tools can't be discarded, and worn gear must be taken off first. Phase 3 replaced Discard with Drop, which puts the slot on the ground as a ground item instead ([Drop puts items on the ground](https://github.com/DeRusto/runic/issues/117)).

### Food and the healing pool

- One click eats one food from the stack. The 4-tick wait between meals and the 4 ticks added to the next swing stay.
- Eating adds the food's healing ticks to the **healing pool**. A berry gives 1 health per healing tick and a herb gives 2, each for 4 healing ticks (4 and 8 in all). A healing tick is every 4th world tick **[D1]**, so a meal lasts about 4.8 s. Regeneration runs alongside it, and the combat lock doesn't pause the pool.
- Food eaten while healing waits its turn: foods run in eating order, one food's ticks at a time, so more food heals for longer but not faster.
- A heal that would pass max health gives only what fits. At full health, whatever remains in the pool is lost. Eating at full health is still allowed, heals nothing and uses the food.
- Death empties the pool. It isn't saved, so logging out or a server restart loses it.

### Mining

- It works like foraging, using the same formulas and the same rules for a player-owned timer, first attempt on arrival, and failures.
- **One click, one ore [Q1]:** trying stops when an attempt succeeds, the vein runs out, the inventory is full or the player clicks something else.
- A click is refused if the player has no pickaxe, the Mining level is too low, the vein has run out or there's no room for that ore. The client prints a line in the chat box saying why, and the server ignores the click.
- Only a success gives ore and experience. Ore goes straight into the inventory. A vein doesn't grow back until it runs out, and veins are shared between players.
- Vein state isn't saved, the same as bushes **[D2]**.

### Making

- Clicking a furnace or anvil walks the player next to it, replacing the action as any walking click does, and the Smithing panel opens on arrival (§7). If they're already next to it, it opens at once and the action carries on. Clicking anything else before arrival cancels the panel, and so does dying. Clicking an anvil with no hammer is refused at the click, with no walk and a chat-box line pointing to the Blacksmith. The furnace needs no tool.
- Picking **Make 1** or **Make all** sends one intent, which walks the player next to the station and starts work.
- **The wait:** each item takes N ticks from arrival. Materials leave and the item and experience arrive together, at the end of the wait, so stopping early costs only the progress on that item. Any new choice, including the same item, replaces the action and starts the wait over.
- **What ends it:** running out of materials, having no room for the item, finishing a Make 1, or clicking something else. Eating, chat and discarding don't interrupt it. Running out or having no room prints one chat-box line.
- **Checks:** the server checks level and materials on arrival and before each item. Room is checked after the materials are taken, so the last ore in a full inventory can still become a bar.
- Making always succeeds. Stations never run out, and any number of players can share one with no queue.
- Make all can fill an inventory with unwanted swords, which is accepted because discarding clears them.

### Tools and the Blacksmith

- Clicking the Blacksmith walks the player next to them and gives any tools the player lacks, free, with a chat-box line. A player with every tool gets a line saying so **[D3]**.
- Tools live in the Toolbelt, take no inventory slot, have no limit and are never lost.

### Gear

- Equipping moves gear from the inventory to its gear slot, freeing the slot. If one is already worn, the two trade places, so swapping always works.
- Equipping gear above the player's level is refused with a chat-box line, and so is taking off gear with no empty slot.
- Gear can be changed at any time, including mid-fight, and doesn't touch the swing timer **[D4]**. Gear never wears out. Phase 3 drops worn gear on death, with the inventory, as ground items on the tile where the player died; only the Toolbelt is kept ([Drop on death](https://github.com/DeRusto/runic/issues/119)).
- **Sword:** adds its bonus to both minimum and maximum hit.
- **Shield:** an enemy swing rolls to hit using Defense, as today. If it hits and a shield is worn, it then rolls to **block**, and a block does 0 damage. See §5 for the chance and experience. It works against every enemy.

### Fighting back

This replaces the first slice's "nothing retargets by itself".

- An idle player who gets swung at by any enemy, Spiders included, starts fighting that enemy. Their first reply comes 4 ticks after the enemy's swing, or later if their swing timer says so (first-slice D2).
- A player who is walking, gathering or making carries on until they click.
- A dropped player doesn't fight back, following first-slice D9 **[D5]**.

### Skeletons

Wandering, walking speed, return after dying, experience rules, shared fights and targeting whoever swung most recently are all as a Spider. Only the following differ:

- **Noticing:** an idle Skeleton goes for a live, connected player within its notice range, measured in `tilesApart` whether or not trees stand between them **[D6]**. It takes the nearest, with ties broken by the order players are checked **[D6]**. It won't pick a player another Skeleton is already after. There is no level gate.
- **First swing:** 4 ticks after noticing or as soon as it gets next to the player, whichever is later, and never before its own swing timer **[D7]**. Noticing alone doesn't set the combat lock, because only a swing does.
- **Leash:** counted from the tile where it noticed the player, because a chase may never reach a first swing. Being hit while chasing doesn't move that tile.
- **Giving up:** it walks home and recovers, ignoring players on the way, though they can still attack it. It walks at player speed, so walking away always works.
- A player who hits a second Skeleton can still end up fighting both.

### Emberbones

- When a Skeleton dies, each player who damaged it since it last recovered or returned rolls their own chance. A swing that missed doesn't count. Dead players count, and players who have left the room don't **[D8]**.
- A won Emberbone lands on the ground under the Skeleton as a ground item owned by the winner, with a chat-box line **[D8]**. Only the winner can see it for the first minute (200 ticks), then everyone can, and it vanishes at 3 minutes (600 ticks). A full inventory no longer loses it ([Loot on the ground](https://github.com/DeRusto/runic/issues/120)).
- Spiders still give nothing.

### Unchanged rules worth repeating

Next to, pathfinding, the combat lock, respawning, disconnects, duplicate logins and chat all work as in the first slice.

## 5. Numbers

**Skills.** The experience curve doesn't change. Mining, Smithing and Blocking start at 0 experience, level 1.

Pacing targets for the full loop of mining, smelting and smithing, as simulated: level 10 in about 1 h, level 20 in about 3 h, level 99 in 50 to 60 h. A first full Emberite set is a rough estimate of 6 to 8 h of play, not simulated. These targets predate smelting giving Mining experience: they have not been re-simulated, and Mining now levels faster than they assumed.

| Skill | Experience |
|---|---|
| Mining | Per ore, by tier (below), plus each bar's experience when it is smelted |
| Smithing | Per item made, by tier (below) |
| Blocking | 40 per block |
| Defense | 6 per enemy swing at you, landed or missed or blocked, plus 4 per damage taken |
| Combat, Hitpoints | As before: 6 per damage dealt, with no experience for overkill |

**Tiers and veins**

| Tier | Level gate | Veins | Ore per vein | Grows back after | Experience per ore |
|---|---|---|---|---|---|
| Copper | 1 | 6 | 3 | 400 ticks | 10 |
| Iron | 10 | 4 | 3 | 500 ticks | 30 |
| Emberite | 20 | 3 | 3 | 600 ticks | 60 |

A tier's gate applies to mining its ore (Mining), smelting and smithing it (Smithing), wielding its sword (Combat) and using its shield (Defense). Blocking never gates a shield.

Attempts: one every 8 ticks, one fewer per 15 levels, down to 4 (`pickIntervalTicks`). Chance: 50% at the tier's gate, plus 2 points per Mining level above it, capped at 100%.

**Making**

A bar's experience goes to Smithing and the same amount to Mining. Swords and shields give only Smithing. Experience arrives at the end of the wait, with the item.

| Tier | Bar: 1 ore, 6 ticks (in Smithing and in Mining) | Sword: 3 bars, 12 ticks | Shield: 4 bars, 16 ticks |
|---|---|---|---|
| Copper | 4 experience | 18 | 24 |
| Iron | 12 | 54 | 72 |
| Emberite | 24 | 108, plus 2 Emberbones | 144, plus 3 Emberbones |

**Gear**

| Tier | Sword adds to min and max hit | Shield's base block chance |
|---|---|---|
| Copper | 1 | 10% |
| Iron | 2 | 20% |
| Emberite | 3 | 30% |

- Damage on a hit: (1 + bonus)..(2 + floor(Combat / 20) + bonus).
- Block chance: the shield's base, plus 0.2 points per Blocking level above 1.

**Skeleton**

| Stat | Value |
|---|---|
| Health | 24 |
| Hit chance | 55%, minus 0.3 points per Defense level above 1 |
| Damage on a hit | 1..5 |
| Swing | Every 8 ticks |
| Returns after dying | 200 ticks |
| Wanders | Up to 3 tiles from home |
| Notices players within | 3 tiles |
| Leash | 4 tiles, from where it noticed the player |
| Emberbone chance | 1 in 4, per player who damaged it |

**Everything else:** a stack holds 20; a healing tick every 4 ticks, with a berry giving 1 and a herb 2 for 4 healing ticks; 6 Skeletons; one furnace and one anvil; 6 pinned skills at most.

All of these live in `shared/` as named constants, apart from the counts (region test only).

## 6. Server

**One table per kind of thing, in `shared/`** so the client's refusals and panel rows match the server's rules.

- `ITEMS`: every item's id and how much it stacks. **`berry` and `herb` keep their ids**, because existing saves hold them.
- `RECIPES`: each item's station, level, costs, ticks and experience.
- `VEINS` and `ENEMIES`: replace the Spider-only constants.

**Each tick, in order.** The first slice's order holds, with these added:

- Mining attempts and making progress run next to the pick attempts.
- Noticing, fight-back and Emberbone rolls run with the swings that cause them.
- The healing pool runs with the other timers.

**Synced state**

- Each player adds: Mining, Smithing and Blocking experience, stack counts, weapon, shield, tools and pinned skills.
- `spiders` becomes `enemies`, each with a `kind`, and the target intent's payload becomes an enemy's id.
- Each vein: ore left, the same as a bush.

**Events.** Every chat-box line that only the server can decide travels as an event for that player, and the client prints it if it's theirs.

| Event | Fields | Notes |
|---|---|---|
| `playerSwing`, `enemySwing` | As today, plus `blocked` on `enemySwing` | `damage: 0` alone still means a miss |
| `mine` | player, success | As `pick` |
| `make` | player, station, ticks | One at the start of each item's wait; `ticks` is N, so viewers can fit the clip to it |
| `enemyDied`, `enemyReturned` | enemy | Renamed from the Spider events |
| `told` | player, line | Tools given, Emberbone won, making stopped |
| `healed` | player, amount | One for each healing tick that restores health; `amount` is what it actually restored. Regeneration sends none |

`eaten` drops its `healed` field, because food no longer heals at once.

**Database.** One new migration on `players`. Every new column has a default, so existing rows need no conversion and keep working **[D9]**.

| Column | Type | Default |
|---|---|---|
| `mining_xp`, `smithing_xp`, `blocking_xp` | integer | `0` |
| `inventory_counts` | JSON array, parallel to `inventory` | `[]` |
| `weapon`, `shield` | text | `""` |
| `tools` | JSON array | `[]` |
| `pinned_skills` | JSON array | Combat, Defense, Foraging, Hitpoints, Mining, Smithing |

- `inventory` keeps its shape, 30 item names.
- A filled slot with no count is a stack of 1. That is what every existing save's food becomes, where it sits, with no merging. New food tops up the first stack of that food.
- Existing migration behaviour applies: the database is copied to `pre-migration` before anything runs.

**Saving.** Everything above is saved at the usual moments. Not saved: the healing pool, vein state, Skeleton state and who damaged what.

## 7. Client

### Clicks

The ray tests live enemies, bushes, veins, stations and the Blacksmith, then falls through to the ground plane. Each gets a hit box, as bushes and Spiders do today.

### Bottom bar

- Slots show a stack's count at bottom-right, white with a dark outline, only above 1.
- Left-click stays the main action: eat food or equip gear, and materials do nothing.
- Right-click opens a small menu: Eat and Discard on food, Equip and Discard on gear, only Discard on materials. Materials must still catch a right-click, so their slots can't be `disabled` buttons as empty ones are today.
- The skills column shows pinned skills only, two across and three down, in the sheet's order. With nothing pinned it shows "Pin skills from the sheet".
- A **Character** button shows small icons of the worn gear.
- **Holding results:** the bar holds a pick's result until the clip shows it, and it detects a pick by counting filled slots. Stacks, gear and making all break that count, so it must key off the `pick` and `mine` events instead.
- **Narrow windows:** the bar needs at least 800 px, because at 665 px its right end is cut off. Below 800 px the client shows one line asking for a wider window, and doesn't try a narrow layout **[D10]**.

### Character sheet

- A floating window above the right end of the bar, in the brown panel art from Kenney's UI Pack - Adventure. The bar itself stays flat **[D11]**.
- The Character button and `C` toggle it, and `Esc` and its close button shut it. Typing in chat never does. It reopens on the tab last used.
- One size on both tabs, about 340×400, shrinking only to fit a very short window. The title and tabs stay put and the content scrolls beneath them, with the scrollbar's space always reserved. Each tab keeps its own scroll position, and pinning doesn't move the list.
- **Gear tab:** weapon and shield slots side by side, each with the item's name and what it does, or "Empty". Below them, the Toolbelt is a grid of tool icons with name tooltips. Tools have no right-click menu.
- **Gear slot clicks:** left-click takes the gear off, and right-click offers Take off.
- **Skills tab:** every skill with its level, progress bar and pin. At six pins the other pins are disabled.
- **Pinning:** the bar follows the sheet's order, not the order of pinning. Today's skills start pinned, including Mining and Smithing, and any later skill starts unpinned, so Blocking waits for a free pin.

The prototype to copy from is [`client/prototype-sheet`](https://github.com/DeRusto/runic/tree/prototype/character-sheet-and-bar/client/prototype-sheet), variant D, on a throwaway branch.

### Smithing panel

- One row per item: three at the furnace, six at the anvil. Each row has the item's name, its cost, how many of those materials the player has, the level it needs, and **Make 1** and **Make all**.
- Every row always shows. One that can't be made yet is greyed out with the reason on it, such as "Needs Smithing 10", and its buttons do nothing.
- It opens only with the player next to the station (§4), and never later by surprise once something else has been clicked.
- It stays open after a pick, and its rows follow the player's inventory and levels as items get made. A second pick replaces the action, as any new choice does.
- It closes when the player presses `Esc`, clicks its X, clicks anywhere else or dies. A click in the world still does what it normally does.
- It uses the sheet's panel art and close X, sits above the left end of the bar, clear of the world's centre, and its rows scroll inside it **[D12]**. Rows carry no icons **[D12]**.

### How gear shows

- The sword parents to `handslotr` and the shield to `handslotl`, with no offset. Gear shows **only in a fight**, so an idle or walking player looks as they do today.
- Tools show in the hand during the action: the pickaxe when mining, the hammer at the anvil.

| Tier | Sword | Shield | Tint | Glow |
|---|---|---|---|---|
| Copper | `sword_A` | `shield_A` | `#f0935a` | none |
| Iron | `sword_B` | `shield_B` | `#d5dde4` | none |
| Emberite | `sword_C` | `shield_C` | `#7a2a22` | `#ff4a10` at 0.15 |

Tints go over a greyscale copy of the pack's atlas, because multiplying over the original turns the blue blades navy. The prototype to copy from is [`client/prototype-gear`](https://github.com/DeRusto/runic/tree/prototype/gear-look-and-swing/client/prototype-gear).

### Clips

| Moment | Clip | Contact |
|---|---|---|
| Armed swing | `Melee_1H_Attack_Chop` (1067 ms) | 580 ms |
| Armed swing | `Melee_1H_Attack_Slice_Diagonal` (1000 ms) | 420 ms |
| Armed swing | `Melee_1H_Attack_Stab` (1600 ms) | 380 ms |
| Unarmed swing | `Melee_Unarmed_Attack_Punch_A`, as today | 550 ms |
| Between swings, holding anything | `Melee_Blocking` **[D13]** | |
| Between swings, holding nothing | `Melee_Unarmed_Idle`, as today | |
| Blocked hit | `Melee_Block_Hit`, and "Blocked" where the damage number goes, with no chat-box line | |
| Mining | `Pickaxing` once per attempt, sped up to fit, showing its result at 0.4 of the clip as `PickUp` does **[D14]** | |
| Anvil | `Hammering` with the hammer in hand, once per item, sped up to fit N | |
| Furnace | `Working_A` with empty hands, once per item, sped up to fit N | |

- **Which swing:** each viewer picks from a hash of the swinger's id and the tick, so every viewer sees the same clip with no new data sent, and it looks random **[D15]**.
- **Sword or shield alone:** swings follow the weapon, so a shield with no sword punches **[D13]**.
- **Making:** the player faces the station. Other players see the clip too. The item shows in its slot at the end of the wait, with experience shown the way foraging shows it. There is no progress bar and no chat-box line per item.
- **Eating:** the `Use_Item` clip stays, with no number of its own. Each `healed` event shows every viewer a green "+N" over that player, where damage numbers show. Regeneration shows no number.
- **Skeleton:** `Skeleton_Warrior` with `Skeleton_Blade` in hand, about as tall as a player, using the players' armed swings, stance and contact moments. Otherwise it uses the players' clips for standing, moving, being hit, dying and returning **[D16]**.

### Assets

All new files are committed under `client/`, with a licence copy beside them. The repo is public, so confirm each licence before committing.

| Thing | Source | Licence checked |
|---|---|---|
| Swords, shields | KayKit Fantasy Weapons Bits 1.0 | CC0 |
| Pickaxe, hammer, anvil | KayKit RPG Tools Bits 1.0 | CC0 |
| Skeleton and blade | KayKit Skeletons 1.1 | CC0 |
| `Rig_Medium_Tools.glb` (1.4 MB) | KayKit Character Animations 1.1 | CC0 |
| Furnace | KayKit Medieval Hexagon Pack `building_blacksmith_red`, a stand-in; it replaced Kenney Hexagon Kit `building-smelter`, as §15's fallback **[D17]** | CC0 |
| Blacksmith | KayKit Adventurers `Ranger` (473 KB), hammer in hand, `Idle_A`, a nameplate reading "Blacksmith" **[D18]** | CC0 |
| Veins | Our committed rock models tinted by tier (linear multipliers: Copper `#ff8a3c` x 1.8, Iron `#4f8fd8` x 2.4, Emberite `#d42a1a` x 1.6), shrunk and greyed when run out as bushes are **[D19]** | CC0 |
| Sheet and panel art | Kenney UI Pack - Adventure | CC0 |
| Ashen ground | A new ground colour, no art | |

This adds a little over 2 MB to the first download (mostly the Tools clips, the Skeleton and the Ranger), on top of today's 4.2 MB of models.

**Icons [Q2].** 17 icons. 16 are rendered once from CC0 3D models by a small dev-only page and committed as PNGs (about 200 KB), the same way the Spider was converted once (ADR 0003). There's no new dependency, and a model or tint change needs a manual re-run. Sources and treatments are in [Where the item icons come from](https://github.com/DeRusto/runic/issues/49). The owner will revisit the icons later, so none is a final choice.

The Emberite sword is the exception: a Craftpix file, so the icons aren't all CC0. The Craftpix terms allow use in projects but bar direct redistribution, and they don't mention public repositories. The owner has ruled that committing it to this repo is fine. The licence copy beside the icons must say which file is Craftpix's and under what terms.

| Item | Starting point |
|---|---|
| Ore, bars | KayKit Resource Bits `*_Nuggets` and `*_Bar`; Emberite is Iron tinted with its colours |
| Copper and Iron swords, all shields | The models and tints above |
| Emberite sword | `sword-rpg-game-icon-set/PNG/without background/21.png`, scaled to match, not rendered |
| Pickaxe, hammer | KayKit RPG Tools Bits |
| Berry, herb | Kenney Food Kit `grapes`, Quaternius Stylized Nature `Plant_1` **[D20]** |
| Emberbone | About 8 lines of three.js geometry, tinted as Emberite |

## 8. Repo and toolchain

No change.

## 9. Hosting

No change. The usual Deploy applies the migration, and every client reloads when the build version changes.

## 10. Done means

Each build ticket has its own tests. The slice as a whole is done when, on `runicrpg.com`:

1. A friend from the first slice logs in with their experience, inventory and tile intact, and their food as stacks of 1 in the same slots. A restored backup does the same.
2. A player mines, and is refused without a pickaxe. The Blacksmith gives them one, and a hammer.
3. A player gets from ore to a worn Copper sword and shield, using both Make 1 and Make all, and sees all three swing clips and the stance in a fight.
4. Rows above the player's level are greyed with the reason, and so is gear they can't wear yet.
5. Stacks hold 20, a full inventory refuses ore, and discarding clears a slot.
6. Food heals gradually with a green number on each healing tick, the pool stops at full health, and death empties it.
7. A player with a shield sees "Blocked", and Blocking rises.
8. An idle player swung at by a Spider or a Skeleton fights back. A walking one carries on.
9. A Skeleton goes for a player in range, gives up at the leash and walks home, and can always be walked away from.
10. Two players who both damaged a Skeleton each get their own chance at an Emberbone. A won Emberbone lands on the ground, seen only by its winner for the first 200 ticks, then by everyone, and gone at 600 ticks.
11. A player makes and wears Emberite gear.
12. Pins survive logging out and work on another device.
13. Experience, stacks, gear, tools and pins survive logout and a Deploy.
14. The owner has walked the region and accepted the layout.

**Unit tests must cover:** the stacking rules; the existing-save load; the healing pool; mining attempts and regrowth; making's wait, restart, ending and room check; equip, swap and take-off refusals; hit bonuses; the block roll and its experience; fight-back timing; noticing, the leash from the notice tile and giving up; Emberbone rolls; pin limits; and the region test.

## 11. Suggested build tickets

Each is a thin working slice that builds on those above it.

| # | Ticket | Delivers | Needs |
|---|---|---|---|
| 1 | Enemy table | `spiders` becomes `enemies` with a `kind`, with no change in behaviour | |
| 2 | Stacks and the migration | The new columns, stack counts, existing-save test, Discard and the right-click menu, stack rules on bushes | |
| 3 | Healing pool | Food heals over time | 2 |
| 4 | Item icons | The render page, committed PNGs, icons in slots | 2 |
| 5 | Bigger region | New grid, characters, ashen ground, region test, stations, veins and Blacksmith on show but not yet working | |
| 6 | Character sheet and pins | Sheet, Skills tab, pins saved on the server, the bar's pinned skills, minimum width | 2 |
| 7 | Tools | Blacksmith, Toolbelt on the Gear tab | 5, 6 |
| 8 | Mining | Veins, attempts, regrowth, the clip with the pickaxe in hand, and fixing the bar's result holding | 2, 4, 7 |
| 9 | Making | Smithing panel, furnace, anvil, recipes, clips | 8 |
| 10 | Swords and showing gear | Gear slots, hit bonuses, gear in hand, three swing clips, stance | 6, 9 |
| 11 | Shields and Blocking | Block roll, the new skill, "Blocked" | 10 |
| 12 | Fighting back | Idle players reply, Spiders included | 1 |
| 13 | Skeletons | Model, noticing, leash from the notice tile | 5, 10, 12 |
| 14 | Emberbones | The rolls, lines and Emberite rows | 9, 13 |
| 15 | Layout and playtest | Final region, pacing check against targets, tune numbers | 11, 14 |

## 12. What later decisions replaced

| Earlier | Now | By |
|---|---|---|
| One 64×64 region | About 96×64 | [Where the harder content lives](https://github.com/DeRusto/runic/issues/41) |
| Four skills | Seven | [What the gear loop is](https://github.com/DeRusto/runic/issues/37), [The second slice's numbers](https://github.com/DeRusto/runic/issues/43) |
| One item per slot; eating is the only way to free a slot | Stacks of 20; Discard | [Carrying and storing items](https://github.com/DeRusto/runic/issues/42) |
| Food heals at once, with a green number | The healing pool, with a green number each healing tick | [Carrying and storing items](https://github.com/DeRusto/runic/issues/42) |
| Nothing retargets by itself | Idle players fight back | [What the harder enemy is](https://github.com/DeRusto/runic/issues/40) |
| An enemy only fights back | The Skeleton attacks first | [What the harder enemy is](https://github.com/DeRusto/runic/issues/40) |
| All skills on the bar | All on the sheet, up to six pinned on the bar | [The character sheet and bottom bar](https://github.com/DeRusto/runic/issues/46) |
| A shield lowers the enemy's hit chance ([What the gear loop is](https://github.com/DeRusto/runic/issues/37)) | A shield blocks hits that would have landed | [The second slice's numbers](https://github.com/DeRusto/runic/issues/43) |
| Weapons and equipment out of scope | Swords and shields | This map |
| "No CC0 furnace" and an untested anvil ([What art exists](https://github.com/DeRusto/runic/issues/38)) | A smelter stand-in, and the RPG Tools anvil, confirmed in the free pack | This spec's check of the packs |

## 13. Rulings from review

- **Q1. Mining per click.** [What the gear loop is](https://github.com/DeRusto/runic/issues/37) says mining "works like Foraging", where one success ends the action, but no ticket says so about mining directly. The other reading keeps mining until the vein runs out, at most 3 ore. *Ruling: one click, one ore, the same as foraging. The clicks only come to about 18 per trip, and it's a one-line change if the playtest disagrees.*
- **Q2. Icons.** [Where the item icons come from](https://github.com/DeRusto/runic/issues/49) left the choice to the owner: rendering once with committed PNGs, and what to do about the Emberite sword, whose render is a thin dark line at 36 px. `sword-rpg-game-icon-set/PNG/without background/21.png` stands out, but it doesn't match the tinted `sword_C` in hand, and it means the icons are no longer all CC0. *Ruling: render once, and take that one swap, because the top-tier reward shouldn't be the weakest icon.*

## 14. Accepted defaults

These filled small gaps and were accepted in review.

| | Default | Why |
|---|---|---|
| D1 | A healing tick is every 4th world tick, not 4 ticks after eating | Same as regeneration; needs no timer |
| D2 | Veins aren't saved | Same as bushes |
| D3 | A player with every tool gets a line from the Blacksmith | Silence reads as a bug (first-slice D6) |
| D4 | Changing gear doesn't touch the swing timer | Timers already stop it being abused |
| D5 | A dropped player doesn't fight back | First-slice D9: someone who's gone shouldn't keep fighting |
| D6 | Noticing ignores trees, takes the nearest player, ties broken by check order | Simplest; the reach rule keeps it away from everything else |
| D7 | The first swing is 4 ticks after noticing, or on arrival | The ticket says "first swing after 4", and a chase has no player swing to count from |
| D8 | Dead players still roll for Emberbones, leavers don't, and winning one prints a line | A player killed by the Skeleton they helped beat shouldn't lose out; a leaver has no inventory to fill; a rare reward deserves a line |
| D9 | Stack counts sit in a parallel column, with a missing count meaning 1 | Existing saves need no conversion, so the hard rule can't be broken by a bad data step |
| D10 | Below 800 px wide, one line asks for a wider window | Touch and small windows are already out of scope; 800 was checked and fits |
| D11 | The bar stays flat, and only the sheet and panel use the new art | The prototype's bar was flat, and whether the art fits it wasn't seen |
| D12 | The panel's place and art, and no icons on its rows | No ticket placed it, and the owner's playtest moved it off the world's centre; the ticket's row list has no icon |
| D13 | Holding only a sword, or only a shield, uses the `Melee_Blocking` stance; swings follow the weapon | One stance rule; neither case has been seen, so watch it in the build |
| D14 | `Pickaxing` is the mining clip | It matches the `Hammering` and `Working_A` already chosen from the same pack, by name; nobody has watched it |
| D15 | Swing clips come from a hash of id and tick | No new data, and everyone sees the same clip |
| D16 | Skeletons use the players' clips | They share the rig |
| D17 | `building_blacksmith_red` as the furnace, replacing `building-smelter` | `building-smelter` didn't read as a furnace at a tile's scale, so this is §15's first fallback |
| D18 | `Ranger` as the Blacksmith | A model no player has, so they read apart; the owner can swap it |
| D19 | Veins are tinted rock models, in their own tints rather than gear's | No new art, and in the playtest gear's tints left veins hard to tell from grey rock props |
| D20 | `grapes` and `Plant_1` as the food icons | The research's first picks; the owner will revisit the icons |

## 15. Check while building

Nobody has tested these. Each sits with the ticket that hits it first.

| Unknown | Ticket | If it fails |
|---|---|---|
| A 96×64 region stays smooth on a slower machine | 5 | Merge the ground by kind |
| Skeleton homes and the Emberite pocket fit, with reach 10, in 32 new columns | 5 | Widen the region, which the map allows |
| A player can't easily skip every Skeleton on the way through the gap; routes through the Boneyard weren't simulated | 15 | Narrow the gap or move the homes |
| `Pickaxing`, `Hammering`, `Working_A` and `Melee_Block_Hit` look right on our characters; none has been watched | 8, 9, 11 | Swap the clip; the pack has alternatives |
| `Melee_Blocking` looks right with only a sword or only a shield | 10 | Use `Melee_Unarmed_Idle` for that case |
| The three-clip mix reads well; the prototype played one clip at a time | 10 | Drop a clip |
| `Skeleton_Warrior` fits our shared clips, and the blade sits right in its hand; neither has been loaded in three.js | 13 | Fix the offset, or ship its own clip files |
| `building-smelter` reads as a furnace at the tile's scale; it is a whole building on a hex base | 5 | The KayKit blacksmith building, a campfire, or ask the owner to scout |
| The tints and the Emberite glow survive the real scene's lights | 10 | Retune them, as the prototype's values were starting points |
| Kenney's panel art fits next to the flat bar | 6 | Style the panel flat too |
| Combat and Hitpoints reach 99 well under the 50-hour target, as gear speeds them up; this is accepted as a reward for gear | 15 | Tune experience per damage |
| Several players on one enemy, several Skeletons on one player, and real sharing of veins; none was simulated | 15 | Tune the numbers |
| The second icon check: itch was still installing `boss-loot-vector-rpg-icons` and `skull-and-bone-rpg-icons` when the Craftpix packs were compared, and the [Runic asset catalogue](https://claude.ai/artifact/U3qryhUtNdd4GN88n6mr3e) doesn't list them | When icons are revisited | Keep the rendered icons |
