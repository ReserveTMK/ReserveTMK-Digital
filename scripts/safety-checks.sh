#!/bin/bash
# Safety checks — runs before every push to main
# Blocks push if any critical wiring is broken
# Split: fast checks (grep, <2s) + slow checks (DB, only when schema changed)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No color

PASS=0
FAIL=0
WARN=0
LOG_FILE=".claude/last-safety-check.log"
RESULTS=""

check_pass() {
  PASS=$((PASS + 1))
  RESULTS="${RESULTS}✓ $1\n"
  echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
  FAIL=$((FAIL + 1))
  RESULTS="${RESULTS}✗ $1 — $2\n"
  echo -e "${RED}✗${NC} $1"
  echo -e "  ${RED}$2${NC}"
}

check_warn() {
  WARN=$((WARN + 1))
  RESULTS="${RESULTS}⚠ $1 — $2\n"
  echo -e "${YELLOW}⚠${NC} $1"
  echo -e "  ${YELLOW}$2${NC}"
}

echo ""
echo "═══════════════════════════════════"
echo "  SAFETY CHECKS"
echo "═══════════════════════════════════"
echo ""

# ── FAST CHECKS (grep-based) ──────────────────────────────────────

# 1. Debrief confirm → reporting chain
echo "Running fast checks..."
if grep -r "confirmedDebriefWhere" server/routes/reports.ts server/reporting.ts > /dev/null 2>&1; then
  check_pass "Debrief confirm → reporting (confirmedDebriefWhere present)"
else
  check_fail "Debrief confirm → reporting" "confirmedDebriefWhere missing from reporting files — draft debriefs could leak into reports"
fi

# 2. Stage moves → history
if grep -r "createRelationshipStageHistory" server/routes/ > /dev/null 2>&1; then
  check_pass "Stage moves → history (createRelationshipStageHistory present)"
else
  check_fail "Stage moves → history" "createRelationshipStageHistory not called in any route module — stage progression will be lost"
fi

# 3. Booking → event linkage
if grep -r "ensureBookingEvent" server/routes/bookings.ts server/routes/portal.ts server/routes/_helpers.ts > /dev/null 2>&1; then
  check_pass "Booking → event linkage (ensureBookingEvent present)"
else
  check_fail "Booking → event linkage" "ensureBookingEvent missing — confirmed bookings won't appear on debrief board"
fi

# 4. Programme attendance → array
if grep -r "attendees\|attended" server/routes/programmes.ts > /dev/null 2>&1; then
  check_pass "Programme attendance wiring (attended flag present)"
else
  check_fail "Programme attendance" "attended/attendees not found in programmes routes — reporting will be blind to attendance"
fi

# 5. Contact promotion
if grep -r "autoPromoteToInnovator" server/routes/ > /dev/null 2>&1; then
  check_pass "Contact promotion (autoPromoteToInnovator present)"
else
  check_fail "Contact promotion" "autoPromoteToInnovator not called in any route module — innovator counts will drop"
fi

# 6. Un-confirm cleanup
if grep -r "actionItems.*impactLogId\|delete.*actionItems\|delete.*funderTaxonomyClassifications" server/routes/debriefs.ts > /dev/null 2>&1; then
  check_pass "Un-confirm cleanup (action items + taxonomy deletion present)"
else
  check_warn "Un-confirm cleanup" "Could not verify cleanup logic in debriefs module — check manually"
fi

# 7. No empty SelectItem values
EMPTY_SELECT=$(grep -rn 'SelectItem value=""' client/src/ 2>/dev/null || true)
if [ -z "$EMPTY_SELECT" ]; then
  check_pass "No empty SelectItem values (Radix safe)"
else
  check_fail "Empty SelectItem values" "Found SelectItem value=\"\" — Radix crashes on empty strings:\n$EMPTY_SELECT"
fi

# 8. Route module registration
ROUTE_FILES=$(ls server/routes/*.ts 2>/dev/null | grep -v "_helpers\|index" | sed 's|server/routes/||' | sed 's|\.ts||')
MISSING_REG=""
for module in $ROUTE_FILES; do
  FUNC_NAME="register$(echo $module | sed 's/\b\(.\)/\u\1/g' | sed 's/-//g')Routes"
  if ! grep -q "$module" server/routes.ts 2>/dev/null; then
    MISSING_REG="${MISSING_REG}  ${module}.ts not registered in routes.ts\n"
  fi
done
if [ -z "$MISSING_REG" ]; then
  check_pass "Route module registration (all modules registered)"
else
  check_fail "Route module registration" "Unregistered modules:\n$MISSING_REG"
fi

# 9. Import verification — check no obviously broken imports in changed files
CHANGED_TSX=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null | grep '\.tsx$' || git diff --name-only HEAD~1 2>/dev/null | grep '\.tsx$' || true)
BROKEN_IMPORTS=""
for file in $CHANGED_TSX; do
  if [ -f "$file" ]; then
    # Check for imports from paths that look like they should be component files
    BAD=$(grep -n "from.*@/components/.*'" "$file" 2>/dev/null | while read line; do
      IMPORT_PATH=$(echo "$line" | grep -oP "from ['\"]@/components/[^'\"]+['\"]" | sed "s/from ['\"]@\//client\/src\//" | sed "s/['\"]//g")
      if [ -n "$IMPORT_PATH" ]; then
        # Check if file or directory exists
        if [ ! -f "${IMPORT_PATH}.ts" ] && [ ! -f "${IMPORT_PATH}.tsx" ] && [ ! -d "$IMPORT_PATH" ] && [ ! -f "${IMPORT_PATH}/index.ts" ] && [ ! -f "${IMPORT_PATH}/index.tsx" ]; then
          echo "  $file: $IMPORT_PATH not found"
        fi
      fi
    done)
    if [ -n "$BAD" ]; then
      BROKEN_IMPORTS="${BROKEN_IMPORTS}${BAD}\n"
    fi
  fi
done
if [ -z "$BROKEN_IMPORTS" ]; then
  check_pass "Import verification (no broken imports in changed files)"
else
  check_warn "Import verification" "Possibly broken imports:\n$BROKEN_IMPORTS"
fi

# ── SLOW CHECK (DB, only when schema changed) ─────────────────────

SCHEMA_CHANGED=$(git diff --name-only HEAD~1 2>/dev/null | grep "shared/schema.ts" || true)
if [ -n "$SCHEMA_CHANGED" ]; then
  echo ""
  echo "Schema changed — running DB check..."
  # Schema check would go here — requires node + DB connection
  # For now, warn to run /schema-check
  check_warn "Schema sync" "shared/schema.ts changed — run /schema-check before deploying"
else
  check_pass "Schema sync (no schema changes)"
fi

# ── RESULTS ───────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════"

# Save log
mkdir -p .claude
echo "Safety check — $(date)" > "$LOG_FILE"
echo -e "$RESULTS" >> "$LOG_FILE"
echo "$PASS passed, $FAIL failed, $WARN warnings" >> "$LOG_FILE"

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}BLOCKED${NC} — $FAIL check(s) failed. Fix before pushing."
  echo "═══════════════════════════════════"
  echo ""
  exit 1
elif [ $WARN -gt 0 ]; then
  echo -e "${YELLOW}PASSED WITH WARNINGS${NC} — $PASS passed, $WARN warning(s)"
  echo "═══════════════════════════════════"
  echo ""
  exit 0
else
  echo -e "${GREEN}ALL CLEAR${NC} — $PASS checks passed"
  echo "═══════════════════════════════════"
  echo ""
  exit 0
fi
