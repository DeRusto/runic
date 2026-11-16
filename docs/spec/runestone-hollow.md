# Runic: Runestone Hollow

**Status: draft.** Terms are defined in `GLOSSARY.md`. The owner settled the decisions here in conversation on 2026-11-16; the open questions at the end still need an answer before building.

This spec adds to the [second slice spec](second-slice.md) and the [village spec](village.md). Everything there still holds unless a section here changes it. Where a number is given, it is a first value to tune in play.

## 1. What changes

The region grows east and south. Runestone Hollow, a ruined valley east of the Boneyard, takes the new east land, and the rune altar moves there from the Boneyard's far side. The Hollow has its own enemies (Skeleton Mages and a few Imps), a keeper who gives a Runecrafting quest, and essence rocks that always give rune essence. The town's south road runs on to a locked gate, and the land past it stays empty for areas still to come.

The range now stands outside the inn, the town's south-west building, which a separate change already made.

## 2. Growing the region

- The region grows from 96×64 to 128×96 tiles. New columns go on the east and new rows on the south, so every saved tile keeps its coordinates and no saved player moves. Growing north or west would shift every tile, so neither is allowed.
- The new east band (x 96–127) holds the Hollow in its middle rows. The new south band (y 64–95) holds the gate and the land past it. Land in the new bands that belongs to neither is plain grass with scattered trees, like the region's edges today, ringed by the same tree border.
- The Tiled map, its README and the region tests change with the size; the [second slice spec](second-slice.md) still says "about 96×64" and gets a note pointing here.

## 3. Runestone Hollow

### Where it is and how to get there

- The Hollow lies east of the Emberite pocket, roughly x 96–127 and y 28–60. Its exact outline is set when it is painted.
- Its only way in is a gap in the tree line at x 95, on the Emberite pocket's east side. A player therefore crosses the Boneyard and the Emberite pocket to reach it, so the Skeletons still guard the way to the altar, as they do today.
- The Hollow's ground is its own kind, so it reads as a different place from the Boneyard's ashen field: a dark, mossy stone ground. A new ground kind needs a colour in the client and a tile in the tileset.

### What is in it

- **The altar.** The station moves here unchanged in what it does: it turns rune essence into runes, asks no level and never runs out. Its look (the stone slab with a ring stone behind it and an obelisk on each side) moves with it.
- **Ruins.** Standing stones, broken columns and graves, as scenery props that block walking. Candidate models are Kenney's Graveyard and Nature kits, and the low-poly ruin set in the asset folder; the build picks from them and records each pack's licence.
- **Essence rocks.** A new site kind, mined with a pickaxe like a vein, that always gives rune essence, already identified. They sit in a site pool inside the Hollow, run out and regrow like veins, and pay Mining experience. Veins keep rolling the strange material as a rare find, so essence still turns up elsewhere.
- **The keeper.** A villager who stands near the altar, explains runes and gives the Runecrafting quest (section 4).
- **Enemies.** Skeleton Mages and a few Imps (section 5).

### The old stone circle

The altar and its stones leave the Boneyard. The rock ring around their old tiles (85–87, 43–45) stays as a ruin, and the altar tiles go back to ashen ground. Marta's lines that send players to "the old stone circle out on the Boneyard's far side" change to send them to Runestone Hollow.

## 4. The keeper's Runecrafting quest

- The keeper's quest opens the altar, the way Odo's quest opens the furnace and anvil: until it is done, the altar refuses a click with "You need to help \<keeper\> first." This uses the station's existing `quest` field.
- Finishing it gives a quest point and shows in the journal like Odo's quest.
- What the quest asks and what else it rewards are open questions (section 8).

## 5. Enemies

- **Skeleton Mage.** From KayKit Skeletons, the pack the Boneyard's Skeletons come from, so it shares their rig and animation clips. It is tougher than a Skeleton and has its own drop table. Whether it attacks from range is an open question.
- **Imp.** From the Bestiary kit. A few of them, weaker than a Skeleton Mage. The Bestiary kit is not CC0: its licence allows committing it as part of Runic but not redistributing it alone, so its files go under `client/public/` and get an entry in `client/public/LICENSE.txt`, as that notice requires.
- Their homes are inside the Hollow, and their reach (home, wander, notice range and leash) must keep them out of the Emberite pocket and off the gap, so a player mining Emberite is never pulled into a fight with them.
- Their stats and drops are set when they are built, against the Skeleton's.

## 6. The south road and its gate

- The town's south road, which stops near y 57 today, runs on into the new south band and ends at a gate.
- The gate is a new kind of feature that blocks walking until it opens. For now nothing opens it: clicking it says it is locked. What unlocks it is designed together with the areas behind it.
- The land past the gate is plain and empty until those areas are designed.

## 7. Glossary changes

- **Runestone Hollow**: new entry. The ruined valley east of the Boneyard where the altar stands.
- **Altar**: its entry moves the altar to Runestone Hollow and says the keeper's quest opens it; the walk is still part of the gate.
- **Boneyard**: unchanged ("The field where Skeletons roam."), and the Hollow is not part of it.
- **Essence rock**, **Skeleton Mage**, **Imp** and the keeper: new entries when they are built.

## 8. Open questions

1. What is the keeper called, and who are they?
2. What does the keeper's quest ask for, and does it reward anything beyond opening the altar and a quest point?
3. Does a Skeleton Mage attack from range? No enemy attacks from range today, and bows still borrow the sword's numbers until Phase 8, so a yes means new combat work.
4. How many Imps and Skeleton Mages, and how often does each respawn?
5. How many essence rocks are active at once, and what Mining level do they need?
6. Should the south gate say anything more than that it is locked, such as a hint of what lies past it?
