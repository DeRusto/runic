# What Meshy delivers for a three.js client

Research for [#13](https://github.com/DeRusto/runic/issues/13). Read on 2026-11-03 from Meshy's own docs, pricing page, terms and help centre. Each claim is marked **[verified]** (read in a primary source, linked in Sources) or **[inferred]**.

## Short answer

- Meshy exports `.glb` (and FBX, OBJ, USDZ, STL, 3MF). A rigged character comes as a skinned GLB. An animation task returns a GLB with the skeleton, mesh and clip(s) together. **[verified]**
- Up to 10 library animations can go in **one file, one skeleton, one clip per action** (API `action_ids`; web app "All Added"). This is what three.js `AnimationMixer` wants. **[verified]**
- **Humanoids are well covered. Four-legged beasts like the Thornback are not.** The web app can rig a "Quadruped Dog" but gives it only a walk clip. The 680-clip library and Text to Motion are humanoid only. The API rigs humanoids only. **[verified]**
- The humanoid library has everything we need: idle, walk, attack, pick-up/gather, hit and death. **[verified]**
- Low poly: Smart Topology (`meshy-t2`) gives a triangle mesh with a set face count (100 to 15,000). Remesh goes from 100 to 300,000. Textures are 2K at minimum, so we shrink them ourselves. **[verified]** / **[inferred]**
- In the web app, rigging, remesh and animation cost 0 credits. Generation costs 10 to 25 credits. The API charges for every step, for example rigging 5 and animation 3 per clip. **[verified]**
- The API exists and includes rigging and animation, but it needs a paid plan. **[verified]**
- Licence: on the free plan, output is CC BY 4.0 (fine to share, credit Meshy). On paid plans you own the output. Either works for friends; paid is cleaner for a public release. **[verified]**

## Formats and what a `.glb` carries

- Generation: `target_formats` accepts `glb`, `obj`, `fbx`, `stl`, `usdz`, `3mf`. Remesh adds `blend`. **[verified]**
- Rigging returns `rigged_character_glb_url` and `rigged_character_fbx_url`. It also returns `basic_animations` with a walking and a running clip. Each clip comes as a skinned GLB, an FBX and an "armature GLB". **[verified]**
- Animation returns `animation_glb_url` and `animation_fbx_url`. Optional post-processing can change the frame rate (24, 25, 30 or 60 fps; default 30), convert to USDZ or extract the armature as FBX. **[verified]**
- The rigged GLB is a skinned mesh with no clips. The animation GLB holds the skinned mesh plus clips. The "armature GLB" holds the skeleton plus the clip, without the mesh. **[inferred]** from the field names and descriptions. Check this on a real file.
- The web app exports FBX, GLB or USDZ. Its FBX "includes the skeleton and animation data". For humanoids you can choose a skeleton template, with Mixamo as the default. **[verified]**
- Smart Rig (beta, for "creature, robot, or prop") downloads as GLB only. **[verified]**

## One file or one file per clip

- API: send `action_id` for one clip, or `action_ids` (1 to 10 unique IDs) for **one merged file with one clip per action**, in array order. Clip names come from the library. If two names clash, Meshy adds the `action_id` to the later one. **[verified]**
- Web app: Download Settings → Animation → "Current" or "All Added". **[verified]**
- All clips from one rig task share one skeleton. So we can merge files from several tasks into one GLB with glTF-Transform, or load them separately and play them on one `AnimationMixer`. **[inferred]**
- Clip names will be library names like `Idle 3` or `Dead`. Map them to our names (`idle`, `walk`…) in code, or rename them at build time. **[inferred]**
- Root motion vs in-place: **not documented** anywhere I could find. Many clips (`Walk Forward…`, `Charge`, `Knock Down`) may move the root. If so, the client must strip root translation, because the server owns position. **[inferred]**

## Rigs: humanoid vs four-legged

- API Rigging: "works well only" with standard humanoid (bipedal) characters, which must face +Z. Optional `height_meters` (default 1.7). The model must be textured and at most 380,000 triangles. **[verified]**
- Web app Rigging has three types: Humanoid, **Quadruped Dog** ("A four-legged character") and Smart Rig (Beta, no markers). It takes uploads of `.fbx/.obj/.stl/.gltf/.glb` up to 100 MB. **[verified]**
- Quadrupeds come "with a walking animation". "The preset library and Text to Motion are for humanoid characters." Smart Rig models can't use the library. No tail bones are added. **[verified]**
- All 680 library entries have biped preview art, with rig styles `biped`/`style_01..03`. There are no animal clips. **[verified]** (public catalogue JSON)
- **For the Thornback:** Meshy can give it a skeleton and a walk clip. Idle, attack, forage, hit and death would have to be animated by hand in Blender on that skeleton, or we would need a different source. **[inferred]**

## Library clips we need (humanoid)

From the public catalogue (680 entries). IDs are what the API takes. ★ = free on every plan.

| Need | Examples (id: name) |
|---|---|
| Idle | 0: Idle ★, 243–254: Idle 3–14, 89: Combat Idel |
| Walk | -2: Walking ★, 30: Casual Walk ★, 1: Walking Woman ★, 119: Slow Orc Walk ★ (88 walk clips in all) |
| Attack | 4: Attack ★, 105: Triple Combo Attack ★, 97: Left Slash, 237: Charged Axe Chop, 128: Heavy Hammer Swing |
| Forage / gather | 284: Collect Object, 283: Pull Radish, 276: Male Bend Over Pick Up, 278: Female Stand Pick Fruit Basket |
| Hit | 178: Hit Reaction, 179: Hit Reaction 1, 7: BeHit FlyUp ★ |
| Death | 8: Dead ★, 189: Dying Backwards, 187: Knock Down, 188: Fall Dead from Abdominal Injury |

**[verified]**. The free plan gets 22 clips ("20 animations" on the pricing page). Paid plans get "500+". **[verified]**

## Keeping it low poly

- Smart Topology (`model_type: smart-topology`) gives triangle-only output with `target_polycount`. For `meshy-t2` the range is 100–15,000 (default 4,000). For `meshy-t2.5` it is 100–30,000 (default 15,000). **[verified]**
- Remesh API: `topology` is `triangle` or `quad`, and `target_polycount` is 100–300,000. The result "can differ from the target". **[verified]**
- Texture resolution goes down only to `2k` (2048²). The options are 2k, 4k and 8k. PBR maps are off by default (`enable_pbr: false`). **[verified]**
- To match our existing ~6,900-triangle, one-texture model: aim for about 3,000–8,000 triangles. Use base colour only (no PBR). Shrink the 2K texture to 512 or 1024 and convert it to JPEG/WebP with glTF-Transform after download. **[inferred]**
- Example output URLs use `.png` textures. The texture file type is not documented. **[inferred]**

## Credits

Web app ([pricing and credits](https://docs.meshy.ai/en/webapp/pricing)) **[verified]**:

| Step | Credits |
|---|---|
| Text to 3D | 20 (Meshy 6), 10 (Meshy 6 Lite) |
| Image to 3D | 20 (7.1 / 6), 25 (Ultra, the paid-plan default for 7.1), 10 (6 Lite) |
| Texture at generation | +10 |
| Smart Topology (low poly) | 5 (T2), 20 (T1) |
| Remesh, Rigging, Animate | 0 |
| Text to Motion | "costs credits", amount not given |

API ([API pricing](https://docs.meshy.ai/api/pricing.md)) **[verified]**: Text/Image to 3D mesh 5–20 credits, +10 for texture (15 total on t2/6-lite), Refine/Retexture 10, Remesh 5, Rigging 5, Animation 3 per action, Text to Motion 3 (swift) or 10 (prime), Convert/Resize 1.

Plans ([meshy.ai/pricing](https://www.meshy.ai/pricing)) **[verified]**:

| Plan | $/month | Credits/month | API | Licence |
|---|---|---|---|---|
| Free | 0 | 100 | No | CC BY 4.0 |
| Pro | 20 | 1,000 | Yes | Private, customer owned |
| Premium | 40 | 3,000 | Yes | Private |
| Ultra | 100 | 8,000 | Yes | Private |
| Studio | 70 (+10/seat) | 5,500 shared | Yes | Private |

The Free plan also has a 10 download/month limit and no Remesh. **[verified]**

Rough cost per humanoid in the web app: about 25 credits for a textured Smart Topology model, plus 0 for rig and clips. That is about 4 characters a month on Free, or about 40 on Pro. **[inferred]**

## API

- REST at `/openapi/v1/...`. Tasks run in the background; you poll or use SSE/webhooks. Covers Text/Image to 3D, Remesh, Convert, Resize, Retexture, **Rigging**, **Animation** and Text to Motion. **[verified]**
- "You need a paid plan to create and manage API keys." Creating tasks on the free plan returns `402`. **[verified]**
- API output files expire, after 3 days on Pro/Premium/Ultra. Download them right away. API tasks don't show up in My Assets in the web app. **[verified]**
- The `animation-library` endpoint is free to call. **[verified]**

## Licence

- Terms of Service (updated 2026-09-19), §3.2: on the free plan, Meshy owns the output but makes it available under **CC BY 4.0** "as long as the free plan customer provides appropriate credit to Meshy". On a paid plan the customer **owns** the output. **[verified]**
- CC BY 4.0 allows sharing and commercial use with credit. So free-plan models are fine for a private friends' game and also for a public release, as long as a credits line names Meshy. **[inferred]** from the licence itself (not legal advice).
- Paid-plan models are private and owned. That is cleaner for a public release and needs no credit line. **[verified]**
- Things to watch: Meshy may train on non-Enterprise inputs and outputs unless you opt out by email (§2.9). Do not remove AI-generation metadata or watermarks (§2.4). Output is not guaranteed unique (§7.2). Anything published to the Meshy Community becomes CC0 (§3.3). **[verified]**

## Sources

- API index: https://docs.meshy.ai/llms.txt
- Rigging API: https://docs.meshy.ai/api/rigging.md
- Animation API: https://docs.meshy.ai/api/animation.md
- Animation library: https://docs.meshy.ai/api/animation-library.md, catalogue JSON https://api.meshy.ai/web/public/animations/resources
- Text to Motion: https://docs.meshy.ai/api/text-to-motion.md
- Text to 3D: https://docs.meshy.ai/api/text-to-3d.md
- Remesh: https://docs.meshy.ai/api/remesh.md
- API pricing: https://docs.meshy.ai/api/pricing.md
- Quickstart (paid plan for keys): https://docs.meshy.ai/api/quick-start.md
- Changelog: https://docs.meshy.ai/api/changelog.md
- Web app rigging: https://docs.meshy.ai/en/webapp/guides/3d-model/rigging
- Web app animate: https://docs.meshy.ai/en/webapp/guides/animate
- Web app credits: https://docs.meshy.ai/en/webapp/pricing
- Plans: https://www.meshy.ai/pricing
- Terms of Service: https://www.meshy.ai/terms-of-use
- Ownership help article: https://help.meshy.ai/en/articles/10137554-what-is-the-ownership-of-the-generated-models

## Not verified

- Whether clips have root motion or are in place. This is not documented; we need to open a real file to check.
- The exact contents of each GLB: whether the rigged GLB has no clips, and whether the "armature GLB" has no mesh. Inferred from field names only.
- The bone names in the default skeleton (Mixamo-style?). Whether all rig tasks use the same skeleton, so clips could be shared between different characters.
- The texture file format and whether the GLB embeds textures. Examples show `.png`.
- The Smart Rig (beta) skeleton for a beast. Whether a Quadruped Dog rig suits a boar shape. Whether the quadruped walk can be done through the API (the API docs say humanoid only).
- What happens to ownership after a downgrade. Seen only in search snippets of help articles, which I did not open.
- Annual plan prices. The pricing page I read was ambiguous.
- Anything behind a login: the Developer Platform, actual downloads, real credit charges.
