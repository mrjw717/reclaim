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

// Core neutrals are declared as `color-mix(in srgb, var(--brand-primary) W%, #anchor)`
// so the whole theme follows the organization brand color. Resolve each token for a
// concrete curated brand color before computing contrast.
const brandMixPattern = /^color-mix\(in srgb,\s*var\(--(?:brand-primary|org-brand-color)\)\s+([\d.]+)%,\s*(#[0-9a-f]{6})\)$/i;

function brandMixSpec(value) {
  const match = value.match(brandMixPattern);
  return match ? { weight: Number(match[1]) / 100, base: match[2] } : null;
}

function resolveToken(value, brand) {
  const spec = brandMixSpec(value);
  return spec ? mix(spec.base, brand, spec.weight) : value;
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

const surfaces = ["--surface-canvas", "--surface-primary", "--surface-secondary", "--surface-raised", "--surface-recessed", "--surface-hover", "--surface-selected", "--surface-tinted"];
// Elevated card/modal surfaces stay pure white (light) so content floats on
// the brand-tinted canvas exactly as before; every other core neutral must
// derive from the organization brand color.
const pureNeutralSurfaces = ["--surface-primary", "--surface-raised"];
const brandDerived = [
  ...surfaces.filter((key) => !pureNeutralSurfaces.includes(key)),
  "--text-primary", "--text-secondary", "--text-muted", "--text-subtle", "--text-disabled",
  "--border-subtle", "--border-strong", "--border-accent",
];

for (const [scheme, values] of [["light", light], ["dark", dark]]) {
  // The theme must keep deriving its neutrals from the organization brand
  // color; a literal here would silently freeze one hue into every workspace.
  for (const key of brandDerived) {
    if (!brandMixSpec(requireToken(values, key, scheme))) failures.push(`${scheme} ${key} is not derived from the organization brand color`);
  }

  for (const brand of palettes) {
    const resolve = (key) => resolveToken(requireToken(values, key, scheme), brand);

    for (const foreground of ["--text-primary", "--text-secondary", "--text-muted"]) {
      for (const background of surfaces) {
        check(`${scheme} ${foreground} on ${background} (${brand})`, contrast(resolve(foreground), resolve(background)), 4.5);
      }
    }
    check(`${scheme} field placeholder (${brand})`, contrast(resolve("--text-subtle"), resolve("--surface-primary")), 4.5);

    for (const foreground of ["--accent-green-foreground", "--accent-blue-foreground", "--state-warning-foreground"]) {
      for (const background of ["--surface-primary", "--surface-secondary"]) {
        check(`${scheme} ${foreground} on ${background} (${brand})`, contrast(requireToken(values, foreground, scheme), resolve(background)), 4.5);
      }
    }
    check(`${scheme} setup eyebrow green on canvas (${brand})`, contrast(requireToken(values, "--accent-green-foreground", scheme), resolve("--surface-canvas")), 4.5);
    check(`${scheme} danger text (${brand})`, contrast(requireToken(values, "--state-danger-foreground", scheme), resolve("--surface-primary")), 4.5);

    const brandText = resolveToken(requireToken(values, "--text-on-brand", scheme), brand);
    const accent = scheme === "dark" ? mix(brand, "#ffffff", 0.48) : brand;
    const hover = scheme === "dark" ? mix(accent, "#000000", 0.1) : mix(brand, "#000000", 0.15);
    const brandSoft = mix(resolve("--surface-canvas"), brand, scheme === "dark" ? 0.22 : 0.1);
    check(`${scheme} brand text on ${brand}`, contrast(brandText, accent), 4.5);
    check(`${scheme} brand hover text on ${brand}`, contrast(brandText, hover), 4.5);
    check(`${scheme} selected settings-nav description on brand-soft ${brand}`, contrast(resolve("--text-secondary"), brandSoft), 4.5);
    for (const background of ["--surface-canvas", "--surface-primary", "--surface-secondary", "--surface-hover", "--surface-selected"]) {
      check(`${scheme} focus indicator ${brand} on ${background}`, contrast(accent, resolve(background)), 3);
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
  console.log("Checked core text/surface pairs per curated brand color (core neutrals are brand-derived), input placeholders, semantic status text, brand and hover text, and focus-indicator contrast.");
  console.log("This token-level check does not inspect rendered component screenshots or assistive-technology output, and it does not evaluate custom brand colors outside the curated palette.");
}
