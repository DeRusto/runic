export const MAX_LEVEL = 99;

/** Every skill a player can train and its synced experience field, in the character sheet's order. */
export const SKILLS = [
  ["Combat", "combatXp"],
  ["Defense", "defenseXp"],
  ["Herblaw", "herblawXp"],
  ["Hitpoints", "hitpointsXp"],
  ["Mining", "miningXp"],
  ["Smithing", "smithingXp"],
  ["Woodcutting", "woodcuttingXp"],
  ["Fishing", "fishingXp"],
  ["Cooking", "cookingXp"],
  ["Firemaking", "firemakingXp"],
  ["Crafting", "craftingXp"],
  ["Fletching", "fletchingXp"],
  ["Blocking", "blockingXp"],
  ["Mastery", "masteryXp"],
] as const;
/** Where experience is paid. Mastery isn't paid any: it only gets its share of the rest. */
export type XpField = Exclude<(typeof SKILLS)[number][1], "masteryXp">;

/** Of the experience that lands in any other skill. The migration that backfilled Mastery has its own copy. */
export const MASTERY_SHARE_PERCENT = 7;

/** Moves up to `SKILLS`, with its column and synced field, when its content lands. Until then its experience is 0. */
const UPCOMING_SKILLS = [
  ["Attack", "attackXp"],
  ["Strength", "strengthXp"],
  ["Ranged", "rangedXp"],
  ["Prayer", "prayerXp"],
  ["Magic", "magicXp"],
  ["Agility", "agilityXp"],
  ["Thieving", "thievingXp"],
  ["Jewelsmithing", "jewelsmithingXp"],
  ["Leatherworking", "leatherworkingXp"],
  ["Runecrafting", "runecraftingXp"],
] as const;

/** The 23 skills total level counts. Combat isn't among them: its split replaces it. */
export const SKILL_REGISTRY = [...SKILLS, ...UPCOMING_SKILLS].filter(
  ([skill]) => skill !== "Combat",
);

/** What the bottom bar's skills column fits: two across, three down. */
export const MAX_PINNED_SKILLS = 6;

/** Any later skill starts unpinned. Also the `pinned_skills` column's default, so changing it needs a migration. */
export const STARTING_PINNED_SKILLS = [
  "Combat",
  "Defense",
  "Herblaw",
  "Hitpoints",
  "Mining",
  "Smithing",
];

/** Total experience needed for a level (spec §5). */
export const xpForLevel = (level: number) => 50 * (level - 1) ** 2;

/** Experience stops here. */
export const MAX_XP = xpForLevel(MAX_LEVEL);

/** Awards experience, up to where it stops. */
export const addXp = (xp: number, gained: number) =>
  Math.min(xp + gained, MAX_XP);

/** Only experience is stored; level is always worked out from it. */
export const levelFor = (xp: number) =>
  Math.min(Math.floor(Math.sqrt(xp / 50)) + 1, MAX_LEVEL);

type SkillXp = Partial<Record<(typeof SKILL_REGISTRY)[number][1], number>>;

/** The sum of every registered skill's level; a skill with no experience yet is level 1. */
export const totalLevel = (xp: SkillXp) =>
  SKILL_REGISTRY.reduce(
    (total, [, field]) => total + levelFor(xp[field] ?? 0),
    0,
  );

/** Base plus the best of the three styles. Combat stands in for Attack and Strength until they have experience of their own. */
export function combatLevel(xp: SkillXp) {
  const level = (field: keyof SkillXp) => levelFor(xp[field] ?? 0);
  const base =
    0.25 *
    (level("defenseXp") +
      level("blockingXp") +
      level("hitpointsXp") +
      Math.floor(level("prayerXp") / 2));
  const melee =
    0.325 *
    (levelFor(xp.attackXp ?? xp.combatXp ?? 0) +
      levelFor(xp.strengthXp ?? xp.combatXp ?? 0));
  const ranged = 0.325 * Math.floor(level("rangedXp") * 1.5);
  const magic = 0.325 * Math.floor(level("magicXp") * 1.5);
  return Math.floor(base + Math.max(melee, ranged, magic));
}

/** How far through the current level, from 0 to 1; 1 at the top level. */
export function levelProgress(xp: number) {
  const level = levelFor(xp);
  if (level === MAX_LEVEL) return 1;
  const start = xpForLevel(level);
  return (xp - start) / (xpForLevel(level + 1) - start);
}
