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

**Runestone Hollow**:
The ruined valley east of the Boneyard, floored with moss and set with broken columns and standing stones, where the altar stands. Its only way in is a gap in the trees behind the Emberite veins, so the walk there crosses the Boneyard. It is not part of the Boneyard.
_Avoid_: Stone circle, shrine

**Hollis**:
The runekeeper: an old hermit who tends the stones of Runestone Hollow, standing just inside its gap. Their quest, after Odo's essence quest, asks for five Hollow essence and a Skeleton Mage's **bone sigil**, and opens the altar.
_Avoid_: Keeper (alone), hermit

**Inn**:
The village's south-west building, with the range outside its door.
_Avoid_: Tavern, pub

**Lake**:
The body of water in the region, where players fish from the bank. Water can't be walked on. It is one kind of water among those a region may hold, alongside a river or the sea.
_Avoid_: Pond, mere

**Smithy**:
The part of the village where the furnace, anvil, workbench and Blacksmith stand.
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
A cauldron over a fire, with a table beside it, outside the inn's door, where a player cooks: a raw fish alone, or with a berry or a herb, becomes food. It can burn a fish, and a fish cooked well comes out Delicious.
_Avoid_: Stove, oven, cooker

**Fire**:
A cooking station a player lights with a tinderbox from one log, on the tile they stand on. It burns for a while that depends on the log — birch, oak or charwood — cooks like the range but burns a fish more, and is then simply gone, leaving nothing. It gives light, never blocks walking, and only one burns on a tile.
_Avoid_: Campfire, bonfire

