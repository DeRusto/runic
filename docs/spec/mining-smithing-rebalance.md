# Runic: Mining and Smithing rebalance

**Status: decided, not yet built.** Terms are defined in `GLOSSARY.md`. Decisions come from the closed tickets on [Map: Rebalance Mining and Smithing](https://github.com/DeRusto/runic/issues/134).

This spec describes only what changes. It revises the Mining and Making rules in §4 and the numbers in §5 of the [second slice spec](second-slice.md), and where the two disagree this one wins. Everything else there still holds.

All timers are whole **ticks** of 300 ms. The numbers were tuned in `scripts/pacing.ts` (run `node --experimental-strip-types scripts/pacing.ts`; the flag is needed before Node 22.18), but nobody has played them yet, so they are first values to tune in play.

## 1. What changes

Players get more steps between tiers. A successful mine can give 2 ore, veins sometimes give a **find** (tin, coal or a gem), and two new metals sit between the old ones: **Bronze** at level 5 and **Steel** at 15, each with a full set of gear. Smelting moves into Mining, so the furnace is gated on Mining and pays only Mining, and the anvil is all of Smithing.

**Existing progress survives.** Nobody's experience, items or gear changes. The gates for Iron (10) and Emberite (20) don't move, so no player loses gear they can use today. Smelting's gate moves from Smithing to Mining at the same levels, so a player whose Mining is below their Smithing can lose smelting a tier until Mining catches up. That's accepted, with no migration: mining your own ore has always paid Mining more than smelting and smithing paid Smithing, so only a player who smelted ore picked up from the ground can hit it, and they keep all their gear. Players level faster or slower from here on, but what they earned stays.

Out of scope: new kinds of vein (they come with new areas); any use for gems (Jewelsmithing, [Map: Phase 6](https://github.com/DeRusto/runic/issues/86)); progression from level 20 to 99; charcoal from Woodcutting; improved items ([Map: Improved items](https://github.com/DeRusto/runic/issues/143)); how many veins are active ([Site pools](https://github.com/DeRusto/runic/issues/106)).

## 2. Rules

### Mining

These replace the second slice's "one click, one ore" rules ([How does a vein yield 1 or 2 ore?](https://github.com/DeRusto/runic/issues/136), [Which extras drop from which veins, and how often?](https://github.com/DeRusto/runic/issues/137)).

- **One click, one success.** Trying stops at the first success, whether it gave 1 ore or 2. The other stopping rules stay as they are.
- **A success gives 1 or 2 ore.** Each tier has a fixed chance of 2 (§3), the same at every Mining level, since a higher level already raises the success chance and shortens the time between attempts.
- **A vein holds successful mines**, not ore. A vein that holds 3 gives 3 to 6 ore before it runs out. The synced field `oreLeft` is renamed `minesLeft`; vein state isn't saved, so nothing migrates.
- **Experience is paid per successful mine**, whether it gave 1 ore or 2. The second ore pays its Mining experience later, when it's smelted.
- **Finds.** On every success, each kind of find the vein gives rolls on its own (§3), so an Iron vein can give ore, tin and coal at once. A find is always 1. A vein's own level gate covers its finds, so tin piles up before Bronze opens and coal before Steel opens.
- **No room.** A click is still refused when there's no room for even 1 ore. A second ore or a find with no room lands on the ground on the miner's tile, belonging to the miner, under the rules of [Loot on the ground](https://github.com/DeRusto/runic/issues/120).
- **What players see.** The `mine` event carries the ore count and lists the finds. The success line reads "Mined 2!" when 2 ore drop and names each find, for example "Mined 2! Found tin and coal.", including a find that went to the ground.
- **Mining only.** Bushes still give 1 per pick. In the shared gathering code, the chance of 2 and the finds are optional fields on a gathering source, and bushes leave them unset.

### Making

- **The furnace is Mining.** Each bar needs a Mining level and pays only Mining experience. Bronze and Steel bars each need their find as well as ore (§3).
- **The anvil is Smithing.** Each item needs a Smithing level and pays only Smithing experience: its metal's rate per bar it costs (§3).
- Everything else about making stays: the wait, what ends it, the checks, and Make 1 and Make all.

### Gear

- Bronze and Steel each get a sword, shield, helmet, chestplate and leggings, with the same costs and times as every other tier ([What do Bronze and Steel cost to make, and what does their gear give?](https://github.com/DeRusto/runic/issues/138)).
- A tier's level gates everything for that tier: smelting its bar (Mining), making its gear (Smithing), wielding its sword (Combat), and wearing its shield and armour (Defense). Blocking still never gates a shield.
- Steel needs no Emberbones. Coal is Steel's extra cost, and the Emberbone stays the mark of the top tier.

## 3. Numbers

From [What numbers hit the pacing targets?](https://github.com/DeRusto/runic/issues/139). The experience curve, attempt timing and success chance (`pickIntervalTicks`, `attemptChance`) don't change.

**Tiers**

| Tier | Level gate | Has veins | Bar costs |
|---|---|---|---|
| Copper | 1 | Yes | 1 copper ore |
| Bronze | 5 | No | 1 copper ore + 1 tin |
| Iron | 10 | Yes | 1 iron ore |
| Steel | 15 | No | 1 iron ore + 1 coal |
| Emberite | 20 | Yes | 1 emberite ore |

**Veins**

Counts, holds and regrowth are as today. Holds now counts successful mines.

| Vein | Mining experience per successful mine | Chance of 2 ore | Finds, each rolled per successful mine |
|---|---|---|---|
| Copper | 6 (was 10 per ore) | 30% | Tin 1 in 3 |
| Iron | 18 (was 30 per ore) | 25% | Tin 1 in 6, coal 1 in 2 |
| Emberite | 30 (was 60 per ore) | 20% | A gem 1 in 20 |

A gem roll that hits gives one of three gems, split 70/25/5: **Ashstone** (3.5% per successful mine), **Cinderglass** (1.25%) and **Heartflame** (0.25%). Tin, coal and the gems are materials and stack to 20.

**Making**

Every bar takes 6 ticks. Every tier's gear costs the same: sword 3 bars and 12 ticks, shield 4 and 16, helmet 2 and 8, chestplate 5 and 20, leggings 3 and 12. Emberite gear still also costs Emberbones, as today.

| Tier | Mining experience per bar smelted | Smithing experience per bar at the anvil |
|---|---|---|
| Copper | 2 (was 4, plus 4 Smithing) | 6 (as today) |
| Bronze | 4 | 12 |
| Iron | 6 (was 12, plus 12 Smithing) | 18 (as today) |
| Steel | 9 | 27 |
| Emberite | 12 (was 24, plus 24 Smithing) | 36 (as today) |

An item pays its rate times the bars it costs, so a Steel sword pays 81 and a Bronze chestplate 60.

**Gear**

Bronze and Steel sit at the midpoints between their neighbours.

| | Copper | Bronze | Iron | Steel | Emberite |
|---|---|---|---|---|---|
| Sword hit bonus | 100 | 150 | 200 | 250 | 300 |
| Shield block | 10% | 15% | 20% | 25% | 30% |
| Helmet | 2% | 3% | 4% | 5% | 6% |
| Chestplate | 4% | 6% | 8% | 10% | 12% |
| Leggings | 2% | 3% | 4% | 5% | 6% |

**Pace**

The targets stay: level 10 in about 1 h, 20 in about 3 h and 99 in 50 to 60 h, for one player mining alone. Simulated, as mean hours over 5 seeds (level 99 lands just under 50 h, which is accepted as on target):

| Players | Skill | Level 10 | Level 20 | Level 99 |
|---|---|---|---|---|
| 1 | Mining | 1.1 | 3.2 | 49.1 |
| 1 | Smithing | 1.1 | 3.1 | 48.7 |
| 3 | Mining | 2.6 | 6.6 | 102.7 |
| 3 | Smithing | 2.5 | 6.4 | 101.8 |

Three players sharing the veins run about 2× slower, because the veins run out. That's accepted for now and handed to [Site pools](https://github.com/DeRusto/runic/issues/106), which will change vein supply; rerun the simulation when it lands. Tin and coal aren't a wall: a player alone holds about 34 tin when Bronze opens and 79 coal when Steel opens, enough for a first full set (17 bars).

All of these live in `shared/` as named constants, beside the ones they join (`VEINS`, `RECIPES`, `GEAR`, `ITEMS`).

## 4. Saves

New item ids are added: `tin`, `coal`, `ashstone`, `cinderglass`, `heartflame`, `bronzeBar`, `steelBar`, and `bronze` and `steel` versions of the five gear pieces (`bronzeSword` and so on). No existing id changes, so existing saves load as they are.

## 5. Client

### Smithing panel

The layout from [How does the Smithing panel lay out five tiers?](https://github.com/DeRusto/runic/issues/142) replaces the second slice's one row per item with every row showing:

- Rows are grouped by tier, and each tier is a section that folds. Tiers the player can make start open; locked tiers start folded and show their gate in the header ("Smithing 15", or "Mining 15" at the furnace).
- Each row is one line: icon, piece name, a short cost underneath ("3 bars", plus the reason it can't be made yet), then **Make 1** and **Make all**. The full cost, experience and reason sit in the row's tooltip.
- The furnace and the anvil stay separate views of the same panel. The furnace lists five bars, gated on Mining; the anvil lists 25 pieces under the five tier headers.
- The Make buttons use `button_brown.png` from Kenney UI Pack Adventure as a 9-slice `border-image` with dark brown text, and `button_grey.png` when disabled. Both files are on the [`prototype/smithing-panel`](https://github.com/DeRusto/runic/tree/prototype/smithing-panel) branch, ready to copy into `client/public/ui/`. The prototype to copy from is `client/public/prototype-smithing.html?variant=D` there.

### Looks and icons

These are starting points. The owner will revisit the icons later, as with the second slice's.

- **Bronze and Steel gear** reuse the existing sword and shield models with a new entry each in `TIER_LOOKS`: Bronze between Copper and Iron in colour (a warm brass), Steel a darker blue-grey than Iron, neither with a glow. Pick the exact tints by eye beside the other three.
- **Icons** for tin, coal, the three gems, and the Bronze and Steel bars and gear are made the same way as the existing ones: rendered once from CC0 models and committed as PNGs, with tints where a model is reused. The packs catalogued in `C:\Users\derus\Game Assets` are the first place to look. Confirm each licence before committing, as the repo is public.

## 6. Build tickets

Each is a thin working slice that builds on those it needs. Each is a `ready-for-agent` issue.

| # | Ticket | Delivers | Needs |
|---|---|---|---|
| 1 | [Smelting pays Mining](https://github.com/DeRusto/runic/issues/151) | Furnace gated on and paying only Mining at the new rates; the panel's furnace rows say "Needs Mining N" | |
| 2 | [Veins yield 1 or 2 ore](https://github.com/DeRusto/runic/issues/152) | Chance of 2, `minesLeft`, experience per successful mine, the second ore to the ground, "Mined 2!" | |
| 3 | [Finds: tin, coal and gems from veins](https://github.com/DeRusto/runic/issues/153) | Tin, coal and gems as items with icons, the rolls, finds to the ground, the chat line | 2 |
| 4 | [Bronze and Steel](https://github.com/DeRusto/runic/issues/154) | Bars, the ten gear pieces, stats, gates, icons and looks | 1, 3 |
| 5 | [Smithing panel by tier](https://github.com/DeRusto/runic/issues/155) | Folding tier sections, one-line rows with icons, brown Make buttons | 4 |
