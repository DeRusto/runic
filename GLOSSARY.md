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

**Blacksmith**:
A fixed character who gives players the tools they don't have yet, for free. Not an enemy, and the only such character.
_Avoid_: NPC, shopkeeper, vendor

**Prop**:
A fixed piece of scenery on a tile that players can't interact with, such as a tree or a rock. Some block walking and some don't. A bush is not a prop.
_Avoid_: Decoration, doodad, object

**Enemy**:
A creature in a field that players fight to train Combat.
_Avoid_: Mob, monster, NPC

**Spider**:
The one enemy type in the first playable slice: a large spider that fights back only when attacked.
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

**Combat**:
The skill that raises how often and how hard a player hits; trained by dealing damage to enemies.
_Avoid_: Melee, fighting, attack

**Hitpoints**:
The skill that sets a player's maximum health; trained by dealing damage. Players start at level 10.
_Avoid_: HP skill, vitality, constitution

**Health**:
How much damage a player can still take before dying; at most their Hitpoints level.
_Avoid_: Hitpoints (that's the skill), life

**Defense**:
The skill that makes a player harder to hit; trained by being attacked, whether the swing lands or misses.
_Avoid_: Armour, block, defence

**Foraging**:
The skill trained by picking food from bushes; the food heals when eaten.
_Avoid_: Gathering, herbalism

**Mining**:
The skill trained by taking ore from veins.
_Avoid_: Gathering, quarrying

**Smithing**:
The skill trained by turning ore into bars and bars into gear.
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
The fixed set of slots a player carries items in, one item per slot.
_Avoid_: Bag, backpack

**Food**:
An item that heals the player who eats it; berries and herbs are food.
_Avoid_: Consumable, potion

**Ore**:
The raw metal a player takes from a vein.
_Avoid_: Rock, stone

**Bar**:
Metal made from ore at a furnace, ready to become gear at an anvil.
_Avoid_: Ingot

**Emberbone**:
A drop from a Skeleton, needed to make Emberite gear. Each player who damaged the Skeleton has their own chance at one, and it goes straight into their inventory, or is lost if the inventory is full.
_Avoid_: Loot, trophy, token

**Gear**:
What a player equips to fight better: a weapon, which raises how hard they hit, or a shield, which makes them harder to hit. It lasts forever.
_Avoid_: Equipment, armour, loot

**Tier**:
One of the three metals, from lowest to highest: Copper, Iron and Emberite. A tier's ore, bars and gear all share its level gate.
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