**Workbench**:
A fixed place in the smithy, beside the furnace and north of the anvil, where a player crafts: leftovers and rare finds become the game's utilities, and a cape gains its reagent's gift (#225).
_Avoid_: Crafting table, work table

**Altar**:
A stone slab in Runestone Hollow, with a ring stone behind it and an obelisk on either side, where a player turns rune essence into runes (#232). It opens once Hollis's quest is done, asks no level of its own, gives no tools, and never runs out; the walk there is part of the gate. Its old place on the Boneyard's far side is a ring of rocks around bare ground.
_Avoid_: Stone circle, rune stone

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
Marta, the villager who runs the general store, and owns the stalls outside it.
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
A creature in a field that players fight to train Attack and Strength.
_Avoid_: Mob, monster, NPC

**Spider**:
The weaker enemy: a large spider that fights back only when attacked, unlike a Skeleton.
_Avoid_: Thornback (its old name)

**Skeleton**:
The harder enemy: an armed skeleton that attacks players who come near, unlike a Spider. It is the only source of Emberbones.
_Avoid_: Undead, boss

**Docile creature**:
An enemy that never fights back, never chases and never wanders: it stands where it starts while it is hit. Only the Tarn Ox is one now. With the Bristleback and the Cinderhorn it makes the three **hide creatures**, each of which leaves its hide with every player who damaged it.
_Avoid_: Passive mob, harmless enemy

**Tarn Ox**:
The docile creature that grazes by the Lake's shore, the hide band 1's: its tarn hide works into the Copper and Bronze leather pieces.
_Avoid_: Cow, ox (alone)

**Bristleback**:
The hide creature that roots in the field, the hide band 10's: its bristle hide works into the Iron and Steel pieces. It never starts a fight, but once hit it headbutts back at its band's strength, and chases only 2 tiles.
_Avoid_: Boar, pig

**Cinderhorn**:
The hide creature that grazes at the Boneyard's edge, the hide band 20's: its cinder hide works into the Emberite pieces. Like the Bristleback, it bites back only once hit, at its band's strength, and chases only 2 tiles.
_Avoid_: Ox of ash, fire beast

**Hide**:
The skin a hide creature leaves with each of its killers, one to a player, every kill. It stacks like ore, and Leatherworking works two of a band's hides into its pieces.
_Avoid_: Pelt, leather (that's what the pieces are made of)

**Leash**:
How far an enemy follows a player who walks away. It measures from the tile of the last attacker when they attacked, even on a miss. If the enemy noticed the player first, it measures from its own notice tile until someone attacks it. Past that distance it gives up, walks home and recovers.
_Avoid_: Aggro range, chase radius

**Tick**:
The fixed step the world moves in; every move, swing, pick and timer happens on a tick.
_Avoid_: Frame, turn, cycle

### Quests

**Quest**:
Work a villager asks of a player, done one stage at a time: Odo's copper ore for his forge is the first, the strange material and vein essences he teaches identification from are his second, and Hollis's offering that opens the rune altar follows them. Each quest is a row of the shared quests table, and the server holds each player's progress in it. A villager's quests run as one chain, in the order they stand in the table (#231, #232). Phase 11 owns the quests beyond these.
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
The sum of a player's levels across the 23 registered skills, at most 2,277.
_Avoid_: Overall level, combat level

**Combat level**:
How strong a fighter a player is, worked out from their combat skills: a base of Defense, Blocking, Hitpoints and half Prayer, plus the best of melee (Attack and Strength), Ranged and Magic. A fresh player is 3.

**Mastery**:
A skill with no activity of its own: it gains a 7% share of the experience that lands in every other skill, counted separately for each. Quest experience and experience moved by a split earn no share.

**Attack**:
The skill that raises how often a player's melee swing lands, and gates which swords they can wield; trained by dealing melee damage, as the stance directs.
_Avoid_: Accuracy (that's gear's points), Combat

**Strength**:
The skill that raises a player's max hit in melee, by 100 every 20 levels; trained by dealing melee damage, as the stance directs.
_Avoid_: Power, damage skill, Combat

**Stance**:
How a player fights, chosen on the character sheet's Gear tab, which shows only the stances of the weapon in hand. Each style keeps its own, so swapping a sword for a bow brings back the Ranged stance last chosen, and swapping back brings back the melee one. Melee's are Balanced, which splits each hit's melee experience evenly between Attack and Strength, Attack taking the odd point of an odd total, Precise, which gives it all to Attack, and Forceful, which gives it all to Strength; they change only where experience goes, never the hit itself. Ranged's are Steady, Rapid and Longrange (#280). A new player starts Balanced and Steady.
_Avoid_: Combat style, attack style (style means melee, Ranged or Magic)

**Steady**:
The default Ranged stance: all of a shot's ranged experience goes to Ranged, and the weapon keeps its own reach and fire rate (#268). A save from before Ranged's stances starts Steady.
_Avoid_: Accurate, normal

**Rapid**:
The Ranged stance that attacks 2 ticks sooner than the weapon's own interval, so a bow fires every 6 ticks and knives every 4; all of a shot's ranged experience goes to Ranged (#268, #270).
_Avoid_: Fast, quick

**Longrange**:
The Ranged stance that reaches 2 tiles further than the weapon's own reach, so a bow shoots from 8 tiles and knives from 6, and splits a shot's ranged experience evenly between Ranged and Defense, Ranged taking the odd point of an odd total (#268, #270).
_Avoid_: Long range, defensive

**Combat** (retired):
The one melee skill before Phase 8, which raised both how often and how hard a player hit. Attack and Strength replaced it (#88): each took a full copy of every player's Combat experience, with no Mastery share, so nobody lost a level. Combat level keeps its name and still means the level worked out from the combat skills.

**Ranged**:
The skill that gates bows, arrows and throwing knives and sets how often and how hard a ranged attack lands (#268, #279). A shot pays 6 experience per 100 damage dealt, rounded once per shot, with none for overkill, to Ranged or split with Defense as the Ranged stance directs, and Hitpoints the same again. A save from before it starts at 0 experience.
_Avoid_: Archery, Range

**Hitpoints**:
The skill that sets a player's maximum health; trained by dealing damage. Players start at level 10.
_Avoid_: HP skill, vitality, constitution

**Health**:
How much damage a player can still take before dying; at most 100 for each Hitpoints level, plus the Fortitude on their worn gear.
_Avoid_: Hitpoints (that's the skill), life

**Defense**:
The skill that makes a player harder to hit, by giving Avoidance; trained by being attacked, whether the swing lands or misses, and by the share of each shot's experience that the Longrange stance gives it, which is half, less the odd point.
_Avoid_: Armour, defence

**Avoidance**:
How many percentage points come off an enemy's chance to hit a player, from Defense and the Avoidance Virtue on worn gear. An enemy always keeps at least a 5% chance.
_Avoid_: Dodge, evasion

**Accuracy**:
Points an entity adds to its own chance to hit, against a player's Avoidance. The Skeleton Mage has 10 Accuracy, and the other enemies have 0. A ring and a bow add their Accuracy to the player's side (#238, #268).
_Avoid_: Precision, attack bonus

**Style**:
How a fighter fights: melee, ranged or magic. A player's style is the weapon in hand when the hit resolves, so a sword or bare hands fight in melee and a bow or throwing knives at range. Each enemy has one fixed style in its stats (#271). The Skeleton Mage fights at range (#298). Nothing fights with magic until Phase 9.
_Avoid_: Combat style, attack type, stance (each style has its own stances)

**Ranged enemy**:
An enemy with a shot reach in its stats. While fighting, it stands and shoots when its target is within reach and in sight. It follows its path toward the target if either condition fails. A shot rolls like a swing and spends no ammunition.

**Skeleton Mage**:
Runestone Hollow's ranged enemy. It shoots from up to 5 tiles and chases players it notices within 3 tiles by a walking route. It can leave a bone sigil for Hollis's quest.

**Combat triangle**:
The rule that melee beats ranged, ranged beats magic and magic beats melee (#72, #271). A fighter whose style beats the other side's gains 10 points to land each hit, and one whose style is beaten loses 10, on the Accuracy and Avoidance scale. It applies to both sides of every swing and shot, changes how often a hit lands and never how hard, and leaves armour alone. An enemy's chance to hit still never falls below 5%.
_Avoid_: Rock-paper-scissors, style bonus, counter

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

**Making skill**:
A skill trained by turning materials into a product at a place it names: Mining's smelting at the furnace, Smithing and Jewelsmithing at the anvil, Cooking at the range or a fire, Crafting, Fletching and Leatherworking at the workbench, and Runecrafting at the altar. It names the family, and is no other name for any one skill. Mixing a potion is not one: it needs no place and takes no time.
_Avoid_: Production skill, artisan skill

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
A crossing between a marked start tile and a landing tile that earns Agility experience. The crossing takes a fixed number of ticks. During those ticks the player cannot act or take a hit, and other players can cross the same obstacle. A shortcut can fail near its required level and cost a little health, but it never kills the player.
_Avoid_: Hurdle as the general term for an obstacle. Hurdle is also the name of one Southfield obstacle.

**Course**:
A loop of obstacles crossed in order. Each obstacle pays experience, and finishing the loop pays a lap bonus.
_Avoid_: Track, circuit

**Shortcut**:
An obstacle that leads somewhere: most open a pocket of the region that can't be reached any other way, and a few cut a long walk short. Each needs an Agility level. Some must first be **rigged** with a rope, which is spent once and keeps that shortcut open for that player for good.
_Avoid_: Passage, agility route

**Thieving**:
The skill trained by stealing: pickpocketing villagers and marks, taking from stalls, and opening strongboxes. Each target needs a Thieving level. Loot is its only reward. It does not count toward combat level, and players never steal from each other (#235).
_Avoid_: Stealing (as the skill's name), larceny

**Pickpocket**:
Stealing from a person, a villager or a mark, mostly for coins, now and then for an item that fits them. The banker is never a target. Failing costs a small hit that never kills, then a stun.
_Avoid_: Steal from, rob

**Mark**:
A person who stands in the region only to be pickpocketed, with no job to offer, such as the drunk outside the inn or the pedlar in the square. A mark is not a villager.
_Avoid_: Victim, target (alone), NPC

**Pell**:
The drunk, the first mark, who stands outside the inn's door. Pickpocketing him needs Thieving 1 and pays a few coins, and now and then a cooked perch as well (#250).
_Avoid_: Drunkard, the sot

**Jory**:
The travelling pedlar, the second mark, who stands in the village square with his pack. Pickpocketing him needs Thieving 10 and pays coins, and now and then a rope as well (#251).
_Avoid_: Peddler, trader, merchant

**Stun**:
A few ticks after a failed pickpocket when the player can't act or move and clicks are ignored. Enemies can still hit them.
_Avoid_: Freeze, daze

**Busy**:
A player held for a set number of ticks, who can't act or move while the server ignores their clicks. Each use says whether enemies can still hit the player: a stun says yes, and Agility's crossing says no (#236).
_Avoid_: Locked (that's the combat lock), frozen

**Stall**:
One of the Storekeeper's carts outside the general store, holding food, fish or gems, that a player steals items from. It empties for that player alone, for a while. If a player fails, the Storekeeper catches them: no loot, no hit, and that stall is closed to them for a while.
_Avoid_: Market stall, cart, booth

**Strongbox**:
A locked box out where the danger is, in the Boneyard or Runestone Hollow, that a player opens for gems, runes and coins. It empties for that player alone, for a long while. If a player fails, a trap springs that hits harder than a failed pickpocket and can kill.
_Avoid_: Chest (that's the bank's avoided word), coffer

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
Up to 20 of the same material, food, arrows or throwing knives in one inventory slot. Arrows and throwing knives are the only gear that stacks: arrows in the inventory and the ammo slot, and knives in the inventory and the weapon slot. All other gear holds one to a slot.
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
One item or stack lying on a tile. Only the player it belongs to can see and take it for the first minute, then everyone can, and it vanishes after three minutes. A recovered arrow or throwing knife joins a matching stack on that tile while the shooter still owns it, restarting both timers. All other drops form their own ground items. A stack taken into an inventory joins a matching stack there.
_Avoid_: Floor item

**Loot**:
What an enemy leaves when it dies: a ground item on the enemy's tile for each player who won it, belonging to that player for the first minute.
_Avoid_: Drop, reward

**Loot table**:
An enemy's **loot** by category (gear, material or quest). Each player who damaged it rolls the whole table: each of a category's picks gives one of its items at the category's chance, chosen by weight, as a fixed count or a count from a range. If the enemy can leave bones, each player who damaged it rolls for them separately after rolling its loot table.
_Avoid_: Drop table

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
An item that goes into making something: ore, finds, bars, logs, fish, Emberbones, bones and heavy bones. An item can count as a material before it has a use.
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

**Quest essence**:
An essence a vein gives only while a quest asks for it, and only until the player holds as many as it asks for. Odo's proof asks for one each of **copper essence**, **iron essence** and **emberite essence**, each from its own tier's veins at a 1 in 5 chance a successful mine. Hollis asks for five **Hollow essence**, from the essence rocks at 1 in 4. It is worth a coin at the store and is no use to anyone but the villager who asked.
_Avoid_: Proof piece, quest ore

**Rune**:
A small carved stone made at the altar from one rune essence, paid in Runecrafting experience and bought by the store (#232). Today only the four elementals exist — the **air rune** (1), the **water rune** (5), the **earth rune** (10) and the **fire rune** (20); higher runes come with Phase 9's spells.
_Avoid_: Talisman (there are none), magic stone

**Emberbone**:
Loot from a Skeleton, needed to make Emberite gear. Each player who damaged the Skeleton has their own chance at one.
_Avoid_: Trophy, token

**Bones**:
A stackable material left by Skeletons, Tarn Oxen and Bristlebacks. Each player who damaged the enemy has a two-in-three chance of finding one on its tile, separate from its other loot. They can sell or bank it until Prayer arrives in Phase 9.

**Heavy bones**:
A stackable material left by Skeleton Mages and Cinderhorns at the same chance as bones. The general store pays more for heavy bones.

**Spider silk**:
A thread a Spider leaves behind, needed to make rope and to augment capes. Every Spider kill leaves 1 or 2, at even odds, for each player who damaged it (#272).
_Avoid_: Web, thread

**Rope**:
A length spun from two spider silk at the workbench. It rigs the Bramble swing and the Crag line, two of Agility's shortcuts: the first crossing spends one, and that shortcut stays rigged for that player for good. It also goes into torches, bows and capes, and sells at the general store.
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
A ranged weapon smithed from one bar at the anvil, plus an Emberbone at Emberite. Up to 20 of the same tier fit in the weapon slot. Each attack spends one from that stack (#228, #279).
_Avoid_: Dagger, knife (alone)

**Gear**:
What a player equips to fight better: a weapon (a sword raises how hard they hit, and a bow how often), arrows in the ammo slot, a shield, which gives them a chance to block, or armour. It never wears out.
_Avoid_: Equipment

**Bow**:
A weapon fletched at the workbench from a log and a rope: the birch bow, the oak bow and the charwood bow, from their own wood. It goes in the weapon slot, gated on Ranged at 1, 10 and 20, and adds 5, 10 or 15 points of Accuracy; it carries no hit bonus, since the arrow decides how hard a shot hits (#268). A bow worn before the Ranged gate came stays worn. Bows can still roll improved versions; arrows never do.
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
Where a piece of gear goes when it is equipped, out of the inventory. A player has eleven: weapon, shield, head, body, legs, hands, feet, cape, neck, ring and ammo. Each holds one item, but the weapon slot and the ammo slot keep a count, so a stack moves whole when it goes on, comes off or drops on death.
_Avoid_: Equipment slot

**Ammo slot**:
The eleventh gear slot, which holds one stack of arrows of one tier, up to 20, and nothing else. Arrows gate on Ranged by tier and carry the hit bonus a bow shot adds. Each shot spends one, hit or miss, and when the last goes the slot refills with up to 20 more of the same arrow from the inventory. Equipping more of the worn arrow tops the slot up to 20, and another tier swaps the stacks. It keeps its arrows while a sword is in hand, and drops its whole stack on death (#269).
_Avoid_: Quiver, ammunition slot

**Reach**:
How far a ranged weapon shoots, counted in tiles with a diagonal step as one: a bow reaches 6 and throwing knives 4, and Longrange adds 2 to either. A player who attacks an enemy out of reach or out of sight walks until it is in both, then shoots; with no tile they can walk to that has it in both, the attack is cancelled and the chat says so. A melee swing has no reach; it needs the player next to the enemy (#270).
_Avoid_: Range (the cooking station), distance

**Sight**:
Whether a shot can fly from the shooter to the target: the straight line between their tiles crosses no tall tile, even at a corner. Water, bushes, doors and every other low tile let it pass (#270, #278).
_Avoid_: Line of fire, LOS

**Tall tile**:
A tile a shot cannot pass: a house wall, a tree (a prop, or a Woodcutting tree that is not a stump), a rock (a prop, an ore vein or an essence vein), or one of Runestone Hollow's columns and standing stones (owner, 2026-11-23).
_Avoid_: Wall (alone), obstacle (that's Agility's)

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
Returning to the village with full health after dying. Levels and experience stay; the inventory and worn gear drop where the player fell, and only the Toolbelt is kept (#119).
_Avoid_: Revive, resurrect

**Combat lock**:
The short time after combat during which a player cannot log out.
_Avoid_: Logout timer, combat tag
