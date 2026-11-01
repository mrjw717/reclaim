import fs from "node:fs";
import path from "node:path";

const sourceRoot = path.resolve("src");
const approvedFiles = new Set([
  path.join(sourceRoot, "theme.css"),
  path.join(sourceRoot, "theme-palette.ts"),
]);
const colorLiteral = /#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|lab|lch|oklab|oklch|color|color-mix)\s*\(/i;
const namedColors = new Set([
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque", "black", "blanchedalmond", "blue", "blueviolet", "brown", "burlywood", "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson", "cyan", "darkblue", "darkcyan", "darkgoldenrod", "darkgray", "darkgreen", "darkgrey", "darkkhaki", "darkmagenta", "darkolivegreen", "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen", "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise", "darkviolet", "deeppink", "deepskyblue", "dimgray", "dimgrey", "dodgerblue", "firebrick", "floralwhite", "forestgreen", "fuchsia", "gainsboro", "ghostwhite", "gold", "goldenrod", "gray", "green", "greenyellow", "grey", "honeydew", "hotpink", "indianred", "indigo", " ivory", "khaki", "lavender", "lavenderblush", "lawngreen", "lemonchiffon", "lightblue", "lightcoral", "lightcyan", "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey", "lightpink", "lightsalmon", "lightseagreen", "lightskyblue", "lightslategray", "lightslategrey", "lightsteelblue", "lightyellow", "lime", "limegreen", "linen", "magenta", "maroon", "mediumaquamarine", "mediumblue", "mediumorchid", "mediumpurple", "mediumseagreen", "mediumslateblue", "mediumspringgreen", "mediumturquoise", "mediumvioletred", "midnightblue", "mintcream", "mistyrose", "moccasin", "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange", "orangered", "orchid", "palegoldenrod", "palegreen", "paleturquoise", "palevioletred", "papayawhip", "peachpuff", "peru", "pink", "plum", "powderblue", "purple", "rebeccapurple", "red", "rosybrown", "royalblue", "saddlebrown", "salmon", "sandybrown", "seagreen", "seashell", "sienna", "silver", "skyblue", "slateblue", "slategray", "slategrey", "snow", "springgreen", "steelblue", "tan", "teal", "thistle", "tomato", "turquoise", "violet", "wheat", "white", "whitesmoke", "yellow", "yellowgreen", "transparent", "currentcolor",
].map((color) => color.trim()));

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(fullPath) : /\.(?:css|tsx|ts)$/.test(entry.name) ? [fullPath] : [];
  });
}

function lineAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

const failures = [];
for (const file of sourceFiles(sourceRoot)) {
  if (approvedFiles.has(file)) continue;
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(process.cwd(), file);
  if (file.endsWith(".css")) {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
    const declaration = /(?:^|[;{}])\s*([\w-]+)\s*:\s*([^;{}]+)/g;
    for (const match of withoutComments.matchAll(declaration)) {
      const [whole, property, value] = match;
      if (property.toLowerCase() === "content") continue;
      const unreferenced = value.replace(/var\([^)]*\)/gi, "");
      const bad = unreferenced.match(colorLiteral) ?? unreferenced.replace(/var\([^)]*\)/gi, "").match(new RegExp(`\\b(?:${[...namedColors].join("|")})\\b`, "i"));
      if (bad) failures.push(`${relative}:${lineAt(source, match.index + whole.indexOf(value))}: literal color ${JSON.stringify(bad[0])} in ${property}`);
    }
    continue;
  }

  // Hex and functional colors anywhere in TS/TSX are usually UI constants that belong in tokens.
  for (const match of source.matchAll(/#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|lab|lch|oklab|oklch|color|color-mix)\s*\(/gi)) {
    failures.push(`${relative}:${lineAt(source, match.index)}: literal color ${JSON.stringify(match[0])}`);
  }

  // Named colors are only meaningful violations in style object values; prose may discuss colors.
  for (const style of source.matchAll(/style\s*=\s*\{\s*\{([^{}]*)\}\s*\}/gs)) {
    for (const match of style[1].matchAll(new RegExp(`\\b(?:${[...namedColors].join("|")})\\b`, "gi"))) {
      failures.push(`${relative}:${lineAt(source, style.index + style[0].indexOf(style[1]) + match.index)}: named color ${JSON.stringify(match[0])} in inline style`);
    }
  }
}

if (failures.length) {
  console.error(`Design token check failed with ${failures.length} unapproved color literal(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Design token check passed: no unapproved color literals in component CSS or TS/TSX.");
  console.log("Approved literal color sources: src/theme.css (semantic theme definitions), src/theme-palette.ts (curated organization colors).");
  console.log("This static check does not verify rendered contrast, layout, or appearance.");
}
