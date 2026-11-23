#!/usr/bin/env bash
# End-to-end smoke test of the docker compose stack (SPA via nginx -> API -> SQL Server + AI engine).
# Usage: bash scripts/ci/compose_smoke.sh [base_url]     (default http://localhost:3000)
# Requires the stack to be up with SEED_DEMO_DATA=true (uses the documented demo ADMIN account).
# Every failure prints the check name, HTTP status and response body, and emits a GitHub annotation.
set -uo pipefail

BASE="${1:-http://localhost:3000}"
EMAIL="priyanka.iyer@fraudguard.enterprise.io"
PASSWORD="password123"
TMP="$(mktemp -d)"
FAILED=0

pass() { echo "PASS  $1"; }
fail() {
  FAILED=1
  local msg="$1 | status=${2:-?} | body=$(head -c 400 "${3:-/dev/null}" 2>/dev/null | tr '\n\r' '  ')"
  echo "FAIL  $msg"
  echo "::error title=smoke check failed::${msg//%/%25}"
}

# request <outfile-prefix> <curl args...>  -> sets STATUS, writes $TMP/<prefix>.body and $TMP/<prefix>.headers
request() {
  local name="$1"; shift
  FILE="$TMP/${name//[^A-Za-z0-9]/_}"   # check names contain spaces and slashes: never use them as paths
  # curl itself prints 000 as the status when the connection fails, so just ignore its exit code
  STATUS=$(curl -s -o "$FILE.body" -D "$FILE.headers" -w '%{http_code}' "$@" || true)
}

# expect <name> <expected-status> <needle-or-empty> <curl args...>
expect() {
  local name="$1" want="$2" needle="$3"; shift 3
  request "$name" "$@"
  if [ "$STATUS" != "$want" ]; then fail "$name (expected HTTP $want)" "$STATUS" "$FILE.body"; return 1; fi
  if [ -n "$needle" ] && ! grep -qF -- "$needle" "$FILE.body"; then
    fail "$name (body missing: $needle)" "$STATUS" "$FILE.body"; return 1
  fi
  pass "$name"
}

# 1. SPA
expect "SPA index served" 200 "<app-root" "$BASE/"
grep -qi "x-content-type-options: nosniff" "$FILE.headers" 2>/dev/null \
  && pass "SPA security headers" || fail "SPA security headers" "-" "/dev/null"

# 2. anonymous API call is rejected
expect "anonymous /auth/me is 401" 401 "" "$BASE/api/auth/me"

# 3. login (seeded ADMIN) through nginx
request login -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
TOKEN=""
if [ "$STATUS" = "200" ]; then
  TOKEN=$(grep -i '^set-cookie: FG_Auth=' "$TMP/login.headers" | sed -E 's/^[^=]+=([^;]+);.*/\1/' | tr -d '\r')
  [ -n "$TOKEN" ] && pass "login returns FG_Auth cookie" || fail "login returned no FG_Auth cookie" "$STATUS" "$TMP/login.body"
  grep -qi "^set-cookie: FG_Auth=.*httponly" "$TMP/login.headers" \
    && pass "auth cookie is HttpOnly" || fail "auth cookie must be HttpOnly" "$STATUS" "$TMP/login.headers"
else
  fail "login (expected HTTP 200)" "$STATUS" "$TMP/login.body"
fi

if [ -n "$TOKEN" ]; then
  COOKIE="Cookie: FG_Auth=$TOKEN"
  # 4. authenticated request
  expect "authenticated /auth/me" 200 "$EMAIL" -H "$COOKIE" "$BASE/api/auth/me"
  # 5. AI engine reachable through the API
  expect "AI engine reachable via API (engine-health)" 200 'modelLoaded":true' -H "$COOKIE" "$BASE/api/fraud/engine-health"
  # 6. CSRF header required for cookie-authenticated unsafe requests
  expect "CSRF: POST without X-Requested-With is blocked" 403 "" -X POST -H "$COOKIE"     -H 'Content-Type: application/json' -d '{}' "$BASE/api/auth/logout"
  # 7. logout, then the old token must be rejected (persistent revocation)
  expect "logout with CSRF header" 200 "" -X POST -H "$COOKIE" -H 'X-Requested-With: XMLHttpRequest'     -H 'Content-Type: application/json' -d '{}' "$BASE/api/auth/logout"
  expect "revoked token is rejected after logout" 401 "" -H "$COOKIE" "$BASE/api/auth/me"
fi

if [ "$FAILED" -eq 0 ]; then echo "ALL SMOKE CHECKS PASSED"; else echo "SMOKE TEST FAILED"; fi
exit "$FAILED"
