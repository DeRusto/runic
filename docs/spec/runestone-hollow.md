# Runic: Runestone Hollow

**Status: draft.** Terms are defined in `GLOSSARY.md`. The owner settled the decisions here in conversation on 2026-11-16. One open question is left at the end.

This spec adds to the [second slice spec](second-slice.md) and the [village spec](village.md). Everything there still holds unless a section here changes it. Where a number is given, it is a first value to tune in play.

## 1. What changes

The region grows east and south. Runestone Hollow, a ruined valley east of the Boneyard, takes the new east land, and the rune altar moves there from the Boneyard's far side. The Hollow has its own enemies (Skeleton Mages and a few Imps), an old runekeeper whose quest opens the altar, and essence rocks that give rune essence. Odo's essence quest changes to match: each vein tier gives its own quest essence while it runs. The town's south road runs on to a locked gate, and the land past it stays empty for areas still to come.

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
- **Essence rocks.** A new site kind, mined with a pickaxe like a vein. Five are active at once in a site pool inside the Hollow, the same count as the Emberite pool next door, and they need Mining 20, Emberite's level. They run out and regrow like veins, and pay Mining experience. Each success gives rune essence, and while the runekeeper's quest runs it can also give that quest's essence (section 4).
- **The runekeeper.** An old hermit who has tended the stones for years. They stand near the altar, explain runes in a quiet, cryptic voice and give the Runecrafting quest (section 4).
- **Enemies.** Skeleton Mages and a few Imps (section 5).

### The old stone circle

The altar and its stones leave the Boneyard. The rock ring around their old tiles (85–87, 43–45) stays as a ruin, and the altar tiles go back to ashen ground. Odo's lines that send players to "the old stone circle out on the Boneyard's far side" change to send them to Runestone Hollow.

## 4. The essence quests

Runecrafting opens through two quests in a row: Odo's, which teaches what essence is, and the runekeeper's, which opens the altar. In both, mining gives a quest essence that exists only for that quest while it runs.

### Odo's essence quest, reworked

Today Odo asks for one piece of the strange material that any vein drops by chance, then for three more, which his lines say should come from copper, iron and emberite, though nothing checks the tier. The rework makes the tiers real:

- The quest still starts with the strange material. Every vein keeps rolling it as a rare find, as it does today, and a player has to find a piece and bring it to Odo before he will say what it is. Odo still offers the quest only once the forge quest and its repeats are done.
- Handing over that piece moves the quest to its proof stage, which now asks for one quest essence from each vein tier: Copper essence, Iron essence and Emberite essence.
- While the proof stage runs, each successful mine on a tier whose essence the player still needs has a 1 in 5 chance to give it. The chance stops once the player holds that tier's essence.
- Handing all three to Odo finishes the quest. It still gives its quest point and still teaches identification, so veins give rune essence instead of strange material from then on, as they do today.
- The journal shows which tiers' essence the player still needs.

### The runekeeper's quest

- The runekeeper offers it once Odo's essence quest is done. It asks for Hollow essence, mined from the essence rocks, and an item that Skeleton Mages drop.
- While it runs, each successful mine on an essence rock can also give Hollow essence, the same way the veins give Odo's quest essence. The count asked for and the chance are set when it is built.
- Finishing it gives a quest point, shows in the journal like Odo's quests and opens the altar. Until then the altar refuses a click with "You need to help \<runekeeper\> first.", using the station's existing `quest` field, as the furnace and anvil do with Odo's quest.

## 5. Enemies

- **Skeleton Mage.** From KayKit Skeletons, the pack the Boneyard's Skeletons come from, so it shares their rig and animation clips. It fights up close like every enemy today, with harder hits than a Skeleton, and it drops the item the runekeeper's quest asks for. Ranged attacks wait for Phase 8's Ranged work.
- **Imp.** From the Bestiary kit, weaker than a Skeleton Mage. The Bestiary kit is not CC0: its licence allows committing it as part of Runic but not redistributing it alone, so its files go under `client/public/` and get an entry in `client/public/LICENSE.txt`, as that notice requires.
- The Hollow holds four Skeleton Mages and three Imps, fewer than the Boneyard's six Skeletons since each Mage is tougher. They respawn the way Skeletons do.
- Their homes are inside the Hollow, and their reach (home, wander, notice range and leash) must keep them out of the Emberite pocket and off the gap, so a player mining Emberite is never pulled into a fight with them.
- Their other stats and drops are set when they are built, against the Skeleton's.

## 6. The south road and its gate

- The town's south road, which stopped at y 56, runs on to a double gate across both its tiles (18–19, 63) in the old south border, and a short way past it into the new south band.
- The gate is a new kind of feature that blocks walking until it opens. For now nothing opens it, and clicking it says "The gate is locked." and nothing more. What unlocks it is designed together with the areas behind it.
- The land past the gate is plain and empty until those areas are designed.

## 7. Glossary changes

- **Runestone Hollow**: new entry. The ruined valley east of the Boneyard where the altar stands.
- **Altar**: its entry moves the altar to Runestone Hollow and says the runekeeper's quest opens it; the walk is still part of the gate.
- **Boneyard**: unchanged ("The field where Skeletons roam."), and the Hollow is not part of it.
- **Strange material**: unchanged; finding a piece still starts Odo's essence quest.
- **Quest essence**: new entry. An essence that mining gives only while its quest runs: Copper, Iron and Emberite essence for Odo, and Hollow essence for the runekeeper.
- **Essence rock**, **Skeleton Mage**, **Imp** and the runekeeper: new entries when they are built.

## 8. Open question

1. What is the runekeeper's name? The rest of the character is settled: an old hermit who tends the stones.
