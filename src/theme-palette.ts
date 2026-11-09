/** Curated organization brand choices; UI literals otherwise live in theme.css. */
export const DEFAULT_BRAND_COLOR = "#285c4b";

/**
 * Sixteen curated primary colors — one per hue family, like the classic
 * 16-color palette. Every entry holds at least 4.5:1 contrast against the
 * white foreground text used on brand-filled controls, and the token-level
 * contrast governance (scripts/check-contrast.mjs) derives its pairs from
 * this list.
 */
export const BRAND_PALETTE = [
  // greens
  DEFAULT_BRAND_COLOR, // forest green
  "#2f6b2f", // pine green
  "#5f6b12", // olive
  // teals
  "#0f766e", // deep teal
  "#0e7490", // peacock
  // blues
  "#174ea6", // royal blue
  "#1d5fbf", // cobalt
  "#4050b5", // indigo
  "#475569", // slate
  // purples
  "#6b3fa0", // grape
  "#7d2b8b", // plum
  // reds
  "#99255e", // rosewood
  "#9e1b32", // crimson
  // warm earth
  "#9a3412", // burnt sienna
  "#8a5a0b", // bronze
  "#7c4a12", // cocoa
] as const;

/** Human names for the curated palette; used in swatch accessible labels. */
export const BRAND_COLOR_NAMES: Record<(typeof BRAND_PALETTE)[number], string> = {
  "#285c4b": "forest green",
  "#2f6b2f": "pine green",
  "#5f6b12": "olive",
  "#0f766e": "deep teal",
  "#0e7490": "peacock",
  "#174ea6": "royal blue",
  "#1d5fbf": "cobalt",
  "#4050b5": "indigo",
  "#475569": "slate",
  "#6b3fa0": "grape",
  "#7d2b8b": "plum",
  "#99255e": "rosewood",
  "#9e1b32": "crimson",
  "#9a3412": "burnt sienna",
  "#8a5a0b": "bronze",
  "#7c4a12": "cocoa",
};
