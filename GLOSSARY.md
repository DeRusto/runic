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
The part of a region where foraging bushes grow.
_Avoid_: Forest, woods

**Field**:
The part of a region where enemies roam.
_Avoid_: Wilderness, combat zone

**Boneyard**:
The field where Skeletons roam.
_Avoid_: Graveyard, dungeon

**Smithy**:
The part of the village where the furnace, anvil and Blacksmith stand.
_Avoid_: Forge, workshop

**Bush**:
A spot in a thicket that can be foraged; it runs out after use and grows back over time. Comes in two kinds: a **berry bush** anyone can pick, and a **herb bush** that needs a higher Foraging level.
_Avoid_: Node, resource, plant

**Vein**:
A spot in the world that can be mined for ore; it runs out after use and grows back over time. A vein is not a rock, which is a prop.
_Avoid_: Ore rock, node, resource

**Furnace**:
A fixed spot where a player turns ore into bars.
_Avoid_: Smelter, forge

**Anvil**:
A fixed spot where a player turns bars into gear.
_Avoid_: Forge, workbench

**Station**:
A furnace or an anvil: a fixed spot where a player makes something. It never runs out, and any number of players can share one. The Blacksmith is not a station.
_Avoid_: Workstation, crafting table

**Blacksmith**:
A fixed character who gives players the tools they don't have yet, for free. Not an enemy, and the only such character.
_Avoid_: NPC, shopkeeper, vendor

**Prop**:
A fixed piece of scenery on a tile that players can't interact with, such as a tree or a rock. Some block walking and some don't. A bush is not a prop.
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

**Leash**:
How far an enemy follows a player who walks away from a fight, before it gives up, walks home and recovers.
_Avoid_: Aggro range, chase radius

**Tick**:
The fixed step the world moves in; every move, swing, pick and timer happens on a tick.
_Avoid_: Frame, turn, cycle

### Skills

**Skill**:
A trainable ability with its own experience and level, raised by doing the matching activity.
_Avoid_: Stat, attribute, profession

