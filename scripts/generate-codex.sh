#!/bin/bash
# Generate compact codebase index files for Claude Code context efficiency.
# Run: bash scripts/generate-codex.sh
# Output: .codex/routes.md, .codex/schema.md, .codex/pages.md

set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$DIR/.codex"
mkdir -p "$OUT"

# --- routes.md ---
echo "# API Routes (auto-generated)" > "$OUT/routes.md"
echo "# $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUT/routes.md"
echo "" >> "$OUT/routes.md"

# Extract method and path, converting to uppercase method
grep -nE "app\.(get|post|put|patch|delete)\(" "$DIR/server/routes.ts" \
  | sed -E 's/^([0-9]+):[ ]*app\.(get|post|put|patch|delete)\(([^,]+).*/\1 \2 \3/' \
  | awk '{method=toupper($2); print $1, method, $3}' \
  | sed -E "s/api\.([a-zA-Z.]+)\.path/shared:\1/g" \
  | sort -t' ' -k3 \
  >> "$OUT/routes.md"

ROUTE_COUNT=$(wc -l < "$OUT/routes.md" | tr -d ' ')
echo "" >> "$OUT/routes.md"
echo "# Total: $((ROUTE_COUNT - 3)) routes" >> "$OUT/routes.md"

# --- schema.md ---
echo "# DB Schema (auto-generated)" > "$OUT/schema.md"
echo "# $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUT/schema.md"
echo "" >> "$OUT/schema.md"

# Extract table name + columns (just names, not types — enough for navigation)
python3 - "$DIR/shared/schema.ts" >> "$OUT/schema.md" << 'PYEOF'
import re, sys

with open(sys.argv[1]) as f:
    content = f.read()

# Find all pgTable definitions
tables = re.findall(
    r'export const (\w+) = pgTable\("(\w+)",\s*\{([^}]+)\}',
    content, re.DOTALL
)

for var_name, table_name, cols_block in tables:
    # Extract column names
    col_names = re.findall(r'(\w+):\s*(?:serial|text|integer|boolean|timestamp|jsonb|numeric)', cols_block)
    print(f"{table_name} ({var_name}): {', '.join(col_names)}")
PYEOF

TABLE_COUNT=$(grep -c '^[a-z]' "$OUT/schema.md" || echo 0)
echo "" >> "$OUT/schema.md"
echo "# Total: $TABLE_COUNT tables" >> "$OUT/schema.md"

# --- pages.md ---
echo "# Frontend Pages (auto-generated)" > "$OUT/pages.md"
echo "# $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUT/pages.md"
echo "" >> "$OUT/pages.md"

for f in "$DIR"/client/src/pages/*.tsx; do
  name=$(basename "$f" .tsx)
  component=$(grep -oE 'export default function (\w+)' "$f" | head -1 | sed 's/export default function //' || true)
  if [ -z "$component" ]; then
    component=$(grep -oE 'export function (\w+)' "$f" | head -1 | sed 's/export function //' || true)
  fi
  line_count=$(wc -l < "$f" | tr -d ' ')
  echo "$name → ${component:-anonymous} (${line_count}L)" >> "$OUT/pages.md"
done

PAGE_COUNT=$(grep -c '→' "$OUT/pages.md" || echo 0)
echo "" >> "$OUT/pages.md"
echo "# Total: $PAGE_COUNT pages" >> "$OUT/pages.md"

echo "Codex generated: $OUT/ (routes, schema, pages)"
