# Runic

A multiplayer online RPG for a small group of friends: a shared, persistent world on a tile grid, where players train skills.

## Language

### World

**Region**:
One contiguous, walkable piece of the world, made of tiles. The first playable slice has exactly one.
_Avoid_: Map, zone, level

**Village**:
The part of a region where players spawn and respawn, and gather to talk.
_Avoid_: Town, hub, spawn

**Thicket**:
The part of a region where bushes grow, and players pick berries and herbs to train Herblaw.
_Avoid_: Forest, woods

**Field**:
The part of a region where enemies roam.
_Avoid_: Wilderness, combat zone

**Boneyard**:
The field where Skeletons roam.
_Avoid_: Graveyard, dungeon

**Lake**:
The body of water in the region, where players fish from the bank. Water can't be walked on. It is one kind of water among those a region may hold, alongside a river or the sea.
_Avoid_: Pond, mere

**Smithy**:
The part of the village where the furnace, anvil, range, workbench and Blacksmith stand.
_Avoid_: Forge, workshop

**Bush**:
A site in a thicket that can be picked. Every bush belongs to a site pool: one that runs out disappears from its spot, and after a while a full bush comes back at another. Comes in five kinds: a **berry bush** anyone can pick, and the **herb**, **dewpetal**, **nightbloom** and **emberbloom** bushes that need a higher Herblaw level.
_Avoid_: Node, resource, plant

**Vein**:
A site that can be mined for ore. Every vein belongs to a site pool: one that runs out disappears from its spot, and after a while a full vein comes back at another. A vein is not a rock, which is a prop.
_Avoid_: Ore rock, node, resource

**Site pool**:
An area where a kind of site appears at some of its spots at a time; when one runs out, it comes back at another. The region's Copper, Iron and Emberite veins, its five kinds of bush, and the Lake's fishing spots each have one.
_Avoid_: Spawn area, zone

**Spot**:
One of the tiles in a site pool where a site can appear. With no site on it, a spot is its plain tile: ground that players can walk on, or water for a fishing spot.
_Avoid_: Spawn point, node

**Tree**:
A tile in the world that can be chopped for logs with an axe; it runs out after use, shows as a **stump** that still blocks walking, and grows back in the same place. Comes in three kinds: **Birch** (Woodcutting 1), **Oak** (10) and **Charwood** (20). Only trees placed as trees can be chopped; the rows of trees that wall the region are props.
_Avoid_: Choppable tree, node, resource

**Fishing spot**:
A site on the water at the edge of the bank, fished from the land beside it, that shows as rippling water. It sits on a spot of the shore's site pool, runs out after use, and comes back at another spot along the shore.
_Avoid_: Fishing pool, fishing hole, school

**Furnace**:
A small building in the smithy where a player turns ore into bars. Not a house.
_Avoid_: Smelter, forge

**Anvil**:
A fixed tile where a player turns bars into gear.
_Avoid_: Forge

**Range**:
A fixed tile in the smithy, beside the furnace, where a player cooks: a raw fish alone, or with a berry or a herb, becomes food. It can burn a fish, and a fish cooked well comes out Delicious.
_Avoid_: Stove, oven, cooker

**Fire**:
A cooking station a player lights with a tinderbox from one log, on the tile they stand on. It burns for a while that depends on the log — birch, oak or charwood — cooks like the range but burns a fish more, and is then simply gone, leaving nothing. It gives light, never blocks walking, and only one burns on a tile.
_Avoid_: Campfire, bonfire

