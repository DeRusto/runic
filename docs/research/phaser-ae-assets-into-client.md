# How Phaser AE assets get into the client

Research for [#10](https://github.com/DeRusto/runic/issues/10), done 2026-11-03 with `@phaser-ae/cli` 0.7.5 against
the unpublished probe game `runic-probe`, and `phaser@4.2.1` read from its npm tarball.

**Short answer:** AE delivers plain web files on a public CDN: one WebP per sprite frame, and MP3 for sound and
music. You get no sprite sheet and no frame data. Each frame is its own picture, and the frames differ in size. A
Phaser 4 client can load them as separate images and build the walk animation from those keys. It can also pack them
into an atlas first. The files are small, so download them into the repo rather than load them live. The phaser.io
Terms neither grant nor forbid using generated assets in a game hosted elsewhere. The spend cost **201 credits**.

Each claim is marked **[verified]** (seen on this machine or read in a primary source) or **[inferred]**.

## Sources

- The probe game folder, from `phaser-ae build runic-probe` (in a scratch dir outside the repo):
  `game/assets.json`, `design/assets.md`, `design/shown/`, `design/crew/`.
- The CLI source, `@phaser-ae/cli@0.7.5` `lib/crew.mjs` (how assets are brought in and addressed).
- `curl -I` on each delivered file (with an `Origin` header), and `file` on the downloaded copies.
- `phaser@4.2.1` source: `src/loader/filetypes/SpriteSheetFile.js`, `src/animations/Animation.js` (`getFrames`),
  `src/textures/Texture.js` (`get`), `src/device/Audio.js`.
- phaser.io: [Terms of Use](https://www.phaser.io/community/terms-of-use) (last updated 2024-08-20),
  [Pricing](https://phaser.io/pricing), [Engine licence](https://phaser.io/polyform-shield-license).

## What was made

All three came from `phaser-ae tool <tool> "<request>"`, one request each.

| Asset | Tool (bot) | Key in `assets.json` | Credits |
|---|---|---|---|
| Thornback walk, 4 frames | Sprite Factory (Pixel) | `thornback-walk-1` … `-4` | 70 |
| Thornback hurt sound | Sound effects (Foley) | `thornback-hurt` | 35 |
| "Village Hearth" loop | Music (Score) | `music-gameplay` | 88 |
| A price question to Pixel, nothing made | Sprite Factory | — | 8 |

## 1. Formats and sizes

**Sprites [verified]**

- `assets.json` gives `"baseURL": "https://cdn.phaser.games/projects/kGSta4hu5Ps/files/"` and `"spriteSize": 256`.
  Each sprite entry is `{"kind":"sprite","key":…,"file":"fmw0x65ey1yt0pk"}`, and it loads as
  `<baseURL><file>-<spriteSize>.webp` (`addressOf` in `lib/crew.mjs`).
- Three versions of every frame are on the CDN:
  - `-256.webp`: 256 px on the long side, 18.8–19.7 KB.
  - `-128.webp`: 7.1–7.5 KB.
  - `.png`: the cut-out original, 360–377 × 296–312, RGBA, about 250 KB.

  The bare name with no suffix returns 403.
- The four 256 px frames are 256×206, 256×221, 256×212 and 256×210 (`file`), with a transparent background.
  `design/assets.md` says each sprite "stands on its bottom center", and that each one is "a single still frame (no
  animation strips)".
- **The style ignored the request.** It asked for top-down lo-fi pixel art. What came back is a painted cartoon boar,
  seen from the side, at 256 px. `design/assets.md` records the sheet's style as "Bright hand-painted cartoon game asset
  … side-on view". **[inferred]** That style is probably set for the whole design by the Sprite Factory, not per
  request. Getting top-down pixel art would need that style changed on the tool's page first.

**Sound effect [verified]**

- Entry: `{"kind":"audio","key":"thornback-hurt","url":"fmw0xb385dy48q1.mp3"}`.
- MP3, 128 kbps, 44.1 kHz stereo, 17,179 bytes, about 1.0 s. `design/assets.md` gives its length and "Loop: no".

**Music [verified]**

- Entry: `{"kind":"audio","key":"music-gameplay","url":"trk0tuuv-128.mp3","stream":true}`.
- The file the game loads, `trk0tuuv-128.mp3`, is 492,817 bytes (128 kbps). The master the bot showed,
  `trk0tuuv.mp3`, is 746,250 bytes, 192 kbps, 44.1 kHz joint stereo. Both work out to about 31 s, and
  `design/assets.md` gives 31 s, "Loop: yes".
- **[not verified]** Whether the loop is truly seamless. No one listened to it.
- No OGG or other format is offered. **[inferred]** MP3 alone plays in every current browser, so Phaser 4's
  `load.audio(key, url)` needs no fallback list.

## 2. Download into the repo, or load live?

**What the CDN does [verified]**

- Every file is served by Cloudflare with `access-control-allow-origin: *` (for any `Origin`) and
  `cache-control: public, max-age=31536000, immutable`. Phaser 4 could therefore load the URLs live, cross-origin,
  without a proxy.
- The URLs are unguessable, but they are public and need no sign-in.

**Why download anyway [inferred, from the Terms]**

- §3.6: phaser.io has no duty to store Your Content, and may limit storage.
- §11.5: closing the account may delete content.
- The files are tied to this Pro account and to the `runic-probe` game. Live URLs could break if either goes, and the
  client has no control over that.
- The whole set is small. The four 128 px frames total about 30 KB, the sound effect 17 KB and the music 490 KB.

**Recommendation:** copy the files into the client's static assets, for example `client/public/assets/`, and load them
from there. Note each file's AE source key and URL next to it. These sizes are fine to commit. Music is the only
thing that would grow the repo, at about 0.5 MB a track. Fetch from the URLs in `game/assets.json` (the CLI does the
same for pictures), not by scraping phaser.io pages. §1.3(e) bars automated tools that collect data from the
Services, and fetching a file you own by its URL is the closest safe reading.

## 3. Sprite frame data for Phaser 4

**What Phaser 4.2.1 accepts [verified]**

- `load.spritesheet(key, url, { frameWidth, frameHeight, … })` needs a single image cut into **equal** frames
  (`SpriteSheetFile.js`).
- `load.atlas` / `load.multiatlas` need a texture-atlas JSON (TexturePacker-style) or XML/Aseprite data
  (`AtlasJSONFile.js`, `AsepriteFile.js`, …).

**What AE gives [verified]:** neither. It gives four separate images with no shared frame size and no JSON. The
"sheet" exists only on phaser.io, where the sprites are painted and cut. The game receives one file per frame.

**What works anyway [verified in source, not run]**

- Phaser 4's `Animation.getFrames` takes `frames: [{ key: 'thornback-walk-1' }, { key: 'thornback-walk-2' }, …]`. Each
  key is its own texture. With no `frame`, `Texture.get` falls back to the texture's first (base) frame.
- So you can `load.image` each frame and then `anims.create({ key: 'thornback-walk', frames: [...] })`, with no atlas.
- Set the sprite's origin to `(0.5, 1)`, because AE anchors at bottom centre and the frames differ in height.

**Better later [inferred]:** pack the frames into one atlas at build time (any TexturePacker-format packer). That saves
draw-call texture swaps. For four frames it doesn't matter. It matters once several enemies and the players share a
scene.

**Scale [inferred]:** 256 px art is 8× a 32 px tile, so the client draws it at about 0.125–0.25 scale or uses the
128 px files. Painted art scaled that far will not look like pixel art.

## 4. What the Terms say about using these assets elsewhere

All of the following was read on the [Terms of Use](https://www.phaser.io/community/terms-of-use) (2024-08-20),
[Pricing](https://phaser.io/pricing) and the [engine licence](https://phaser.io/polyform-shield-license).

**What the pages say [verified]**

- **Nothing about AI.** The Terms have no clause on AI-generated content. They predate Phaser AE.
- **Ownership (§4.3).** phaser.io "does not claim ownership of Your Content". "Your Content" (§3.1) is what you design
  or create, including your games. The Terms do not say whether a file a phaser.io bot generates for you counts as
  Your Content or as part of the Services, which phaser.io owns (§4.1).
- **Software licence (§1.1).** It is limited, revocable and non-transferable, for making games for personal and
  internal business purposes. §1.3(a) bars hosting, distributing or commercially exploiting the Services themselves.
- **The engine licence and Pricing** let you make, publish, sell and operate games. Pricing: the licence lets you
  "make, publish and sell any game". The only stated limit is on building a competing game-making service. This
  licences the AE *engine*. It says nothing about generated art or sound, or about using them with another engine
  such as Phaser 4.
- **Hosting.** Nothing read requires a game to be hosted on phaser.io, or forbids using its outputs in a game hosted
  elsewhere.

**Verdict [inferred]**

- No written rule forbids putting these assets in Runic's Phaser 4 client on our own server. No written rule
  explicitly grants it either.
- For a private game among friends, with no sales, the risk looks low.
- Before any public or commercial release, get written confirmation from phaser.io that Pro-generated assets may ship
  in a game built on another engine.
- Unknown: which third-party generators make the art and audio, and whether their terms pass through. phaser.io's
  pages don't name them for sprites or sound. The Videos and 3D tools do name MiniMax and Meshy/Tripo.

## 5. Credits

| When | Balance | Spent |
|---|---|---|
| Before | 8,000 | |
| After the price question | 7,992 | 8 |
| After the sprite frames | 7,922 | 70 |
| After the sound effect | 7,887 | 35 |
| After the music | 7,799 | 88 |
| **Total** | | **201** |

All balances are from `phaser-ae credits` **[verified]**.

**[verified]** Pixel quoted "1 credit" for the sheet, and it cost 70. The bots' price quotes are not reliable. Check
`credits` before and after instead. Just asking a bot a question also costs credits (8 here).

## Side effects

- The four sprites, the sound and the music now sit on `runic-probe`'s design on phaser.io (Sprite Factory, Sound
  effects and Music pages). Nothing was published.
- `phaser-ae build` started two new build rooms ("Watch it" links) on the account.
- The engine download (2.8 MB) failed twice on this machine's slow connection. The probe folder therefore has no
  engine, and each `tool` run warned that the game didn't bake. This had no effect on the assets.

## Unverified

- Whether the music loops seamlessly, and how either sound actually sounds.
- Whether the sprites render in a running Phaser 4 scene. Only the loader and animation source were read.
- Whether the Sprite Factory can be switched to top-down pixel art, and what that costs.
- Licence terms of the underlying generators.

## Delivered files (links, not committed)

- Frames (256 px): [1](https://cdn.phaser.games/projects/kGSta4hu5Ps/files/fmw0x65ey1yt0pk-256.webp),
  [2](https://cdn.phaser.games/projects/kGSta4hu5Ps/files/fmw0x65h0o7drgv-256.webp),
  [3](https://cdn.phaser.games/projects/kGSta4hu5Ps/files/fmw0x65j75x9kug-256.webp),
  [4](https://cdn.phaser.games/projects/kGSta4hu5Ps/files/fmw0x65l7pp9dpu-256.webp)
- [Sound effect](https://cdn.phaser.games/projects/kGSta4hu5Ps/files/fmw0xb385dy48q1.mp3)
- [Music, as loaded](https://cdn.phaser.games/projects/kGSta4hu5Ps/files/trk0tuuv-128.mp3)
