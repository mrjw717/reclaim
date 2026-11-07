// Generates THIRD_PARTY_NOTICES.md from observed dependency metadata.
//
// Sources of truth:
// - `pnpm list --prod --depth Infinity --json` (frontend runtime closure), reading the
//   license/homepage fields from each resolved package's package.json on disk.
// - `src-tauri/Cargo.lock` crate list, fetching each crate's registered license record
//   from the crates.io API and the canonical license text from spdx.org when a text is
//   not already embedded in this file.
//
// The script records what the registries report; it does not infer licenses from names.
// Standard license texts are fetched verbatim from SPDX. Re-run with network access
// after dependency changes: `node scripts/generate-notices.mjs`.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const CACHE = process.env.NOTICES_CACHE || "/tmp/opencode/notices-cache.json";
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : { crates: {}, spdx: {} };

const pnpmTree = JSON.parse(execFileSync("pnpm", ["list", "--prod", "--depth", "Infinity", "--json"], { encoding: "utf8" }));
const jsPackages = new Map();
function walk(node) {
  for (const dep of Object.values(node.dependencies ?? {})) {
    const name = dep.from ?? dep.name;
    if (name && dep.version && dep.path) {
      const manifest = JSON.parse(readFileSync(resolve(dep.path, "package.json"), "utf8"));
      jsPackages.set(`${name}@${dep.version}`, {
        name,
        version: dep.version,
        license: manifest.license ?? "UNKNOWN",
        homepage: manifest.homepage ?? "",
      });
    }
    walk(dep);
  }
}
for (const root of pnpmTree) walk(root);

const lock = readFileSync(resolve("src-tauri", "Cargo.lock"), "utf8");
const crates = [];
for (const block of lock.split("[[package]]").slice(1)) {
  const name = block.match(/^name = "(.+)"$/m)?.[1];
  const version = block.match(/^version = "(.+)"$/m)?.[1];
  const source = block.match(/^source = "(.+)"$/m)?.[1];
  if (name && version && source) crates.push({ name, version }); // registry crates only; local path crates excluded
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "reclaim-notice-generator (local release tooling)" } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return null;
}

async function licenseFor(crate) {
  const key = `${crate.name}@${crate.version}`;
  if (cache.crates[key]) return cache.crates[key];
  const data = await fetchJson(`https://crates.io/api/v1/crates/${crate.name}/${crate.version}`);
  const record = { license: data?.version?.license ?? "UNKNOWN", url: `https://crates.io/crates/${crate.name}/${crate.version}` };
  cache.crates[key] = record;
  return record;
}

const concurrency = 10;
const crateRecords = new Map();
let index = 0;
async function worker() {
  while (index < crates.length) {
    const crate = crates[index++];
    crateRecords.set(`${crate.name}@${crate.version}`, await licenseFor(crate));
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));

function spdxIds(expression) {
  return expression.split(/ (?:OR|AND) /).map((id) => id.trim()).filter((id) => id && !id.includes("WITH"));
}
async function spdxText(id) {
  if (cache.spdx[id]) return cache.spdx[id];
  const res = await fetch(`https://spdx.org/licenses/${id}.txt`, { headers: { "User-Agent": "reclaim-notice-generator" } });
  if (!res.ok) return null;
  const text = await res.text();
  cache.spdx[id] = text;
  return text;
}

const allLicenses = new Set([...jsPackages.values()].map((p) => p.license));
for (const record of crateRecords.values()) spdxIds(record.license).forEach((id) => allLicenses.add(id));
const licenseTexts = {};
for (const id of [...allLicenses].sort()) {
  const text = await spdxText(id);
  if (text) licenseTexts[id] = text;
}

writeFileSync(CACHE, JSON.stringify(cache));

const jsRows = [...jsPackages.values()]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((p) => `| ${p.name} | ${p.version} | ${p.license} | ${p.homepage || ""} |`)
  .join("\n");
const crateRows = crates
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
  .map((c) => {
    const record = crateRecords.get(`${c.name}@${c.version}`) ?? { license: "UNKNOWN", url: "" };
    return `| ${c.name} | ${c.version} | ${record.license} | ${record.url} |`;
  })
  .join("\n");

const licenseSections = Object.entries(licenseTexts)
  .map(([id, text]) => `### ${id}\n\n\`\`\`\n${text.trim()}\n\`\`\``)
  .join("\n\n");

const generatedAt = new Date().toISOString().slice(0, 10);
const doc = `# Reclaim — Third-party notices

**Generated:** ${generatedAt} by \`scripts/generate-notices.mjs\` from the actual production dependency graph:
the frontend runtime closure reported by \`pnpm list --prod\` (license fields read from each resolved
package manifest on disk) and every registry crate locked in \`src-tauri/Cargo.lock\` (license records
fetched from the crates.io API). License texts below are the canonical SPDX texts for the identifiers
those records report.

**Scope and limits:** this file covers the npm packages and Cargo crates compiled or bundled into
Reclaim 0.1.0. It does not relicense third-party material under Reclaim's MIT license. Per-crate
copyright authorship lines are kept by each upstream project in its own source; consult the recorded
crates.io/package URLs for authoritative details before commercial redistribution.

## Reclaim license

Reclaim itself is licensed under the MIT License — see [LICENSE](LICENSE). Copyright (c) 2026 Kynex Media.

## Frontend runtime packages

| Package | Version | License (manifest field) | Homepage |
|---|---|---|---|
${jsRows}

## Rust crates (Cargo.lock, registry crates)

| Crate | Version | License (crates.io record) | Record |
|---|---|---|---|
${crateRows}

## License texts

The following canonical license texts cover the identifiers reported above.

${licenseSections}
`;

writeFileSync("THIRD_PARTY_NOTICES.md", doc);
console.log(`THIRD_PARTY_NOTICES.md written: ${jsPackages.size} frontend packages, ${crates.length} crates, ${Object.keys(licenseTexts).length} license texts.`);