**Workbench**:
A fixed tile in the smithy, between the range and the anvil, where a player crafts: leftovers and rare finds become the game's utilities, and a cape gains its reagent's gift (#225).
_Avoid_: Crafting table, work table

**Altar**:
A fixed tile out in the Boneyard's far side, an old stone circle ringed by rocks, where a player turns rune essence into runes (#232). It asks no level of its own, gives no tools, and never runs out; the walk there is the gate.
_Avoid_: Stone circle (that's its look), rune stone

**Station**:
A furnace, an anvil, a range, a workbench or an altar: a fixed place where a player makes something. It never runs out, and any number of players can share one. A fire is a station too, but the one a player places, and the only one that runs out. The Blacksmith is not a station.
_Avoid_: Workstation, crafting table

**Villager**:
A named person who stands on one tile and talks to players: most in the village, some at their work outside it, such as the Forester at the edge of the thicket. Each has one job they offer while talking. Never an enemy, and can't be attacked.
_Avoid_: NPC, townsfolk, character

**Blacksmith**:
Odo, the villager at the smithy, who gives players whichever of a pickaxe and a hammer they don't have, for free, when they ask in conversation, and whose copper-ore quest opens the smithy's furnace and anvil to them.
_Avoid_: Smith, vendor

**Conversation**:
A talk with a villager in the dialogue box above the bar: the villager's lines and the player's choices, which the server checks the player is still beside the villager to carry out. Walking away or being hit ends it, and a blocked hit counts.
_Avoid_: Chat (that is the chat box), dialog

**Forester**:
Bram, the villager at the edge of the thicket, near the village, who gives players an axe and a tinderbox if they don't have them, for free, when they ask in conversation.
_Avoid_: Woodcutter (too close to Woodcutting, the skill), woodsman

**Fisher**:
Tamsin, the villager on the Lake's bank where the path reaches it, who gives players a fishing rod if they don't have one, for free, when they ask in conversation.
_Avoid_: Fisherman, angler

**Storekeeper**:
Marta, the villager who runs the general store.
_Avoid_: Shopkeeper, merchant, vendor

**Banker**:
Aldous, the villager who runs the bank.
_Avoid_: Teller, clerk

**General store**:
The one store in the village. It buys any item but coins from a player and sells what is on its shelf.
_Avoid_: Shop, market

**Shelf**:
What the general store has for sale, the same for every player: its own stock, which refills over time, and the items players have sold to it, which run down over time.
_Avoid_: Stock list, inventory

**Bank**:
Where a player keeps items they aren't carrying, opened through the banker. Each player has their own 96 slots, kept for good. A slot holds one piece of gear, or any number of one material, food or coins.
_Avoid_: Vault, storage, chest

**Value**:
What an item costs at the general store, in coins. The store pays less than an item's value when it buys, but never less than 1 coin for one item, unless the item is trash.
_Avoid_: Price, worth

**Trash**:
An item with a value of 0. The general store takes it but pays nothing for it.
_Avoid_: Junk, vendor trash

**Counter**:
The part of the general store's window where a player sets out a trade: what they will buy from the shelf, what they will sell from their inventory, and the coins each way. Nothing changes hands until the player makes the deal.
_Avoid_: Cart, basket, trade window

**Tray**:
One of the counter's two lists: what the player will buy from the shelf, or what they will sell from their inventory. Each line is an item and a count, which the player can take back before the deal.
_Avoid_: Cart, basket, offer

**Deal**:
Settling both trays at once with the store window's Deal button: sales first, so their coins pay for the buys. The server refuses it, and nothing changes hands, if the player can't pay, has no room, or the shelf no longer has enough of what they buy.
_Avoid_: Purchase, transaction, checkout

**Prop**:
A fixed piece of scenery on a tile that players can't interact with, such as a rock or a tree in the rows that wall the region. Some block walking and some don't. A bush, a vein and a tree that can be chopped are not props.
_Avoid_: Decoration, doodad, object

**House**:
A building in the village, drawn from the tiles it stands on. It blocks walking and players can't go inside.
_Avoid_: Building, home

**Enemy**:
A creature in a field that players fight to train Combat.
_Avoid_: Mob, monster, NPC

**Spider**:
The weaker enemy: a large spider that fights back only when attacked, unlike a Skeleton.
_Avoid_: Thornback (its old name)

**Skeleton**:
The harder enemy: an armed skeleton that attacks players who come near, unlike a Spider. It is the only source of Emberbones.
_Avoid_: Undead, boss

**Docile creature**:
An enemy that never fights back, never chases and never wanders: it stands where it starts while it is hit. The three hide bands' creatures are — the Tarn Ox, the Bristleback and the Cinderhorn — and each leaves its hide with every player who damaged it.
_Avoid_: Passive mob, harmless enemy

**Tarn Ox**:
The docile creature that grazes by the Lake's shore, the hide band 1's: its tarn hide works into the Copper and Bronze leather pieces.
_Avoid_: Cow, ox (alone)

**Bristleback**:
The docile creature that roots in the field, the hide band 10's: its bristle hide works into the Iron and Steel pieces.
_Avoid_: Boar, pig

**Cinderhorn**:
The docile creature that grazes at the Boneyard's edge, the hide band 20's: its cinder hide works into the Emberite pieces.
_Avoid_: Ox of ash, fire beast

**Hide**:
The skin a docile creature leaves with each of its killers, one to a player, every kill. It stacks like ore, and Leatherworking works two of a band's hides into its pieces.
_Avoid_: Pelt, leather (that's what the pieces are made of)

**Leash**:
How far an enemy follows a player who walks away from a fight, before it gives up, walks home and recovers.
_Avoid_: Aggro range, chase radius

**Tick**:
The fixed step the world moves in; every move, swing, pick and timer happens on a tick.
_Avoid_: Frame, turn, cycle

### Quests

**Quest**:
Work a villager asks of a player, done one stage at a time: Odo's copper ore for his forge is the first, and the strange material he teaches identification from is his second. Each quest is a row of the shared quests table, and the server holds each player's progress in it. A villager's quests run as one chain, in the order they stand in the table (#231, #232). Phase 11 owns the quests beyond these.
_Avoid_: Mission, task (that's the Action), errand

**Stage**:
One step of a quest: what the journal says while it is current, and what finishes it — a turn-in, or a choice in the villager's conversation. The server checks it; clients send choices as today.
_Avoid_: Step, phase, objective

**Turn-in**:
The items a stage's completion asks the player to hand over from their inventory, such as Odo's copper ore. A villager may still take turn-ins after their quest is done, each paying experience.
_Avoid_: Delivery, hand-in

**Quest points**:
What finishing a quest awards, kept per player and shown in the journal. They gate later quests and areas, from Phase 11; the number exists now.
_Avoid_: QP, quest score

**Journal**:
The panel a player opens with J or the Journal button on the bottom bar. It lists each quest they have started with its current stage, and the quest points they have earned.
_Avoid_: Quest log, quest list

### Skills

**Skill**:
A trainable ability with its own experience and level, raised by doing the matching activity.
_Avoid_: Stat, attribute, profession

**Total level**:
The sum of a player's levels across the 23 registered skills, at most 2,277. Combat doesn't count: it is replaced when it splits.
_Avoid_: Overall level, combat level

**Combat level**:
How strong a fighter a player is, worked out from their combat skills: a base of Defense, Blocking, Hitpoints and half Prayer, plus the best of melee, Ranged and Magic. A fresh player is 3. Not the level of the Combat skill.

**Mastery**:
A skill with no activity of its own: it gains a 7% share of the experience that lands in every other skill, counted separately for each. Quest experience and experience moved by a split earn no share.

**Combat**:
The skill that raises how often and how hard a player hits; trained by dealing damage to enemies.
_Avoid_: Melee, fighting, attack

**Hitpoints**:
The skill that sets a player's maximum health; trained by dealing damage. Players start at level 10.
_Avoid_: HP skill, vitality, constitution

**Health**:
How much damage a player can still take before dying; at most 100 for each Hitpoints level, plus the Fortitude on their worn gear.
_Avoid_: Hitpoints (that's the skill), life

**Defense**:
The skill that makes a player harder to hit, by giving Avoidance; trained by being attacked, whether the swing lands or misses.
_Avoid_: Armour, defence

**Avoidance**:
How many percentage points come off an enemy's chance to hit a player, from Defense and the Avoidance Virtue on worn gear. An enemy always keeps at least a 5% chance.
_Avoid_: Dodge, evasion

**Accuracy**:
Points an entity adds to its own chance to hit, against a player's Avoidance. Every enemy's is 0 for now, and a ring adds its Accuracy to the player's side (#238).
_Avoid_: Precision, attack bonus

**Blocking**:
The skill that makes a shield block more often; trained by blocking. It doesn't decide who can use a shield.
_Avoid_: Shield skill, parry

**Block**:
When a shield stops an enemy's hit that would have landed, so it does no damage. Only a player with a shield can block.
_Avoid_: Parry, dodge, miss

**Herblaw**:
The gathering skill trained by picking berries, herbs and potion plants from bushes, and by mixing potions.
_Avoid_: Herbalism, herblore

**Foraging**:
Former skill; became Herblaw, with its experience.

**Mining**:
The skill trained by taking ore from veins and smelting it into bars at a furnace.
_Avoid_: Gathering, quarrying

**Gathering skill**:
A skill trained by taking items from a **site**, a tile that runs out and grows back, either where it was or at another spot of its site pool: Herblaw from bushes, Mining from veins, Woodcutting from trees and Fishing from fishing spots. It names the family, and is no other name for any one skill.
_Avoid_: Resource skill, harvesting

**Smithing**:
The skill trained by turning bars into gear, arrowheads and throwing knives at an anvil. Smelting ore into bars is Mining.
_Avoid_: Crafting, forging

**Cooking**:
The skill trained by turning a raw fish into food at the range or a fire. It gates each fish and dish, decides how often one burns and how often one comes out Delicious, and pays the food's experience.
_Avoid_: Chef work, cookery

**Firemaking**:
The skill trained by lighting fires from logs. It gates each log's fire, and pays the fire's experience when it appears.
_Avoid_: Burning

**Crafting**:
The skill trained by making the game's utilities and working reagents into capes at the workbench: rope from spider silk, torches from a log and a rope, vials from a gem, and the Gossamer cloak from a cape and silk (#225). It gates each product and pays its experience.
_Avoid_: Handicraft, construction

**Fletching**:
The skill trained by making the archer's stock at the workbench: arrow shafts from a log, arrows from shafts, arrowheads and feathers, and bows from a log and a rope (#228). It gates each product and pays its experience.
_Avoid_: Woodwork, carpentry

**Runecrafting**:
The skill trained by making runes from rune essence at the altar. It gates each rune and pays its experience, and a make never fails (#232). Once it is at a rune's doubling level, one essence makes two of that rune. Higher runes come with Phase 9's spells.
_Avoid_: Magic, spellcraft

**Leatherworking**:
The skill trained by making the hands, feet and capes from hides at the workbench, two of the band's hides a piece and a rope for a cape. It gates each piece at its tier and pays its experience.
_Avoid_: Tanning, tailoring

**Jewelsmithing**:
The skill trained by making the necks and rings from bars and gems at the anvil, a bar alone at Copper and Bronze and with the tier-matched gem from Iron up. It gates each piece at its tier and pays its experience.
_Avoid_: Jewelcrafting, goldsmithing

**Identification**:
The one-off act of learning what the strange material really is, taught by Odo's second quest (#232). Finishing it sets the player's flag at once: every strange material they hold, bank included, turns to rune essence, and the veins' essence find gives essence from then on.
_Avoid_: Uncovering, appraisal

**Agility**:
The skill trained only by crossing obstacles, on a course or a shortcut. It gates each shortcut and raises the chance that a player's landed hits are critical. It does not count toward combat level. Runic has no run energy, and Agility adds none (#234).
_Avoid_: Running, stamina

**Obstacle**:
A fixed place a player crosses for Agility experience, such as a log to balance on or a net to climb. Crossing one near its level can fail, which costs a little health but never kills.
_Avoid_: Hurdle

**Course**:
A loop of obstacles crossed in order. Each obstacle pays experience, and finishing the loop pays a lap bonus.
_Avoid_: Track, circuit

**Shortcut**:
An obstacle that leads somewhere: most open a pocket of the region that can't be reached any other way, and a few cut a long walk short. Each needs an Agility level. Some must first be **rigged** with a rope, which is spent once and keeps that shortcut open for that player for good.
_Avoid_: Passage, agility route

### Players

**Account**:
A friend's login: a username and password. Each account has exactly one player, who goes by the account's username.
_Avoid_: User, profile, character slot

**Save**:
What the server keeps of a player between logins: where they stand, their health, each skill's experience, their inventory, bank, worn gear, tools and pinned skills. A new account has none until its first save.
_Avoid_: Profile, record, snapshot

**Invite code**:
The one shared secret a friend must give to create an account.
_Avoid_: Referral, key

**Action**:
The one thing a player is currently doing (walking, picking, mining, chopping, fishing, smithing, lighting or fighting); a new click replaces it.
_Avoid_: Task, job, activity

**Lighting**:
Making a fire from a log with a tinderbox, on the player's own tile. It takes a few ticks, and the log is burnt at once: a new click during the lighting loses it. Firemaking pays its experience when the fire appears.
_Avoid_: Ignite, burn (that's what a fish can do)

**Inventory**:
The fixed set of slots a player carries items in. A slot holds one piece of gear, or a stack.
_Avoid_: Bag, backpack

**Stack**:
Up to 20 of the same material or food in one inventory slot. Gear doesn't stack.
_Avoid_: Pile, bundle

**Chat command**:
A chat line that starts with `/`, such as `/pm`. The server reads it as an instruction instead of saying it aloud. Most mistakes get a line in the sender's own chat box only; a line past the length limit is dropped without one. `/help` lists every command with its usage, and `/who` lists every online player.
_Avoid_: Slash command

**Emote**:
A chat line sent with `/e <text>` that acts something out. It reads `<name> <text>` in bold, such as "**DeRusto dances**", in the chat box of every player who doesn't ignore the sender. Otherwise it behaves exactly like public chat: the same length limit, sent while dead, and shown over the sender's head.
_Avoid_: Action, `/me`

**Online**:
Said of a player whose character is in the world, including one whose connection dropped while a combat lock holds them there. A login still waiting to enter the world is not online yet. Private messages, follow and the friends list all use this one meaning.
_Avoid_: Connected, logged in

**Private message**:
A chat line sent with `/pm <name> <message>` to one online player. It shows in the sender's chat box (`To <name>:`) and in that player's (`From <name>:`), unless that player ignores the sender, and nowhere else, never over anyone's head. `/r <message>` sends one to the last player whose private message reached you during this login.
_Avoid_: PM (outside the command), whisper, DM

**Friends list**:
The accounts a player has added with `/friend <name>` and not removed with `/unfriend <name>` or `/ignore <name>`, kept on the server across logins. Adding is one-sided: the friend is not asked or told. The social panel (O) shows each friend as online or offline, and the player's chat box gets a line when a friend logs in or out.
_Avoid_: Buddy list, contacts

**Ignore list**:
The accounts a player has added with `/ignore <name>` and not removed with `/unignore <name>`, kept on the server across logins. The server drops their public chat, emotes and private messages before they reach this player, and the ignored player is not told: they still see their own lines. Ignoring a friend takes them off the friends list. The social panel (O) lists the names, with no status.
_Avoid_: Block list, mute

**Follow**:
An action started with `/follow <name>`: the player walks after another online player at walking speed and stops on a tile next to them, never on theirs. The target is not told. It ends with `/unfollow`, a new walk, gather or fight, the death of either player, the target logging out, or the target adding the follower to their ignore list. A dead target, or one who has the follower on their ignore list, cannot be followed, and the refusal does not say why.
_Avoid_: Trail, shadow

**Player menu**:
What right-clicking another player opens at the cursor: Trade, Follow, Attack, Examine, Message and Duel, in that order. Follow sends `/follow <name>`, with the same errors. Message types `/pm <name> ` into the player's chat box and sends nothing. Examine prints the other player's name and combat level in the player's own chat box. Trade, Attack and Duel answer with a refusal in the player's own chat box until Phase 12 lifts it where its rules allow. Right-clicking yourself opens nothing.
_Avoid_: Context menu, player options

**Drop**:
Moving some or all of one inventory slot onto the tile the player stands on, where it becomes one ground item. The amount comes from the amount menu, and the rest stays in the slot.
_Avoid_: Discard, destroy, delete

**Amount menu**:
The right-click choices **1**, **5**, **10**, **X** and **All** that Drop, and later the bank and the general store, offer on a stack. X asks for a number, and an amount larger than the stack takes all of it. A lone item offers the plain choice instead.
_Avoid_: Quantity picker, split menu

**Ground item**:
One item or stack lying on a tile, from a single drop. Only the player it belongs to can see and take it for the first minute, then everyone can, and it vanishes after three minutes. Ground items never merge, but a stack taken into an inventory joins a matching stack there.
_Avoid_: Floor item

**Loot**:
What an enemy leaves when it dies: a ground item on the enemy's tile for each player who won it, belonging to that player for the first minute.
_Avoid_: Drop, reward

**Pile**:
All the ground items on one tile. A tile holds any number of them.
_Avoid_: Heap, stack

**Food**:
An item that heals the player who eats it, over the next few ticks rather than all at once: a berry and the range's cooked fish and dishes are food. A raw fish is a material until the range cooks it, and a herb is Cooking material, not food.
_Avoid_: Consumable, potion

**Delicious**:
The food Quality a fish or dish can come out of the range at. It heals exactly like its common form, and eating it starts a short extra healing of its own that runs through combat and is refreshed, never stacked, by another Delicious fish. Its name shows in gold.
_Avoid_: Perfect, tasty, golden

**Healing pool**:
The health a player's eaten food has yet to give back, as healing ticks waiting in eating order. Each food gives its own amount per healing tick, one food's ticks at a time, so more food heals for longer but not faster.
_Avoid_: Heal over time, buff

**Dewpetal**:
A pale blue flower picked from its own bush in the deeper Thicket, at Herblaw 5. A potion plant: mixed with a vial into the Might potion. Not food.
_Avoid_: Dew flower, petal

**Nightbloom**:
A violet flower picked from its own bush in the deeper Thicket, at Herblaw 15. A potion plant: mixed with a vial into the Fortitude potion. Not food.
_Avoid_: Night flower

**Emberbloom**:
An ember-orange flower picked from its own bush in the deepest Thicket, at Herblaw 20. A potion plant: mixed with a vial into the Avoidance potion. Not food.
_Avoid_: Ember flower

**Vial**:
A small empty bottle the general store sells from day one, and Crafting makes a second supply of from a cinderglass at the workbench (#225). One holds a potion while it is mixed, and is used up with the plant.
_Avoid_: Flask, bottle

**Potion**:
A drink mixed from one vial and one potion plant, and drunk like food is eaten. Drinking one starts its Virtue on the drinker for two minutes: Might adds to the hit, Fortitude raises max health, Avoidance adds a point of Avoidance. Drinking again refreshes it, never stacks it, and it runs through combat. It is not food: it heals nothing, the Virtue is the whole of it, and what a Fortitude bonus hasn't spent is lost when it runs out.
_Avoid_: Elixir, draught, consumable

**Mixing**:
Making a potion, anywhere in the inventory and with no station: using a vial on a potion plant. The plant's pick gate is the Herblaw level it needs, it pays 1.5 of the plant's pick experience, and the making engine's level and materials refusals apply. The base herb mixes nothing: it is Cooking material.
_Avoid_: Brewing, crafting

**Material**:
An item that goes into making something: ore, finds, bars, logs, fish and Emberbones. Gems, logs and fish count as materials before anything uses them.
_Avoid_: Resource, ingredient

**Ore**:
The raw metal a player takes from a vein. A successful mine gives 1 or 2.
_Avoid_: Rock, stone

**Log**:
The wood a player takes from a tree: birch, oak or charwood logs. A successful chop gives 1. Logs stack like ore.
_Avoid_: Wood, lumber, timber

**Fish**:
What a player catches at a fishing spot with a rod: **Perch** (Fishing 1), **Trout** (10) or **Pike** (20). Every fishing spot can give any of them. A catch is a perch unless the player's level lets a better fish come up instead. Fish are caught raw, so they are a material, not food, and can't be eaten until the range cooks them. A successful catch gives 1, and fish stack like ore.
_Avoid_: Raw fish

**Find**:
A material a vein sometimes gives along with its ore on a successful mine: tin from Copper and Iron veins, coal from Iron veins, and gems from Emberite veins; and, from every vein, the essence find at 1 in 5, which is a strange material until the player identifies it (#232). A find is always 1.
_Avoid_: Drop, extra, byproduct, bonus

**Gem**:
A rare find from an Emberite vein: Ashstone, Cinderglass or Heartflame, rarest last. Nothing uses gems yet.
_Avoid_: Jewel, stone

**Bar**:
Metal made at a furnace from ore, plus a find for Bronze (tin) and Steel (coal), ready to become gear at an anvil.
_Avoid_: Ingot

**Strange material**:
The essence find's masked face, before the player identifies it (#232): a dull piece the veins give without telling what it is. It stacks like ore and is worth little at the store.
_Avoid_: Mystery item, unknown material

**Rune essence**:
The essence unmasked, once Odo's second quest teaches identification (#232): the stuff runes are made from. One essence makes one rune at the altar, or two once the player's Runecrafting is at that rune's doubling level.
_Avoid_: Essence (alone), pure essence

**Rune**:
A small carved stone made at the altar from one rune essence, paid in Runecrafting experience and bought by the store (#232). Today only the four elementals exist — the **air rune** (1), the **water rune** (5), the **earth rune** (10) and the **fire rune** (20); higher runes come with Phase 9's spells.
_Avoid_: Talisman (there are none), magic stone

**Emberbone**:
Loot from a Skeleton, needed to make Emberite gear. Each player who damaged the Skeleton has their own chance at one.
_Avoid_: Trophy, token

**Spider silk**:
A thread a Spider sometimes leaves behind, needed to make rope and to augment capes. Phase 8 owns drop tables, so nothing gives it yet.
_Avoid_: Web, thread

**Rope**:
A length spun from two spider silk at the workbench. Nothing uses it yet: it waits for Agility's shortcuts, and sells at the general store until then.
_Avoid_: Cord, line

**Torch**:
A stick made at the workbench from a birch log and a rope. Nothing uses it yet: it waits for a dark place to light, gives no light of its own, and sells at the general store until then.
_Avoid_: Lamp, candle

**Arrow shaft**:
A stick split from a log at the workbench, ten to the log. A log of any tier makes the same shafts (#228).
_Avoid_: Shaft (alone), stick

**Feather**:
A feather the general store sells from day one, for an arrow's flight. Phase 8 will let enemies leave one behind; until then the shelf is the only source (#228).
_Avoid_: Plume, quill

**Throwing knife**:
A small thrown weapon smithed from one bar at the anvil, plus an Emberbone at Emberite, one tier of five. It stacks like a material for now: Phase 8 decides what a throw spends and gives it combat meaning (#228).
_Avoid_: Dagger, knife (alone)

**Gear**:
What a player equips to fight better: a weapon, which raises how hard they hit, a shield, which gives them a chance to block, or armour. It never wears out.
_Avoid_: Equipment

**Bow**:
A weapon fletched at the workbench from a log and a rope: the birch bow, the oak bow and the charwood bow, from their own wood. It goes in the weapon slot and adds to the hit like a sword, at the Combat level its wood's gate sits at; Phase 8 re-gates it on Ranged and tunes the bonus (#228). It rolls improved versions like all gear.
_Avoid_: Ranged weapon, longbow

**Improved item**:
Gear of uncommon or rare Quality, which carries a Virtue. Today only making gives one, but nothing rules out enemy loot giving one later.
_Avoid_: Magic item, enchanted item, rare item (rare is one Quality)

**Quality**:
A step on the ladder an item is made at: common, uncommon or rare. A common item has no Virtue, an uncommon one has a Virtue, and a rare one has a Virtue at double the size. Food can also come out Delicious. Quality never changes an item's base stats, gate or look. Its colour shows in the item's name.
_Avoid_: Rarity, grade, tier (that's the metal)

**Virtue**:
The named boost an improved item gives one number combat reads: Fortitude raises max health, Might raises the hit, and Avoidance lowers an enemy's chance to hit. The Virtues on worn gear add up. A Virtue never raises a skill level, so it never changes combat level or meets a gate.
_Avoid_: Bonus (a sword's hit bonus and Mastery's share use that word), affix, enchantment

**Armour**:
Gear worn on the body that reduces the damage of hits that land, by a percentage. It doesn't make a hit less likely to land: that's Defense.
_Avoid_: Protection, plate

**Cape**:
Gear worn on the back: small armour, on the hands' line, and the slot an augmentation works on. Leatherworking makes one of three Virtues for each tier (#217), and a common cape carries its Virtue at half its uncommon size, an uncommon one at full and a rare one at double (#238). Its warmth stat stays dormant until a place needs it.
_Avoid_: Cloak (that's the Gossamer cloak), mantle

**Gloves**:
The hands' gear, made from hides at the workbench: small armour on its own line, 1–5% by tier (#217, #238).
_Avoid_: Gauntlets, mitts

**Boots**:
The feet's gear, made from hides at the workbench: small armour on the helmet's line, 2–6% by tier (#217, #238).
_Avoid_: Shoes, foot armour

**Amulet**:
The neck's gear, made from bars and gems at the anvil: Avoidance in tenths of a point, 5–16 by tier (#217, #238).
_Avoid_: Necklace, pendant, talisman (there are none)

**Ring**:
The hand's gear, made from bars and gems at the anvil: Accuracy in points added to the wearer's chance to hit, 5–16 by tier (#238).
_Avoid_: Band, signet

**Gossamer cloak**:
A cape that has taken its reagent's gift: the first augmentation turns a cape and one spider silk into it at the workbench. It keeps the cape's Quality and Virtue and adds a little Avoidance, and reads as the cape in every way but its name and that bonus (#217, #225).
_Avoid_: Cape (that's what it was)

**Augmentation**:
A reagent worked into a piece of gear at the workbench, owned by Crafting: the gear and its reagent become the gear's variant, which keeps the gear's Quality and Virtue and adds the reagent's gift. The Gossamer cloak is the first; more reagents later mean more of them (#217, #225).
_Avoid_: Enchanting, upgrade

**Gear slot**:
Where a piece of gear goes when it is equipped, out of the inventory. A player has ten: weapon, shield, head, body, legs, hands, feet, cape, neck and ring.
_Avoid_: Equipment slot

**Panel**:
A window that opens over the world: the character sheet, the smithing panel, the social panel, the journal or the pile window. Any number can be open at once, each dragged by its title bar, and Escape closes the one in front. The inventory and the bottom bar are not panels.
_Avoid_: Window (alone), dialog, menu

**Tooltip**:
The one dark box that shows beside the cursor on every hover in the game. An item's tooltip gives its name and kind, then its stats if it has any.
_Avoid_: Slot tip, hover text, title

**Character sheet**:
The panel a player opens to see their gear slots, Toolbelt and all their skills.
_Avoid_: Equipment screen, paper doll

**Pinned skill**:
A skill a player has chosen to show on the bottom bar, up to six. Every skill always shows on the character sheet, pinned or not.
_Avoid_: Favourite skill, tracked skill

**Smithing panel**:
The panel a player opens by clicking a station, to choose what to make there.
_Avoid_: Crafting menu, recipe list

**Social panel**:
The panel a player opens with O or the Social button on the bottom bar. It has two tabs: the friends list, with each friend shown online or offline, and the ignore list, with an Unignore button beside each name.
_Avoid_: Friends panel, friends window

**Tier**:
One of the five metals, from lowest to highest: Copper (1), Bronze (5), Iron (10), Steel (15) and Emberite (20). A tier's bars and gear, and its ore where it has veins, all share its level gate. Only Copper, Iron and Emberite have veins; Bronze and Steel bars are smelted from another tier's ore and a find.
_Avoid_: Grade, rank

**Tinderbox**:
A tool the Forester gives players alongside the axe, free on ask in conversation. Lighting a fire takes one, along with a log.
_Avoid_: Fire striker, lighter

**Tool**:
What a player must own to do some work: a pickaxe for Mining, an axe for Woodcutting, a fishing rod for Fishing, a hammer at an anvil, a tinderbox for Firemaking. Owning one is enough: a tool has no tiers and never changes how fast work goes. A tool is never lost and takes no inventory slot.
_Avoid_: Gear, equipment

**Toolbelt**:
The tools a player owns. It has no limit and grows as tools are added, unlike the inventory.
_Avoid_: Tool inventory, bag

**Respawn**:
Returning to the village with everything kept, after dying.
_Avoid_: Revive, resurrect

**Combat lock**:
The short time after combat during which a player cannot log out.
_Avoid_: Logout timer, combat tag
