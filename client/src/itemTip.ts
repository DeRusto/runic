import {
  AVOIDANCE_POTION_POINTS,
  costsOf,
  countOf,
  fireOf,
  FORTITUDE_POTION_PERCENT,
  FOOD_HEALS,
  gateOf,
  gearOf,
  gearRefusal,
  GEMS,
  itemParts,
  makeRefusal,
  MIGHT_POTION_HIT,
  POTION_BUFF_TICKS,
  potionOf,
  RECIPES,
  TICK_MS,
  TOOLS,
  virtueDoes,
  xpOf,
  type PotionId,
  type RecipeItem,
} from "@runic/shared";
import { itemName } from "./itemIcons.ts";

/** What a Delicious item's tooltip says under its kind (#221). */
const DELICIOUS_LINE = "Delicious: an extra healing tick for 60 seconds.";

/** What each potion's tooltip says drinking it does, for its buff's two minutes (#222). */
const POTION_LINE: Record<PotionId, string> = {
  mightPotion: `Drink: +${MIGHT_POTION_HIT} to your hit`,
  fortitudePotion: `Drink: +${FORTITUDE_POTION_PERCENT}% max health`,
  avoidancePotion: `Drink: +${AVOIDANCE_POTION_POINTS} to your Avoidance`,
};
const POTION_MINUTES = (POTION_BUFF_TICKS * TICK_MS) / 60_000;

/** The lines of an item's tooltip, top to bottom (spec §5). */
export type ItemTip = {
  name: string;
  quality: string;
  kind: string;
  stats: string[];
  virtue?: string;
  refusal?: string;
};

const SLOT_KINDS = {
  weapon: "Weapon",
  shield: "Shield",
  head: "Head armour",
  body: "Body armour",
  legs: "Leg armour",
};

function kindOf(item: string) {
  const gear = gearOf(item);
  if (gear)
    return `${SLOT_KINDS[gear.slot]}, needs ${gateOf(item)!.skill} ${gear.level}`;
  if (potionOf(itemParts(item).base)) return "Potion";
  const food = FOOD_HEALS.get(itemParts(item).base);
  if (food)
    return `Food, heals ${food.perTick * food.ticks} over ${food.ticks} ticks`;
  if ((TOOLS as readonly string[]).includes(item)) return "Tool";
  if (GEMS.includes(item)) return "Gem";
  const fire = fireOf(item);
  return fire ? `Log, lights a fire at Firemaking ${fire.level}` : "Material";
}

/** `item`'s tip, with the refusal to equip it when `player` is given. */
export function itemTip(
  item: string,
  player?: { combatXp: number; defenseXp: number },
): ItemTip {
  const does = gearOf(item)?.does;
  const potion = potionOf(itemParts(item).base);
  return {
    name: itemName(item),
    quality: itemParts(item).quality,
    kind: kindOf(item),
    // The Gear tab's wording, ended like the Virtue line under it.
    stats: does
      ? [`${does}.`]
      : // A potion's drink line, then a Delicious food's own line (#221, #222).
        potion
        ? [`${POTION_LINE[potion]} for ${POTION_MINUTES} minutes.`]
        : itemParts(item).quality === "delicious"
          ? [DELICIOUS_LINE]
          : [],
    virtue: virtueDoes(item),
    refusal: player && gearRefusal(item, player),
  };
}

/** A smithing recipe's tip: what it makes with no Virtue, then its materials and experience, then why it can't be made. */
export function recipeTip(
  item: RecipeItem,
  player: Parameters<typeof makeRefusal>[1],
): ItemTip {
  const materials = costsOf(item)
    .map(
      ([material, count]) =>
        `${count} ${itemName(material)} (have ${countOf(material, player)})`,
    )
    .join(", ");
  const xp = `${xpOf(item)[0]![1]} ${RECIPES[item].skill} experience`;
  const tip = itemTip(item);
  return {
    ...tip,
    stats: [...tip.stats, materials, xp],
    refusal: makeRefusal(item, player),
  };
}

const line = (text: string, className: string) => {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text;
  return element;
};

/** The tooltip's parts for `tip`, which the page styles by class. */
export function itemTipParts(tip: ItemTip) {
  const lines = tip.stats.map((stat) => line(stat, "tip-stat"));
  if (tip.virtue) lines.push(line(tip.virtue, `tip-stat ${tip.quality}`));
  return [
    line(tip.name, `tip-name ${tip.quality}`),
    line(tip.kind, "tip-kind"),
    ...(lines.length ? [document.createElement("hr"), ...lines] : []),
    ...(tip.refusal ? [line(tip.refusal, "tip-refusal")] : []),
  ];
}
