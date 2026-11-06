# Where the item icons come from

Research for [#49](https://github.com/DeRusto/runic/issues/49), part of the [second slice map](https://github.com/DeRusto/runic/issues/36). Checked on 2026-11-06. Nothing here was added to the client.

## Short answer

- **Rendering icons from the game's own 3D models works.** A throwaway page rendered every item below to a transparent PNG with three.js 0.187, and all 17 read at the real 36px slot size. One is weak: the Emberite sword.
- **The owner's packs have a model for every item but the Emberbone.** That includes bars and ore: KayKit Resource Bits has `Copper_Bar`, `Iron_Bar` and nuggets, so the ticket's "no pack has these items" no longer holds. The catalogue lists them as models. All are CC0, confirmed in each pack's licence file.
- **No 2D pack covers the list.** Kenney's Voxel Pack comes closest, with ores, swords, picks and hammers, but it has no bars, shields, berries or herbs and its own colour tiers.
- **Emberite and the Emberbone have no ready art.** Emberite is an invented metal, so its ore and bar are tinted Iron models. The Emberbone is a tinted bone built from a few lines of three.js geometry.
- **Recommendation:** render once with a small dev-only page and commit the PNGs, as the Spider was converted once and committed (ADR 0003). That costs about 200 KB of PNGs, about 150 lines of page, no new dependency, and a re-run when a model or tint changes. The decision is the owner's.

## The items

Taken from [#37](https://github.com/DeRusto/runic/issues/37), [#39](https://github.com/DeRusto/runic/issues/39), [#42](https://github.com/DeRusto/runic/issues/42), [#43](https://github.com/DeRusto/runic/issues/43), [#45](https://github.com/DeRusto/runic/issues/45), [#46](https://github.com/DeRusto/runic/issues/46) and `shared/src/foraging.ts`. That is 17 icons:

| Family | Items | Where it shows |
|---|---|---|
| Ore | Copper, Iron, Emberite | Inventory, Smithing panel |
| Bars | Copper, Iron, Emberite | Inventory, Smithing panel |
| Swords | Copper, Iron, Emberite | Inventory, weapon gear slot, Character button, Smithing panel |
| Shields | Copper, Iron, Emberite | Inventory, shield gear slot, Character button, Smithing panel |
| Tools | Pickaxe, hammer | Toolbelt only; no right-click menu |
| Food | Berry, herb | Inventory (`BUSHES`, `FOOD_HEALS`) |
| Drop | Emberbone | Inventory, Smithing panel |

The Smithing panel's rows may not need icons: [#45](https://github.com/DeRusto/runic/issues/45) lists name, cost, counts, level and buttons. The Toolbelt's future tools are not in this list.

## What fits, item by item

Paths are relative to `C:/Users/derus/Game Assets`. "Fit" is what I saw in the rendered PNGs, on the client's `#151b25` slot at 36px and on a brown panel at 72px.

| Item | Source model | Treatment | Licence | Fit at 36px |
|---|---|---|---|---|
| Copper ore | `resource-bits/KayKit_ResourceBits_1.0_FREE/Assets/gltf/Copper_Nuggets.gltf` | As it comes | CC0 | Good: a cluster of orange lumps |
| Iron ore | same folder, `Iron_Nuggets.gltf` | As it comes | CC0 | Good: grey-blue lumps |
| Emberite ore | `Iron_Nuggets.gltf` | `#7a2a22`, glow `#ff4a10` | CC0 | Good: dark red, clearly not copper |
| Copper bar | same folder, `Copper_Bar.gltf` | As it comes | CC0 | Good: the clearest family |
| Iron bar | same folder, `Iron_Bar.gltf` | As it comes | CC0 | Good |
| Emberite bar | `Iron_Bar.gltf` | `#7a2a22`, glow `#ff4a10` | CC0 | Fair: nearest neighbour to the copper bar, separated by colour alone |
| Copper sword | `KayKit_FantasyWeaponsBits_1.0_FREE/Assets/gltf/sword_A.gltf` | [#39](https://github.com/DeRusto/runic/issues/39) tint over a grey atlas | CC0 | Good |
| Iron sword | same folder, `sword_B.gltf` | [#39](https://github.com/DeRusto/runic/issues/39) tint | CC0 | Good |
| Emberite sword | same folder, `sword_C.gltf` | [#39](https://github.com/DeRusto/runic/issues/39) tint and glow | CC0 | **Weak:** a thin dark blade on a dark slot. A 1px light CSS `drop-shadow` helps but doesn't cure it |
| Copper shield | same folder, `shield_A.gltf` | [#39](https://github.com/DeRusto/runic/issues/39) tint | CC0 | Good, though plain |
| Iron shield | same folder, `shield_B.gltf` | [#39](https://github.com/DeRusto/runic/issues/39) tint | CC0 | Good: the strongest shape |
| Emberite shield | same folder, `shield_C.gltf` | [#39](https://github.com/DeRusto/runic/issues/39) tint and glow | CC0 | Good |
| Pickaxe | `KayKit_RPGToolsBits_1.0_FREE/Assets/gltf/pickaxe.gltf` | As it comes | CC0 | Good |
| Hammer | same folder, `hammer.gltf` | As it comes | CC0 | Good |
| Berry | `kenney-game-assets/3D assets/Food Kit/Models/GLB format/grapes.glb` | As it comes | CC0 | Good, but it is a bunch of grapes. `cherries.glb` and `strawberry.glb` also read well |
| Herb | `stylized-nature-megakit/glTF/Plant_1.gltf` | As it comes | CC0 | Good: green leaves. `Fern_1.gltf` also reads; `Clover_1.gltf` is too spindly |
| Emberbone | None; built in the render page | Tint `#7a2a22`, glow `#ff4a10` | Our own code | Good: reads at once as a bone |

Long items lean corner to corner so they fill a square slot.

### Licences confirmed

Each from the licence file inside the pack, which all state CC0 1.0:

| Pack | File | Version |
|---|---|---|
| KayKit Resource Bits | `resource-bits/KayKit_ResourceBits_1.0_FREE/License.txt` | 1.0 |
| KayKit Fantasy Weapons Bits | `KayKit_FantasyWeaponsBits_1.0_FREE/License.txt` | 1.0 |
| KayKit RPG Tools Bits | `KayKit_RPGToolsBits_1.0_FREE/License.txt` | 1.0 |
| KayKit Restaurant Bits | `restaurant-bits/KayKit_Restaurant_Bits_1.0_FREE/License.txt` | 1.0 |
| Kenney Food Kit | `kenney-game-assets/3D assets/Food Kit/License.txt` | 2.0 |
| Kenney Survival Kit | `kenney-game-assets/3D assets/Survival Kit/License.txt` | 2.0 |
| Kenney Space Kit | `kenney-game-assets/3D assets/Space Kit/License.txt` | 2.0 |
| Quaternius Stylized Nature MegaKit | `stylized-nature-megakit/License_Standard.txt` | Free subset |
| Quaternius Fantasy Props MegaKit | `fantasy-props-megakit/License_Standard.txt` | Free subset |
| Kenney Voxel Pack | `kenney-game-assets/2D assets/Voxel Pack/License.txt` | 1.0 |
| Kenney Voxel Expansion Pack | `kenney-game-assets/2D assets/Voxel Expansion Pack/License.txt` | 1.0 |
| Kenney Generic Items | `kenney-game-assets/2D assets/Generic Items/License.txt` | #1 |
| Kenney Scribble Dungeons | `kenney-game-assets/2D assets/Scribble Dungeons/License.txt` | 1.0 |
| Kenney Cursor Pack | `kenney-game-assets/UI assets/Cursor Pack/License.txt` | 1.1 |
| Kenney Medieval Weapons | `kenney-game-assets/Early access/Medieval Weapons/License.txt` | 0.1 |

The Devil's Work.shop RPG pack has no licence text: its `ReadMe.txt` points to [its itch.io page](https://devilsworkshop.itch.io/low-poly-3d-and-pixel-2d-rpg-game-assets), which states CC0 1.0 and matches the catalogue. I read that page through a summarising fetch, not by eye.

## The 2D alternatives

Viewed on a contact sheet at 64px. None is recommended, but they are real fallbacks.

| Pack | Has | Lacks | Fit |
|---|---|---|---|
| Kenney Voxel Pack, `2D assets/Voxel Pack/PNG/Items/` (128px) | `ore_iron`, `ore_ironAlt`, `ore_gold`, `ore_ruby`; `sword_bronze`, `sword_iron`, `sword_gold`; `pick_iron`, `hammer_iron` | Bars, shields, berry, herb | The best 2D look, flat and clear. Its tiers don't match ours: `ore_iron` is green, `sword_bronze` is wood-brown |
| Kenney Voxel Expansion, `2D assets/Voxel Expansion Pack/PNG/Retina/` | `item_toolPickaxe`, `item_toolHammer`, `item_toolSword` | Everything else | Red-headed, matching none of our art |
| Kenney Generic Items, `2D assets/Generic Items/PNG/Colored/` | `genericItem_color_101` (bone), `_021` (pickaxe), `_023` (sledgehammer) | Almost everything; it is a modern office and household set | The bone would serve an Emberbone if tinted. Sizes vary from 20 to 174px |
| Kenney Scribble Dungeons, `2D assets/Scribble Dungeons/PNG/Double (128px)/Items/` | `weapon_sword`, `weapon_longsword`, `weapon_hammer`, `shield_curved`, `shield_straight` | Everything else | White ink silhouettes, and the shields read as bars seen edge-on |
| Kenney Cursor Pack, `UI assets/Cursor Pack/PNG/Basic/Double/` | `tool_pickaxe`, `tool_hammer`, `tool_sword_a` | Everything else | White silhouettes. Cursors, not items |
| Kenney Survival Kit previews, `3D assets/Survival Kit/Previews/` | `tool-pickaxe.png`, `tool-hammer.png` | Everything else | Ready-made renders at 64px, with a blue-grey look unlike KayKit's |
| Kenney Food Kit previews, `3D assets/Food Kit/Previews/` | `grapes.png`, `cherries.png`, `strawberry.png` | No herb; `leek.png` and `salad.png` are the nearest | Good and usable as they stand, at 64px |
| Kenney Medieval Weapons previews, `Early access/Medieval Weapons/Previews/` | `sword-a` to `-c`, `shield-round-a`, `-b`, `hammer-a` | Everything else | Small in frame, and version 0.1 may change |
| Devil's Work.shop RPG pack, `LowPoly_Pixel_RPG_Assets_devilsworkshop_v02/2D/view-Ortho/images/` | `Sword0000`, `shield0000`, `hammer0000`, `skull0000`, `gem0000` | Bars, ore, tiers, food | Darker and heavier than KayKit. The catalogue called it a possible icon source; it has only a few of our items |

Mixing these would give three or four art styles in one inventory. `Isometric Medieval Pack` has no items: its sprite folders are buildings, roads, rivers, towers and walls. `fantasy-props-megakit` has `Sword_Bronze`, `Pickaxe_Bronze` and `Shield_Wooden` models, which I did not render because KayKit's are already decided for gear.

## What is missing altogether

- **An Emberite look.** Nothing in any pack is Emberite. Its ore and bar need a tint over a greyed Iron model, the same trick [#39](https://github.com/DeRusto/runic/issues/39) uses on gear.
- **A bone item model.** The only bone model is Space Kit's `bones.glb`, which is a scatter of ribs and claws, unlike a single drop. `fish-bones.glb` and `meat-ribs.glb` in the Food Kit are food. A tinted Generic Items `_101` is the 2D fallback.
- **A true berry or herb.** The Food Kit has fruit, and the Stylized Nature kit has plants. None is labelled as either, and the owner may prefer `cherries` or a different plant.

I didn't search the web, because the packs leave no gap that needs it. `game-icons.net` was not checked; the ticket notes that it is CC BY, which would need attribution.

## Would rendering from the 3D models work?

**Yes.** I built a throwaway page outside the repo and ran it in the desktop app's browser pane.

### What the proof did

It loaded each model with the client's `GLTFLoader` from three.js 0.187, the version in `client/package.json`. It used the hemisphere and sun colours and intensities from `client/src/scene.ts`, with the sun moved in front of the item. It framed each model by its screen bounds in an orthographic camera at 144×144, rendered with a transparent background, and saved a PNG. Tints used the grey atlas code from `client/prototype-gear/main.ts` on `prototype/gear-look-and-swing`.

Observed on the owner's machine (Intel Arc through ANGLE and D3D11), serving files from localhost, for 26 test renders:

| Measure | Result |
|---|---|
| Loading one model | 14–103 ms; most 22–40 ms |
| Drawing one icon | 2–9 ms, except 30–130 ms the first time each kind of material compiles its shaders |
| Encoding one PNG | 4–97 ms; most 8–60 ms |
| The whole run, including saving each PNG | 2.7 s |
| PNG size at 144px | 4.5–21 KB; the recommended 17 total 202 KB |
| Console errors | None |

### What each item has

| Item | Model? | Note |
|---|---|---|
| Swords, shields | Yes | Tints and models decided in [#39](https://github.com/DeRusto/runic/issues/39) |
| Pickaxe, hammer | Yes | Already needed in the hand |
| Ore, bars | Yes | Copper and Iron as they come; Emberite is tinted Iron |
| Food | Yes, from packs that aren't otherwise shipped | See the table above |
| Emberbone | No | Four knobs and a cylinder, about 8 lines of three.js |

### Tier tinting

The [#39](https://github.com/DeRusto/runic/issues/39) values carried over directly, and copper, iron and Emberite separate clearly on swords and shields. The glow of 0.15 can't be seen at icon size, so it costs nothing and adds nothing. As in-hand gear, the tint colours the handle as well as the blade.

### Three ways to do it

| | Render once, commit PNGs | Render at build time | Render in the browser at load |
|---|---|---|---|
| Runs | A dev-only page, by hand, when art changes | Every `npm run build` | Every player's load |
| New dependency | None | A headless browser such as Playwright, because Node has no WebGL | None |
| Extra for players | About 202 KB of PNGs, loaded as needed | The same | Every model. Ore, bars and food aren't otherwise shipped: about 160 KB, plus 2.6 MB for `Leaves.png` if the herb is `Plant_1` |
| Slots while loading | Normal `<img>` | Normal `<img>` | Empty or placeholder until models load |
| Risk | PNGs can go stale against models | CI needs a GPU or software WebGL, which is unverified | A second WebGL context, or the catch below |
| Fits ADR 0003 | Yes: the UI stays HTML, and art is converted once and committed, like the Spider | Yes | Yes, but more moving parts in the client |

**The catch with render targets.** A `WebGLRenderTarget` on the client's shared renderer stays in linear colour. The raw sample came out far too dark, and converting linear to sRGB by hand fixed it. Pixels read back bottom-up, so the page also flips them; I wrote that in from the start and did not see it fail. A separate small `WebGLRenderer` with `alpha: true` needs neither fix. That makes it the simpler choice, but it adds a second WebGL context if used in the live client.

**How it fits the client.** `client/index.html` styles `#slots > button` at 36×36, and `client/src/bottomBar.ts` sets each slot's `textContent` to the item's id. Any of these routes means an `<img>` per item keyed by that id, with the same work in either case. The stack count from [#46](https://github.com/DeRusto/runic/issues/46) sits over the image.

## Recommendation

**Render once with a dev-only page and commit the PNGs.** This is a recommendation; the decision is the owner's.

- **What to build:** turn the proof into a page under `client/` that the production build leaves out, as the prototypes do, listing items, models, tints and leans, using a separate `WebGLRenderer`. It renders each icon and downloads the PNGs, which go in `client/public/`.
- **Cost:** about 150 lines of page, 17 PNGs totalling about 200 KB, and a licence copy beside them as `client/prototype-gear/assets/License.txt` does. No new dependency, and players download nothing extra to see an icon. A model or tint change needs a manual re-run.
- **Why not at load:** it spends players' time and bandwidth to produce pictures that never change, and leaves slots empty until models arrive.
- **Why not at build:** a headless browser in CI is a heavy dependency for files that change rarely.
- **Fallback:** if an icon disappoints, it can be replaced by a 2D image without touching anything else, since the client only sees a PNG.

Choices left for the owner, all quick to re-render:

1. **Emberite sword.** It is the weak icon. Options are a light CSS outline, a brighter icon-only tint, or accepting it. `sword_C` itself was chosen in [#39](https://github.com/DeRusto/runic/issues/39).
2. **The berry and herb.** I used `grapes` and `Plant_1`; `cherries` and `Fern_1` are good alternatives. The bushes in the world are tinted pink and pale blue (`BUSH_TINT` in `client/src/regionMeshes.ts`), and neither icon matches that.

## Not verified

- **Nothing ran in the real client.** The proof was a standalone page. The sheet, bar, Character button and stack-count overlay were not tried with these icons.
- **The owner hasn't seen these icons.** The fit judgements above are mine.
- **The proof's PNGs aren't committed**, per the ticket, so anyone building this renders them again.
- **Other machines.** Timings are from one Intel Arc machine over localhost. Nothing was tested on a phone, a weak GPU or a real network, and render-at-load figures would be slower there.
- **Build-time rendering wasn't run.** That it needs a headless browser, and that CI might lack WebGL, is reasoning, not a test.
- **A second WebGL context alongside the client's was not tried** while the client's animation loop runs.
- **HiDPI.** The browser pane ran at a device pixel ratio of 1.5. 144px should cover a 36px slot at any ratio and a 72px one at 2×, but only the pane's ratio was seen.
- **The "160 KB at load" figure** adds up file sizes on disk, uncompressed: the nuggets and bars with their atlas, plus `grapes.glb` and `Plant_1`.
- **The web.** No icon pack outside the owner's folder was opened.
- **Kenney in full.** I searched all image filenames across the packs for these items and viewed the matches, not all 92,000 files. A fitting image under an unrelated name could have been missed.

## Method note

Items came from the issues' resolution comments. The catalogue was read through the docs connector, and its Kenney notes said the 2D icon packs hadn't been viewed, so I built contact sheets of the candidates and viewed them. Licences were read from each pack's licence file. Rendered icons were viewed on the proof page at 36px and 72px, with some PNGs opened individually. Pack folders were only read. The proof page, server and PNGs stayed in the session's scratchpad, and no art was committed.
