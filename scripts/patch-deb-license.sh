#!/bin/bash
# Post-process the Tauri .deb: add the license/copyright files required by
# Debian policy (usr/share/doc/reclaim/) and replace the bundler's "(none)"
# extended description. Deterministic; run after `pnpm tauri build`.
set -euo pipefail
DEB="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
mkdir -p ctl data
ar x "$DEB" debian-binary control.tar.gz data.tar.gz
tar xzf control.tar.gz -C ctl
tar xzf data.tar.gz -C data

# Debian copyright file: full MIT text plus attribution.
mkdir -p data/usr/share/doc/reclaim
{
  echo "Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/"
  echo "Upstream-Name: Reclaim"
  echo "Source: local build; see THIRD_PARTY_NOTICES for bundled components."
  echo ""
  echo "Files: *"
  echo "Copyright: 2026 Kynex Media"
  echo "License: MIT"
  echo "  Reclaim is licensed under the MIT License."
  echo ""
  cat "$ROOT/LICENSE"
  echo ""
  echo "License: MIT"
  cat "$ROOT/LICENSE"
} > data/usr/share/doc/reclaim/copyright
cp "$ROOT/THIRD_PARTY_NOTICES.md" data/usr/share/doc/reclaim/THIRD_PARTY_NOTICES
gzip -9 -n data/usr/share/doc/reclaim/THIRD_PARTY_NOTICES

# Fix the "(none)" long description.
python3 - ctl/control <<'PY'
import sys
path = sys.argv[1]
text = open(path).read()
text = text.replace("Description: Local lost and found management for organizations\n (none)",
    "Description: Local lost and found management for organizations\n"
    " Reclaim is a local-first desktop lost and found application for a single\n"
    " organization. Records and imported photographs stay in the operating\n"
    " system's app-data directory; no account or network connection is required.\n"
    " It provides found-item intake with photos, nested storage locations,\n"
    " lost reports with ranked match review, verified returns, custody history,\n"
    " retention review, and verified local backup archives.\n")
open(path, "w").write(text)
PY

# Refresh md5sums to cover the added files.
python3 - <<'PY'
import hashlib, os
lines = []
for root, _, files in os.walk("data/usr"):
    for f in sorted(files):
        p = os.path.join(root, f)
        rel = "/" + os.path.relpath(p, "data")
        digest = hashlib.md5(open(p, "rb").read()).hexdigest()
        lines.append(f"{digest}  {rel}")
open("ctl/md5sums", "w").write("\n".join(lines) + "\n")
PY

tar czf control.tar.gz -C ctl .
tar czf data.tar.gz -C data .
ar rcs "$DEB.new" debian-binary control.tar.gz data.tar.gz
mv "$DEB.new" "$DEB"
echo "patched $DEB"
