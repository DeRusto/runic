import { readFileSync } from "node:fs";
import { loadRegion } from "@runic/shared";

const read = (name: string) =>
  readFileSync(new URL(`../../maps/${name}`, import.meta.url), "utf8");

/** The world's tiles from maps/. The client imports the same two files. */
export const loadWorldRegion = () =>
  loadRegion(read("region.tmj"), read("region.tsj"));
