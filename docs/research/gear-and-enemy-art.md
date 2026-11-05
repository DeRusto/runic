# What art exists for gear and new enemies

Research for [#38](https://github.com/DeRusto/runic/issues/38), part of the [second slice map](https://github.com/DeRusto/runic/issues/36). Checked on 2026-11-05. Nothing here was added to the client.

## Short answer

- **Weapons:** yes, free and CC0. The KayKit Adventurers pack has separate weapon models. They parent rigidly to the `handslot.l` and `handslot.r` joints, which both shipped characters have and every shipped clip animates.
- **Armour:** partly. Each character is split into mesh pieces, so the Knight's helmet, visor and cape and the Barbarian's bear hat can be shown or hidden without swapping the whole character. **No body armour art exists** in the pack. Shields are the other visible defence.
- **Swing clips:** we already ship all of them: 1H, 2H, dual-wield, block and unarmed, in `Rig_Medium_CombatMelee.glb`. Only the unarmed idle and punch are used today.
- **Props:** a CC0 anvil exists (Kenney, and KayKit lists one). Ore is covered (Quaternius gold ore, KayKit Resource Bits, or tinted rocks). **I found no CC0 furnace.** The closest stand-ins are a CC0 campfire and a whole CC0 blacksmith building.
- **Harder enemy:** best fit is **KayKit Skeletons** (free, CC0, same joint names as our rig; idle, walk, attack and death confirmed in the file). Second is **Quaternius Animated Dinosaurs** (free, CC0; page states all four, FBX so it needs the Spider's conversion).

## What is committed today

Read from the glTF JSON of each file in `client/public/models/`.

| File | Contents |
|---|---|
| `Knight.glb` (333 KB) | Skinned pieces: `Knight_ArmLeft`, `ArmRight`, `Body`, `Cape`, `Head`, `Helmet`, `HelmetVisor`, `LegLeft`, `LegRight`. 23 joints. No clips, no weapons. One material, embedded `knight_texture`. |
| `Barbarian.glb` (377 KB) | Skinned pieces: `Barbarian_ArmLeft`, `ArmRight`, `BearHat`, `Body`, `Head`, `LegLeft`, `LegRight`. Same 23 joint names. No clips, no weapons. One material. |
| `Rig_Medium_General.glb` (15 clips) | `Death_A`, `Death_A_Pose`, `Death_B`, `Death_B_Pose`, `Hit_A`, `Hit_B`, `Idle_A`, `Idle_B`, `Interact`, `PickUp`, `Spawn_Air`, `Spawn_Ground`, `T-Pose`, `Throw`, `Use_Item` |
| `Rig_Medium_MovementBasic.glb` (11 clips) | `Jump_Full_Long`, `Jump_Full_Short`, `Jump_Idle`, `Jump_Land`, `Jump_Start`, `Running_A`, `Running_B`, `T-Pose`, `Walking_A`, `Walking_B`, `Walking_C` |
| `Rig_Medium_CombatMelee.glb` (22 clips) | See below |
| `Spider.glb` | `Spider_Walk`, `Spider_Idle`, `Spider_Attack`, `Spider_Death`, `Spider_Jump` |

### Weapon clips already shipped

All in `Rig_Medium_CombatMelee.glb`:

- **One-handed:** `Melee_1H_Attack_Chop`, `Melee_1H_Attack_Jump_Chop`, `Melee_1H_Attack_Slice_Diagonal`, `Melee_1H_Attack_Slice_Horizontal`, `Melee_1H_Attack_Stab`
- **Two-handed:** `Melee_2H_Attack_Chop`, `Melee_2H_Attack_Slice`, `Melee_2H_Attack_Spin`, `Melee_2H_Attack_Spinning`, `Melee_2H_Attack_Stab`, `Melee_2H_Idle`
- **Dual-wield:** `Melee_Dualwield_Attack_Chop`, `Melee_Dualwield_Attack_Slice`, `Melee_Dualwield_Attack_Stab`
- **Shield:** `Melee_Block`, `Melee_Block_Attack`, `Melee_Block_Hit`, `Melee_Blocking`
- **Unarmed:** `Melee_Unarmed_Attack_Kick`, `Melee_Unarmed_Attack_Punch_A`, `Melee_Unarmed_Idle`

`client/src/characters.ts` and `client/src/fights.ts` use only `Melee_Unarmed_Idle` and `Melee_Unarmed_Attack_Punch_A`. There is no one-handed idle; `Melee_Unarmed_Idle` or `Idle_A` would have to serve.

No mining or smithing clip is shipped. `Interact`, `PickUp` and `Use_Item` are the nearest. The [KayKit Character Animations page](https://kaylousberg.itch.io/kaykit-character-animations) (free tier, CC0, FBX and glTF) lists a Tool category with digging, fishing and pickaxing, for download later if wanted.

## Weapons

**[KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers).** Licence stated: CC0 1.0, no attribution required; asks that unmodified copies not be resold or claimed as your own. Free tier "name your own price". Paid Extra and Source tiers exist, but weapons are in the free description. Formats: FBX and glTF. The page advertises 25+ weapons and accessories and gives no attachment detail.

The [1.0 GitHub mirror](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) (its `LICENSE.txt` also says CC0) holds separate models in `Assets/gltf/`, each a `.gltf` plus `.bin`:

- **Blades and axes:** `sword_1handed`, `sword_2handed`, `sword_2handed_color`, `axe_1handed`, `axe_2handed`, `dagger`
- **Shields:** `shield_badge`, `shield_round`, `shield_round_barbarian`, `shield_spikes`, `shield_square`, plus `_color` variants
- **Other:** `staff`, `wand`, `crossbow_1handed`, `crossbow_2handed`, `arrow`, `arrow_bundle`, `quiver`, `spellbook_closed`, `spellbook_open`, `smokebomb`, `mug_empty`, `mug_full`

`sword_1handed.gltf` is one unskinned mesh node with no transform. It points at a separate `knight_texture.png`, so weapons need that texture alongside them (or conversion to GLB). The repo already ships `.gltf` and `.bin` props the same way.

### How they attach

- `handslot.l` and `handslot.r` are real joints, children of `hand.l` and `hand.r`, in both committed characters. All 22 combat clips and all 15 general clips key them, so anything parented there follows the swing. The `MovementBasic` clips were not checked for this.
- The 1.0 `Knight.glb` on GitHub embeds its weapons as rigid nodes parented exactly this way, which gives a placement recipe:
  - `1H_Sword` and `2H_Sword` go under `handslot.r`, about 0.033 up, turned 180 degrees around Y.
  - `1H_Sword_Offhand` goes under `handslot.l`, about 0.017 up.
  - The four shields go under `handslot.l`, about 0.017 up and 0.156 along Z.
- **three.js trap:** `GLTFLoader` runs node names through `PropertyBinding.sanitizeNodeName`, which strips dots. At runtime the joints should be named `handslotr` and `handslotl`, not `handslot.r`.

### A second weapon source with built-in tiers

[KayKit Dungeon](https://kaylousberg.itch.io/kaykit-dungeon) (the legacy pack) lists 24 weapons across 3 tiers (swords, shields, axes, hammers, crossbows, staves, daggers). Licence stated: CC0, no attribution. Free. Formats: FBX, OBJ, DAE, glTF. The page says it will not be updated. It has no placement recipe for our rig, so each weapon would need placing by hand.

The cheaper way to get tiers is tinting a material per item in code, the same way the slice tints bushes.

## Armour on the Knight and Barbarian

It does not need whole-character swaps, but it is limited:

- **Show or hide:** `Knight_Helmet`, `Knight_HelmetVisor`, `Knight_Cape` and `Barbarian_BearHat` are separate meshes in the committed files.
- **Shields:** see weapons. They use `Melee_Block*` clips.
- **Tint:** each character has one material and one texture atlas, so tinting a single piece means giving that mesh its own material copy. Tinting the shared material would recolour the whole body.
- **Paid only:** the Adventurers Extra tier adds 3 alternate textures per character, which recolour rather than add armour.
- **Not available:** no body, leg or arm armour exists in the packs I checked. Adding it means new art, or rigid pieces parented to `chest` or `head`. The 1.0 Knight does this with its helmet and cape, and `Skeleton_Warrior_Helmet` is one more rigid helmet, but its fit on our heads is untested.

The Knight and Barbarian share joint names but list them in a different order, so mixing pieces between them would need rebinding by name. I did not test that.

## Props for gathering and making

| Need | Asset | Pack and source | Licence as stated | Format | Cost | Caveat |
|---|---|---|---|---|---|---|
| Ore | Gold ore (Quaternius) | [Poly Pizza](https://poly.pizza/m/i1ic0r7FUI) | Public Domain (CC0) | FBX, glTF | Free | Source pack not shown; one model, so other metals mean tinting |
| Ore | Iron, copper, silver, gold, stone resources | [KayKit Resource Bits](https://kaylousberg.itch.io/resource-bits) | CC0 1.0 | OBJ, FBX, glTF | Free tier (75+ models); paid tiers add gems and more | Page says ingots in a preview caption. Raw ore chunks not confirmed. Free-tier split not itemized |
| Ore | `Rock_1_E`, `Rock_2_C` tinted | Already committed (KayKit Forest Nature, [page](https://kaylousberg.itch.io/kaykit-forest)) | CC0 1.0 | glTF | Free | Tint only, no real ore shape; no new files |
| Ore or stone | `resource_stone`, `rock_single_A` to `E` | [KayKit Medieval Hexagon](https://kaylousberg.itch.io/kaykit-medieval-hexagon), [file list](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0) | CC0 1.0 | FBX, glTF, OBJ | Free | Made for hex tiles; scale unchecked |
| Anvil | Workbench Anvil (Kenney) | [Poly Pizza](https://poly.pizza/m/bY1pp3kAAb), from [Kenney Survival Kit](https://kenney.nl/assets/survival-kit) | CC0 | OBJ, glTF | Free | Kenney's own page does not itemize models; the name comes from the Poly Pizza listing |
| Anvil | Anvil, plus pickaxe and hammer | [KayKit RPG Tools Bits](https://kaylousberg.itch.io/rpg-tools-bits) | CC0 1.0 | OBJ, FBX, glTF | Free tier (45+ models) | Anvil listed for the pack; that it is in the free tier rather than Extra is unconfirmed |
| Anvil | Low poly iron anvil | [OpenGameArt](https://opengameart.org/content/low-poly-iron-anvil) | Search result says CC0 | Zip, format unknown | Free | Page returned 403, so licence not checked at source |
| Furnace | **None found under CC0** | | | | | See stand-ins |
| Furnace stand-in | Campfire | [Survival Kit on Poly Pizza](https://poly.pizza/bundle/Survival-Kit-yGnSPFp2lH) | Public Domain (CC0) | FBX, glTF | Free | Reads as a fire, not a furnace |
| Furnace stand-in | `building_blacksmith_{blue,green,red,yellow}` | KayKit Medieval Hexagon (above) | CC0 1.0 | FBX, glTF, OBJ | Free | A whole building for a hex tile, not a station prop |
| Workbench | Workbench, Workbench Grind | Survival Kit on Poly Pizza (above) | Public Domain (CC0) | FBX, glTF | Free | Could serve as a making station instead of a furnace |

Ruled out as not CC0: [Forge by Don Carson](https://poly.pizza/m/2ZnLsJJL4Pe) and [Anvil by Zsky](https://poly.pizza/m/l14TsgNmIT), both CC BY 3.0. The Forge is the best-looking lead if attribution were ever allowed. [KayKit Restaurant Bits](https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0) has an `oven` model, a kitchen appliance; its licence file was not read.

Checked with nothing suitable: [Quaternius Fantasy Props MegaKit](https://quaternius.com/packs/fantasypropsmegakit.html) (CC0, but no anvil, furnace or ore listed), [KayKit Dungeon Remastered](https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0) and KayKit Furniture Bits (no such files in their trees).

## Creatures

| Candidate | Source | Licence as stated | Format | Cost | Idle, walk, attack, death |
|---|---|---|---|---|---|
| **KayKit Skeletons**: Minion, Warrior, Rogue, Mage | [itch.io](https://kaylousberg.itch.io/kaykit-skeletons), [1.0 mirror](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0) | CC0, no attribution (page and `LICENSE.txt`) | FBX, glTF; GLB in the mirror | Free tier has these four; Extra adds a Golem and a Necromancer | **Confirmed in `Skeleton_Warrior.glb`:** `Idle`, `Walking_A`, `1H_Melee_Attack_Chop`, `Death_A`, among 95 clips |
| **Quaternius Animated Dinosaurs**: Apatosaurus, Stegosaurus, T-Rex, Triceratops, Velociraptor | [itch.io](https://quaternius.itch.io/animated-lowpoly-dinosaurs) | CC0 | FBX, OBJ, Blend | Name your own price | Page states all four plus run and jump. Species come from page tags. Files not inspected |
| **Quaternius Easy Enemy Pack**: Spider's siblings | [quaternius.com](https://quaternius.com/packs/easyenemy.html), [itch.io](https://quaternius.itch.io/animated-easy-enemies) | CC0 | FBX, OBJ, Blend | Free | Page states movement, attack, jump, death. Idle not stated, though our converted Spider has one. quaternius.com says 5 enemies; itch.io tags name six (spider, lizard, rat, frog, wasp, snake) |
| **Quaternius Ultimate Monsters**: 50 monsters | [quaternius.com](https://quaternius.com/packs/ultimatemonsters.html) | CC0 | FBX, OBJ, Blend, glTF | Free | Pack is marked animated; [Sketchfab listing](https://sketchfab.com/3d-models/ultimate-monsters-pack-fd72e114d119488da71fe3a16f216c4f) names attack, death, running, walking. Idle not stated. Clip names unknown |

**Skeletons fit best.** The mirror's `Skeleton_Warrior.glb` has our 23 joint names plus IK helpers, and the itch.io page says the pack was updated to work with KayKit Character Animations. So the shared `Rig_Medium` clips should drive it, and it gets the same weapons and `Melee_*` clips as players. The Skeletons pack also has its own axe, blade, shields, staff and crossbow.

Two costs: the mirror's GLB is 4.9 MB because it embeds its clips, and those clips use older names (`1H_Melee_Attack_Chop`, not `Melee_1H_Attack_Chop`). The Rig_Medium-era download may be smaller and clip-free, as our Knight's is, but I did not inspect it.

A licence conflict to note on Ultimate Monsters: Sketchfab's licence field says CC BY 4.0 while its description says CC0. quaternius.com, the author's own site, says CC0, so use that copy and not Sketchfab's.

## What I could not verify

- **Current itch.io downloads were not opened.** File lists and rig details come from the 1.0 GitHub mirrors, while our committed models are a newer build (23 joints, renamed clips, weapons removed). Weapon file names, and whether the weapons are unchanged, need checking against the current zip.
- **The weapon placement recipe is untested on the committed rig.** Handslot transforms match across the committed files, but I did not compare them with the 1.0 Knight. Nor did I check whether each separate weapon's origin sits at its grip.
- **Nothing was loaded in three.js.** Whether the shared clips play well on Skeletons (bind pose, proportions) is inferred from joint names and the page's claim. The `handslotr` name comes from reading `GLTFLoader` and `PropertyBinding`, not a run.
- **Which models are in each KayKit free tier** is not itemized on the Resource Bits and RPG Tools Bits pages.
- **Paid-tier prices conflict** on KayKit pages (each shows two figures, such as $7.95 and $3.97 for Adventurers Extra). No paid tier is needed for anything recommended here.
- **OpenGameArt's anvil page** refused automated reading.
- **Furnace absence** means none turned up in the packs and searches above, not that none exists anywhere.

## Method note

Licences were read from each pack's own page, and from `LICENSE.txt` in the GitHub mirrors where stated. Poly Pizza pages were used for single-model licences. Clip and joint names were read from glTF JSON: from committed files on disk, and for the two mirror GLBs (`Knight.glb`, `Skeleton_Warrior.glb`) by streaming them into memory and printing only the metadata. No file was saved and no asset was added to the repo.