**Total level**:
The sum of a player's levels across the 23 registered skills, at most 2,277. Combat and Foraging don't count: they are replaced when they split.
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
How much damage a player can still take before dying; at most 100 for each Hitpoints level.
_Avoid_: Hitpoints (that's the skill), life

**Defense**:
The skill that makes a player harder to hit; trained by being attacked, whether the swing lands or misses.
_Avoid_: Armour, defence

**Blocking**:
The skill that makes a shield block more often; trained by blocking. It doesn't decide who can use a shield.
_Avoid_: Shield skill, parry

**Block**:
When a shield stops an enemy's hit that would have landed, so it does no damage. Only a player with a shield can block.
_Avoid_: Parry, dodge, miss

**Foraging**:
The skill trained by picking food from bushes; the food heals when eaten.
_Avoid_: Gathering, herbalism

**Mining**:
The skill trained by taking ore from veins and smelting it into bars at a furnace.
_Avoid_: Gathering, quarrying

**Gathering skill**:
A skill trained by taking items from a **site**, a spot that runs out and grows back: Foraging from bushes, Mining from veins. It names the family, and is no other name for either skill.
_Avoid_: Resource skill, harvesting

**Smithing**:
The skill trained by turning bars into gear at an anvil. Smelting ore into bars is Mining.
_Avoid_: Crafting, forging

### Players

**Account**:
A friend's login: a username and password. Each account has exactly one player, who goes by the account's username.
_Avoid_: User, profile, character slot

**Invite code**:
The one shared secret a friend must give to create an account.
_Avoid_: Referral, key

**Action**:
The one thing a player is currently doing (walking, foraging, mining, smithing or fighting); a new click replaces it.
_Avoid_: Task, job, activity

**Inventory**:
The fixed set of slots a player carries items in. A slot holds one piece of gear, or a stack.
_Avoid_: Bag, backpack

**Stack**:
Up to 20 of the same material or food in one inventory slot. Gear doesn't stack.
_Avoid_: Pile, bundle

**Chat command**:
A chat line that starts with `/`, such as `/pm`. The server reads it as an instruction instead of saying it aloud. Most mistakes get a line in the sender's own chat box only; a line past the length limit is dropped without one.
_Avoid_: Slash command

**Online**:
Said of a player whose character is in the world, including one whose connection dropped while a combat lock holds them there. A login still waiting to enter the world is not online yet. Private messages, follow and the friends list all use this one meaning.
_Avoid_: Connected, logged in

**Private message**:
A chat line sent with `/pm <name> <message>` to one online player. It shows in the sender's chat box (`To <name>:`) and in that player's (`From <name>:`), unless that player ignores the sender, and nowhere else, never over anyone's head.
_Avoid_: PM (outside the command), whisper, DM

**Friends list**:
The accounts a player has added with `/friend <name>` and not removed with `/unfriend <name>` or `/ignore <name>`, kept on the server across logins. Adding is one-sided: the friend is not asked or told. The social panel (O) shows each friend as online or offline, and the player's chat box gets a line when a friend logs in or out.
_Avoid_: Buddy list, contacts

**Ignore list**:
The accounts a player has added with `/ignore <name>` and not removed with `/unignore <name>`, kept on the server across logins. The server drops their public chat and private messages before they reach this player, and the ignored player is not told: they still see their own lines. Ignoring a friend takes them off the friends list. The social panel (O) lists the names, with no status.
_Avoid_: Block list, mute

**Follow**:
An action started with `/follow <name>`: the player walks after another online player at walking speed and stops on a tile next to them, never on theirs. The target is not told. It ends with `/unfollow`, a new walk, gather or fight, the death of either player, the target logging out, or the target adding the follower to their ignore list. A dead target, or one who has the follower on their ignore list, cannot be followed, and the refusal does not say why.
_Avoid_: Trail, shadow

**Player menu**:
What right-clicking another player opens at the cursor: Trade, Follow, Attack, Examine, Message and Duel, in that order. Follow sends `/follow <name>`, with the same errors. Message types `/pm <name> ` into the player's chat box and sends nothing. Examine prints the other player's name and combat level in the player's own chat box. Trade, Attack and Duel answer with a refusal in the player's own chat box until Phase 12 lifts it where its rules allow. Right-clicking yourself opens nothing.
_Avoid_: Context menu, player options

**Drop**:
Moving everything in one inventory slot onto the tile the player stands on, where it becomes a ground item. It is the only way to empty a slot.
_Avoid_: Discard, destroy, delete

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
An item that heals the player who eats it, over the next few ticks rather than all at once; berries and herbs are food.
_Avoid_: Consumable, potion

**Healing pool**:
The health a player's eaten food has yet to give back, as healing ticks waiting in eating order. Each food gives its own amount per healing tick, one food's ticks at a time, so more food heals for longer but not faster.
_Avoid_: Heal over time, buff

**Material**:
An item that goes into making something: ore, finds, bars and Emberbones. Gems count as materials before anything uses them.
_Avoid_: Resource, ingredient

**Ore**:
The raw metal a player takes from a vein. A successful mine gives 1 or 2.
_Avoid_: Rock, stone

**Find**:
A material a vein sometimes gives along with its ore on a successful mine: tin from Copper and Iron veins, coal from Iron veins, and gems from Emberite veins. A find is always 1.
_Avoid_: Drop, extra, byproduct, bonus

**Gem**:
A rare find from an Emberite vein: Ashstone, Cinderglass or Heartflame, rarest last. Nothing uses gems yet.
_Avoid_: Jewel, stone

**Bar**:
Metal made at a furnace from ore, plus a find for Bronze (tin) and Steel (coal), ready to become gear at an anvil.
_Avoid_: Ingot

**Emberbone**:
Loot from a Skeleton, needed to make Emberite gear. Each player who damaged the Skeleton has their own chance at one.
_Avoid_: Trophy, token

**Gear**:
What a player equips to fight better: a weapon, which raises how hard they hit, a shield, which gives them a chance to block, or armour. It never wears out.
_Avoid_: Equipment

**Armour**:
Gear worn on the body that reduces the damage of hits that land, by a percentage. It doesn't make a hit less likely to land: that's Defense.
_Avoid_: Protection, plate

**Gear slot**:
Where a piece of gear goes when it is equipped, out of the inventory. A player has ten: weapon, shield, head, body, legs, hands, feet, cape, neck and ring.
_Avoid_: Equipment slot

**Character sheet**:
The panel a player opens to see their gear slots, Toolbelt and all their skills.
_Avoid_: Equipment screen, paper doll

**Pinned skill**:
A skill a player has chosen to show on the bottom bar, up to six. Every skill always shows on the character sheet, pinned or not.
_Avoid_: Favourite skill, tracked skill

**Smithing panel**:
The panel a player opens by clicking a furnace or anvil, to choose what to make there.
_Avoid_: Crafting menu, recipe list

**Social panel**:
The panel a player opens with O or the Social button on the bottom bar. It has two tabs: the friends list, with each friend shown online or offline, and the ignore list, with an Unignore button beside each name.
_Avoid_: Friends panel, friends window

**Tier**:
One of the five metals, from lowest to highest: Copper (1), Bronze (5), Iron (10), Steel (15) and Emberite (20). A tier's bars and gear, and its ore where it has veins, all share its level gate. Only Copper, Iron and Emberite have veins; Bronze and Steel bars are smelted from another tier's ore and a find.
_Avoid_: Grade, rank

**Tool**:
What a player must own to do some work: a pickaxe for Mining, a hammer at an anvil. A tool is never lost and takes no inventory slot.
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
