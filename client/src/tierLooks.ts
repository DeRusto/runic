import type { Tier } from "@runic/shared";

export type TierLook = { tint: number; glow?: number };

/** Each tier's colours (spec §7), for gear in hand and its icons. */
export const TIER_LOOKS: Record<Tier, TierLook> = {
  copper: { tint: 0xf0935a },
  iron: { tint: 0xd5dde4 },
  emberite: { tint: 0x7a2a22, glow: 0xff4a10 },
};

export const GLOW_INTENSITY = 0.15;
