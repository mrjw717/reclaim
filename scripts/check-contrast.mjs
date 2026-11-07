import { readFile } from "node:fs/promises";

const theme = await readFile(new URL("../src/theme.css", import.meta.url), "utf8");
const paletteSource = await readFile(new URL("../src/theme-palette.ts", import.meta.url), "utf8");

function section(start, end) {
  const from = theme.indexOf(start);
  const to = end ? theme.indexOf(end, from + start.length) : theme.length;
  if (from < 0 || (end && to < 0)) throw new Error(`Could not locate theme section ${start}`);
  return theme.slice(from, to);
}

function tokens(css) {
  return Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*([^;]+);/gi)].map(([, key, value]) => [key, value.trim().toLowerCase()]));
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = [r, g, b].map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(first, second, secondWeight) {
  return `#${[1, 3, 5].map((offset) => {
    const a = Number.parseInt(first.slice(offset, offset + 2), 16);
    const b = Number.parseInt(second.slice(offset, offset + 2), 16);
    return Math.round(a * (1 - secondWeight) + b * secondWeight).toString(16).padStart(2, "0");
  }).join("")}`;
}

const light = tokens(section(":root,", '\n:is(.app-shell, .setup-shell)[data-theme="dark"]'));
const dark = tokens(section('\n:is(.app-shell, .setup-shell)[data-theme="dark"]', "\n@media (prefers-color-scheme: dark)"));
const systemDark = tokens(section("@media (prefers-color-scheme: dark)", ""));
const palettes = [...new Set(paletteSource.match(/#[\da-f]{6}/gi) ?? [])].map((color) => color.toLowerCase());
const failures = [];
let checked = 0;

function check(description, actual, minimum) {
  checked += 1;
  if (actual < minimum) failures.push(`${description}: ${actual.toFixed(2)}:1 (minimum ${minimum}:1)`);
}

function requireToken(values, key, scheme) {
  if (!values[key]) throw new Error(`${scheme} is missing ${key}`);
  return values[key];
}

for (const [scheme, values] of [["light", light], ["dark", dark]]) {
  const surfaces = ["--surface-canvas", "--surface-primary", "--surface-secondary", "--surface-raised", "--surface-recessed", "--surface-hover", "--surface-selected", "--surface-tinted"];
  for (const foreground of ["--text-primary", "--text-secondary", "--text-muted"]) {
    for (const background of surfaces) {
      check(`${scheme} ${foreground} on ${background}`, contrast(requireToken(values, foreground, scheme), requireToken(values, background, scheme)), 4.5);
    }
  }
  check(`${scheme} field placeholder`, contrast(requireToken(values, "--text-subtle", scheme), requireToken(values, "--surface-primary", scheme)), 4.5);

  for (const foreground of ["--accent-green-foreground", "--accent-blue-foreground", "--state-warning-foreground"]) {
    for (const background of ["--surface-primary", "--surface-secondary"]) {
      check(`${scheme} ${foreground} on ${background}`, contrast(requireToken(values, foreground, scheme), requireToken(values, background, scheme)), 4.5);
    }
  }
  check(`${scheme} danger text`, contrast(requireToken(values, "--state-danger-foreground", scheme), requireToken(values, "--surface-primary", scheme)), 4.5);

  const brandText = requireToken(values, "--text-on-brand", scheme);
  for (const brand of palettes) {
    const accent = scheme === "dark" ? mix(brand, "#ffffff", 0.48) : brand;
    const hover = scheme === "dark" ? mix(accent, "#000000", 0.1) : mix(brand, "#000000", 0.15);
    check(`${scheme} brand text on ${brand}`, contrast(brandText, accent), 4.5);
    check(`${scheme} brand hover text on ${brand}`, contrast(brandText, hover), 4.5);
    for (const background of ["--surface-canvas", "--surface-primary", "--surface-secondary", "--surface-hover", "--surface-selected"]) {
      check(`${scheme} focus indicator ${brand} on ${background}`, contrast(accent, requireToken(values, background, scheme)), 3);
    }
  }
  if (!values["--focus-ring"]?.includes("var(--brand-accent)")) failures.push(`${scheme} focus ring is not based on the semantic brand accent`);
}

for (const key of [
  "--surface-canvas", "--surface-primary", "--surface-secondary", "--surface-raised", "--surface-recessed", "--surface-hover", "--surface-selected", "--surface-tinted",
  "--text-primary", "--text-secondary", "--text-muted", "--text-subtle", "--text-on-brand", "--focus-ring", "--brand-primary", "--brand-accent", "--brand-primary-hover",
  "--accent-green-foreground", "--accent-blue-foreground", "--state-warning-foreground", "--state-danger-foreground",
]) {
  if (systemDark[key] !== dark[key]) failures.push(`system-dark ${key} differs from explicit dark theme`);
}

if (failures.length) {
  console.error(`Contrast check failed (${failures.length} of ${checked} pairs):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Contrast token check passed: ${checked} foreground/background pairs across light, dark, and curated brand colors.`);
  console.log("Checked core text/surface pairs, input placeholders, semantic status text, brand and hover text, and focus-indicator contrast.");
  console.log("This token-level check does not inspect rendered component screenshots or assistive-technology output.");
}
