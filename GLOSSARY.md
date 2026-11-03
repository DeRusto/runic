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

**Enemy**:
A creature in a field that players fight to train Combat.
_Avoid_: Mob, monster, NPC

**Thornback**:
The one enemy type in the first playable slice: a spiny, boar-like beast that fights back only when attacked.

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
The skill trained by fighting enemies.
_Avoid_: Melee, fighting

**Foraging**:
The skill trained by picking food from bushes; the food heals when eaten.
_Avoid_: Gathering, herbalism

### Players

**Action**:
The one thing a player is currently doing (walking, foraging or fighting); a new click replaces it.
_Avoid_: Task, job, activity

**Inventory**:
The fixed set of slots a player carries items in, one item per slot.
_Avoid_: Bag, backpack

**Food**:
An item that heals the player who eats it; berries and herbs are food.
_Avoid_: Consumable, potion

**Respawn**:
Returning to the village with everything kept, after dying.
_Avoid_: Revive, resurrect

**Combat lock**:
The short time after combat during which a player cannot log out.
_Avoid_: Logout timer, combat tag
